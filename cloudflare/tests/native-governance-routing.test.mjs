import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../reports/worker.mjs';

const publicOrigin = 'https://reports.elegantlashesbykatie.com';
const protectedOrigin = 'https://checkin-origin.elegantlashesbykatie.com';
function envWithoutGovernance() {
  const env = {
    ORIGIN_BASE_URL: protectedOrigin,
    ORIGIN_ACCESS_CLIENT_ID: 'synthetic-access-id',
    ORIGIN_ACCESS_CLIENT_SECRET: 'synthetic-access-secret',
  };
  for (const binding of ['REPORTS_GOVERNANCE_DB', 'GOVERNANCE_FINGERPRINT_SECRET', 'ASSETS']) {
    Object.defineProperty(env, binding, { get() { throw new Error(`Unexpected retired/static binding access: ${binding}`); } });
  }
  return env;
}

test('actual Reports Worker proxies login, reports and every governance path once without D1 or fingerprint access', async t => {
  const cases = [
    ['POST', '/api/reports/auth/login', '{"pin":"synthetic-pin"}'],
    ['GET', '/api/reports/full/2026-11-01/Tustin?refresh=true'],
    ['GET', '/api/reports/all-locations/2026-11-01'],
    ['GET', '/api/reports/governance/signoffs?date=2026-11-01&location=Tustin'],
    ['POST', '/api/reports/governance/signoffs', '{"date":"2026-11-01","locationId":"Tustin"}'],
    ['GET', '/api/reports/governance/sections?date=2026-11-01&location=Tustin'],
    ['POST', '/api/reports/governance/sections/signoffs', '{"requestId":"synthetic-review","snapshotHash":"synthetic-hash"}'],
    ['POST', '/api/reports/governance/sections/acknowledgements', '{"entryKey":"synthetic-entry"}'],
    ['GET', '/api/reports/governance/audit?date=2026-11-01'],
  ];
  let received = [];
  t.mock.method(globalThis, 'fetch', async request => {
    received.push({ url: request.url, method: request.method, headers: request.headers, body: await request.text() });
    return new Response('{"from":"native-governance"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  for (const [method, pathname, body] of cases) {
    received = [];
    const headers = {
      Authorization: 'Bearer synthetic-principal', Cookie: 'reports_session=synthetic-session',
      Origin: publicOrigin, 'X-Request-Id': 'synthetic-request',
      'CF-Access-Client-Id': 'untrusted-incoming-id', 'CF-Access-Client-Secret': 'untrusted-incoming-secret',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await worker.fetch(new Request(publicOrigin + pathname, { method, headers, body }), envWithoutGovernance());
    assert.equal(response.status, 200, pathname);
    assert.equal(await response.text(), '{"from":"native-governance"}');
    assert.equal(received.length, 1, `${pathname} must have only one origin request`);
    const outbound = received[0];
    assert.equal(outbound.url, protectedOrigin + pathname);
    assert.equal(outbound.method, method);
    assert.equal(outbound.body, body ?? '');
    assert.equal(outbound.headers.get('authorization'), 'Bearer synthetic-principal');
    assert.equal(outbound.headers.get('cookie'), 'reports_session=synthetic-session');
    assert.equal(outbound.headers.get('origin'), publicOrigin);
    assert.equal(outbound.headers.get('x-forwarded-host'), new URL(publicOrigin).host);
    assert.equal(outbound.headers.get('x-request-id'), 'synthetic-request');
    assert.equal(outbound.headers.get('cf-access-client-id'), 'synthetic-access-id');
    assert.equal(outbound.headers.get('cf-access-client-secret'), 'synthetic-access-secret');
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});

test('origin authorization and failure responses pass through without a second identity lookup or D1 fallback', async t => {
  let status = 401;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(`{"nativeStatus":${status}}`, { status, headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="reports"' } });
  });
  for (status of [401, 403, 409, 503]) {
    calls = 0;
    const response = await worker.fetch(new Request(publicOrigin + '/api/reports/governance/sections/signoffs', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-denied', 'Content-Type': 'application/json' }, body: '{"requestId":"synthetic"}',
    }), envWithoutGovernance());
    assert.equal(response.status, status);
    assert.equal(await response.text(), `{"nativeStatus":${status}}`);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer realm="reports"');
    assert.equal(calls, 1);
  }
});


test('retired migration route returns 404 for GET and POST without origin, asset or governance access', async t => {
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('Retired migration route must not reach the origin');
  });
  for (const method of ['GET', 'POST']) {
    const request = new Request(publicOrigin + '/__migration/reports-governance-v1?op=manifest', {
      method,
      headers: { Authorization: 'Bearer synthetic-retired-transfer', 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{"op":"secret"}' } : {}),
    });
    const response = await worker.fetch(request, envWithoutGovernance());
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});

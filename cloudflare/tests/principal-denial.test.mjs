import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../reports/worker.mjs';

for (const [status, code] of [
  [403, 'REPORT_ACCESS_REVOKED'],
  [401, 'TOKEN_EXPIRED'],
  [503, 'AUTH_UNAVAILABLE'],
  [403, 'UNEXPECTED_DENIAL'],
]) {
  test(`origin principal denial ${status}/${code} passes through unchanged`, async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return Response.json({ error: 'Synthetic denial', code }, { status });
    });
    const response = await worker.fetch(new Request('https://reports.test/api/reports/governance/signoffs?date=2026-10-14&locationId=tustin', {
      headers: { 'x-report-token': 'synthetic' },
    }), { ORIGIN_BASE_URL: 'https://origin.test' });
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assert.equal(calls, 1);
  });
}

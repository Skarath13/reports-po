import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../reports/worker.mjs';
test('existing operator maintenance fences reports, assets, auth and websocket before any binding', async () => {
  const env = new Proxy({}, { get: (_, key) => {
    if (key === 'CHECKIN_MAINTENANCE') return '1';
    throw new Error('Maintenance accessed dependency: ' + String(key));
  }});
  for (const path of ['/', '/static/test.js', '/api/reports/auth/login', '/api/reports/governance/signoffs', '/__edge/health']) {
    for (const method of ['GET', 'HEAD', 'POST']) {
      const response = await worker.fetch(new Request('https://reports.test' + path, { method }), env);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('X-Checkin-Maintenance'), '1');
      assert.equal(response.headers.get('X-Checkin-Route-Owner'), 'reports');
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  }
  assert.equal((await worker.fetch(new Request('https://reports.test/api/realtime', { headers: { Upgrade: 'websocket' } }), env)).status, 503);
});

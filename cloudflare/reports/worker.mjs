import { maintenanceResponse } from '../shared/maintenance.mjs';
import { createAppWorker } from '../shared/gateway.mjs';

export default createAppWorker({
  appName: 'checkin-reports',
  customHandler(request, _env, { jsonResponse }) {
    const held = maintenanceResponse(request, _env, 'reports');
    if (held) return held;
    if (new URL(request.url).pathname === '/__migration/reports-governance-v1') {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }
    return null;
  },
});

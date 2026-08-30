import { createAppWorker } from '../shared/gateway.mjs';
import { createGovernanceHandler } from './governance.mjs';

export default createAppWorker({
  appName: 'checkin-reports',
  customHandler: createGovernanceHandler(),
});

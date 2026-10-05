import { checkApis, checkApisResponseSchema, withoutSession } from '@mairie360/bffs-lib';
import { Router } from 'express';
import { registry } from '../openapi-registry';
import { coreApi } from '../clients/coreClient';

const router = Router();

// One `<service>: Connected | Unreachable` entry per upstream the BFF calls, probed with the same
// environment variables as the real calls (a missing CORE_API_URL is reported as unreachable).
export const CheckApisSchema = registry.register('CheckApisResponse', checkApisResponseSchema(['core_api']));

registry.registerPath({
  method: 'get',
  path: '/check_apis',
  security: [],
  tags: ['Connectivity'],
  summary: 'Checks that the upstream APIs are reachable',
  responses: {
    200: { description: 'Every upstream API is reachable', content: { 'application/json': { schema: CheckApisSchema } } },
    502: { description: 'At least one upstream API is unreachable', content: { 'application/json': { schema: CheckApisSchema } } },
  },
});

router.get('/', checkApis({ core_api: () => coreApi.health(withoutSession('CORE_API', 5_000)) }));

export default router;

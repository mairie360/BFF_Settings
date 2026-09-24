import { Router } from 'express';
import { z } from 'zod';
import { registry } from '../openapi-registry';
import { coreApi, withoutSession } from '../clients/coreClient';

const router = Router();
const CheckApisSchema = z.object({ status: z.string() }).catchall(z.string());
registry.registerPath({ method: 'get', path: '/check_apis', security: [], responses: {
  200: { description: 'Services disponibles', content: { 'application/json': { schema: CheckApisSchema } } },
  502: { description: 'Service indisponible', content: { 'application/json': { schema: CheckApisSchema } } },
} });
router.get('/', async (_req, res) => {
  const services = ["CORE_API"];
  // Le callback est asynchrone : une configuration absente est rejetée au lieu d'être levée hors du map.
  const results = await Promise.allSettled(services.map(async () => coreApi.health(withoutSession())));
  const ok = results.every((result) => result.status === 'fulfilled');
  res.status(ok ? 200 : 502).json({ status: ok ? 'OK' : 'Error', ...Object.fromEntries(services.map((service, index) => [service.toLowerCase(), results[index].status === 'fulfilled' ? 'Connected' : 'Unreachable'])) });
});
export default router;

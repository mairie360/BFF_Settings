import { Router } from 'express';
import { registry } from '../openapi-registry';
import { baseUrl } from '../clients/upstream';

const router = Router();
registry.registerPath({ method: 'get', path: '/check_apis', responses: { 200: { description: 'Services disponibles' }, 502: { description: 'Service indisponible' } } });
router.get('/', async (_req, res) => {
  const services = ["CORE_API"];
  const results = await Promise.allSettled(services.map(async (service) => {
    const response = await fetch(`${baseUrl(service)}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error('Unavailable');
  }));
  const ok = results.every((result) => result.status === 'fulfilled');
  res.status(ok ? 200 : 502).json({ status: ok ? 'OK' : 'Error', ...Object.fromEntries(services.map((service, index) => [service.toLowerCase(), results[index].status === 'fulfilled' ? 'Connected' : 'Unreachable'])) });
});
export default router;

import { Router } from 'express';
import { z } from 'zod';
import { registry } from '../openapi-registry';

const router = Router();

registry.registerPath({
  method: 'get',
  path: '/health',
  security: [],
  tags: ['Connectivity'],
  summary: "Vérifie la santé du BFF",
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
    }
  },
});

router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

export default router;
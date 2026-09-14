import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import moduleRouter from './routes/settings';

export const app = express();
app.disable('x-powered-by');

// API-only surface: no embedded content, so a hard default-src covers every route below.
// Runs first (before body parsing) so it also covers body-parse error responses; /docs opts out.
app.use((req, res, next) => {
  if (!req.path.startsWith('/docs')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }
  next();
});

app.use(express.json());
app.use(express.raw({ type: 'multipart/form-data', limit: '20mb' }));

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get(['/openapi.json', '/swagger.json'], (_req, res) => res.json(openApiDocument));
app.use('/health', healthRouter);
app.use('/check_apis', checkApis);
app.use('/settings', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, moduleRouter);
app.use((_req, res) => res.status(404).json({ error: { message: 'Route inconnue.' } }));
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  return res.status(400).json({ error: { message: 'Corps de requête invalide.' } });
});
export default app;

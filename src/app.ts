import 'dotenv/config';
import { errorHandler, noStore, notFoundHandler, parseTrustProxy } from '@mairie360/bffs-lib';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import moduleRouter from './routes/settings';

export const app = express();
// Client IP (req.ip) seen behind the ingress: see parseTrustProxy (TRUST_PROXY unset = no proxy trusted).
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
// Security headers (CSP, X-Content-Type-Options, Permissions-Policy, CORP...) and removal of
// X-Powered-By, same configuration as BFF User. Runs first (before body parsing) so it also covers
// body-parse error responses. upgrade-insecure-requests is dropped because the BFF is served over
// HTTP behind the reverse proxy.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: { 'upgrade-insecure-requests': null },
  },
}));

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get(['/openapi.json', '/swagger.json'], (_req, res) => res.json(openApiDocument));
app.use('/health', healthRouter);
app.use('/check_apis', checkApis);
// Session-bound answers must never be cached by a proxy or the browser.
app.use('/settings', noStore, moduleRouter);
// Unknown routes and every error end in the shared envelope `{ error: { code, message, details } }`:
// the status of the error is kept (400 for an unparsable body, 401, 404, 502, 503...) and anything
// unexpected becomes a 500 without leaking its message.
app.use(notFoundHandler);
app.use(errorHandler());
export default app;

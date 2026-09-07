import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';
import healthRouter from './routes/health';
import checkApis from './routes/check_apis';
import moduleRouter from './routes/settings';

export const app = express();
app.use(express.json());
app.use(express.raw({ type: 'multipart/form-data', limit: '20mb' }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get(['/openapi.json', '/swagger.json'], (_req, res) => res.json(openApiDocument));
app.use('/health', healthRouter);
app.use('/check_apis', checkApis);
app.use('/settings', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, moduleRouter);
export default app;

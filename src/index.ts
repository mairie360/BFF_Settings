import 'dotenv/config';
// Before the app: OpenTelemetry must hook Express before it is loaded (MAIR-504).
import './telemetry';
import { assertConfigured } from '@mairie360/bffs-lib';
import type { Server } from 'node:http';
import app from './app';
import { logger } from './logger';

/** Every upstream service the BFF calls: `<SERVICE>_URL` (+ optional `<SERVICE>_PORT`) must be set. */
export const UPSTREAMS = ['CORE_API'] as const;

/** Fails fast when an upstream or JWT_SECRET is not configured, then listens on `port`. */
export function start(port = Number(process.env.PORT ?? 4008)): Server {
  assertConfigured(UPSTREAMS);
  // The session tokens are verified with it (bffs-lib requireSession): without it every /settings route answers 503.
  if (!process.env.JWT_SECRET?.trim()) {
    throw new Error('Missing configuration: JWT_SECRET');
  }
  return app.listen(port, () => logger.info('server listening', { port }));
}

if (require.main === module) {
  start();
}

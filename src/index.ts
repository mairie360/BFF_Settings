import 'dotenv/config';
// Before the app: OpenTelemetry must hook Express before it is loaded (MAIR-504).
import './telemetry';
import { assertConfigured } from '@mairie360/bffs-lib';
import type { Server } from 'node:http';
import app from './app';

/** Every upstream service the BFF calls: `<SERVICE>_URL` (+ optional `<SERVICE>_PORT`) must be set. */
export const UPSTREAMS = ['CORE_API'] as const;

/** Fails fast when an upstream is not configured, then listens on `port`. */
export function start(port = Number(process.env.PORT ?? 4008)): Server {
  assertConfigured(UPSTREAMS);
  return app.listen(port, () => console.log(`Server listening on port ${port}`));
}

if (require.main === module) {
  start();
}

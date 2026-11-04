import 'dotenv/config';
// Before the app: OpenTelemetry must hook Express before it is loaded (MAIR-504).
import './telemetry';
import { assertConfigured, sessionKeysFromEnv } from '@mairie360/bffs-lib';
import type { Server } from 'node:http';
import app from './app';
import { logger } from './logger';

/** Every upstream service the BFF calls: `<SERVICE>_URL` (+ optional `<SERVICE>_PORT`) must be set. */
export const UPSTREAMS = ['CORE_API'] as const;

/**
 * Startup check: throws when an upstream is not configured or when no session key is. The session tokens are
 * verified with Core's public key `JWT_PUBLIC_KEY` (MAIR-680, bffs-lib requireSession); `JWT_SECRET` alone is still
 * accepted during the transition (HS256 tokens).
 */
export function assertStartupConfiguration(): void {
  assertConfigured(UPSTREAMS);
  let keys: ReturnType<typeof sessionKeysFromEnv>;
  try {
    keys = sessionKeysFromEnv();
  } catch {
    // The parsing detail is not needed to fix it, and the key is not logged.
    throw new Error('Invalid configuration: JWT_PUBLIC_KEY must hold Ed25519 PUBLIC KEY PEM blocks');
  }
  if (keys === undefined) {
    throw new Error('Missing configuration: JWT_PUBLIC_KEY (or JWT_SECRET during the HS256 transition)');
  }
}

/** Fails fast (assertStartupConfiguration), then listens on `port`. */
export function start(port = Number(process.env.PORT ?? 4008)): Server {
  assertStartupConfiguration();
  return app.listen(port, () => logger.info('server listening', { port }));
}

if (require.main === module) {
  start();
}

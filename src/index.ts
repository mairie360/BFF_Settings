import 'dotenv/config';
// Before the app: OpenTelemetry must hook Express before it is loaded (MAIR-504).
import './telemetry';
import { assertConfigured, gracefulShutdown, type GracefulShutdown, sessionKeysFromEnv } from '@mairie360/bffs-lib';
import type { Server } from 'node:http';
import app from './app';
import { logger } from './logger';

/** Every upstream service the BFF calls: `<SERVICE>_URL` (+ optional `<SERVICE>_PORT`) must be set. */
export const UPSTREAMS = ['CORE_API'] as const;

/**
 * Startup check: throws when an upstream is not configured or when no session key is. The session tokens are
 * verified with Core's public key `JWT_PUBLIC_KEY` (MAIR-680, bffs-lib requireSession); since bffs-lib 3, HS256
 * tokens are refused and `JWT_SECRET` is ignored, so it no longer lets the process start.
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
    throw new Error('Missing configuration: JWT_PUBLIC_KEY');
  }
}

/** Fails fast (assertStartupConfiguration), then listens on `port`. */
export function start(port = Number(process.env.PORT ?? 4008)): Server {
  assertStartupConfiguration();
  return app.listen(port, () => logger.info('server listening', { port }));
}

/** Listens and drains on SIGTERM instead of dropping the requests in flight (bffs-lib gracefulShutdown). */
export function serve(port?: number): { server: Server; shutdown: GracefulShutdown } {
  const server = start(port);
  return { server, shutdown: gracefulShutdown(server) };
}

if (require.main === module) {
  serve();
}

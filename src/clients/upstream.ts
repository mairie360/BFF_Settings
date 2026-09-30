import { HttpError } from '@mairie360/bffs-lib';
import type { Request } from 'express';

/** The caller's `Authorization: Bearer <token>` header, forwarded unchanged; 401 without one. */
export function authorization(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !/^Bearer\s+\S+$/i.test(header)) throw new HttpError(401, 'Invalid session.');
  return header;
}

/**
 * Base URL of an upstream service from `<SERVICE>_URL` (scheme optional) and `<SERVICE>_PORT`
 * (used when the URL has no port). Read on every call; 503 when the service is not configured.
 */
export function baseUrl(service: string): string {
  const configured = process.env[`${service}_URL`];
  if (!configured) throw new HttpError(503, `The ${service} service is not configured.`);
  const url = new URL(/^https?:\/\//i.test(configured) ? configured : `http://${configured}`);
  if (!url.port && process.env[`${service}_PORT`]) url.port = process.env[`${service}_PORT`]!;
  return url.toString().replace(/\/+$/, '');
}

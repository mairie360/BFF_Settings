import { HttpError } from '@mairie360/bffs-lib';
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

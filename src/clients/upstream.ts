import type { Request, Response } from 'express';

export class UpstreamError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function authorization(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !/^Bearer\s+\S+$/i.test(header)) throw new UpstreamError(401, 'Session invalide.');
  return header;
}

export function baseUrl(service: string): string {
  const configured = process.env[`${service}_URL`];
  if (!configured) throw new UpstreamError(503, `Le service ${service} n’est pas configuré.`);
  const url = new URL(/^https?:\/\//i.test(configured) ? configured : `http://${configured}`);
  if (!url.port && process.env[`${service}_PORT`]) url.port = process.env[`${service}_PORT`]!;
  return url.toString().replace(/\/+$/, '');
}

export function routeError(res: Response, error: unknown) {
  return res.status(error instanceof UpstreamError ? error.status : 502).json({
    error: { message: error instanceof UpstreamError ? error.message : 'Les données du service sont indisponibles.' },
  });
}

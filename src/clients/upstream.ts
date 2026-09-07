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

export async function upstream(req: Request, service: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', authorization(req));
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  try {
    return await fetch(`${baseUrl(service)}${path}`, {
      ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(502, `Le service ${service} est indisponible.`);
  }
}

export async function json<T>(req: Request, service: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await upstream(req, service, path, init);
  if (!response.ok) throw new UpstreamError(response.status, `Le service ${service} a répondu ${response.status}.`);
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new UpstreamError(502, `La réponse de ${service} est invalide.`); }
}

export function routeError(res: Response, error: unknown) {
  return res.status(error instanceof UpstreamError ? error.status : 502).json({
    error: { message: error instanceof UpstreamError ? error.message : 'Les données du service sont indisponibles.' },
  });
}

export async function forward(req: Request, res: Response, service: string, path: string) {
  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const response = await upstream(req, service, path, {
      method: req.method,
      ...(hasBody && req.body !== undefined ? {
        body: Buffer.isBuffer(req.body) ? Uint8Array.from(req.body).buffer : JSON.stringify(req.body),
        headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
      } : {}),
    });
    res.status(response.status);
    for (const header of ['content-type', 'content-disposition', 'etag']) {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    if (response.status === 204 || req.method === 'HEAD') return res.end();
    return res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) { return routeError(res, error); }
}

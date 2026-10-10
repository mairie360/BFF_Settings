import request from 'supertest';
import type { Express } from 'express';
import app from '../src/app';
import { bearer } from './support/core-fixtures';
import { ProfilePatchSchema } from '../src/routes/settings';

describe('application-wide security middleware', () => {
  test.each(['/health', '/unknown-route', '/settings/bootstrap'])('%s carries the strict API-only security headers and no X-Powered-By', async (pathname) => {
    const response = await request(app).get(pathname);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'");
    expect(response.headers['permissions-policy']).toBe('geolocation=(), camera=(), microphone=()');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('/docs keeps the helmet CSP so Swagger UI can load its scripts and styles', async () => {
    const response = await request(app).get('/docs/');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  test('a body-parse error also carries the API-only security headers', async () => {
    const response = await request(app).patch('/settings/profile').set('Content-Type', 'application/json').send('{not json');

    expect(response.status).toBe(400);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBe("default-src 'none'");
  });
});

describe('final handlers', () => {
  test('an unknown route answers the 404 envelope', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [] } });
  });

  test('an unparsable JSON body answers 400, not a flattened error', async () => {
    const response = await request(app).patch('/settings/profile').set('Content-Type', 'application/json').send('{not json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid request', details: [] } });
  });

  test('an unexpected error answers a generic 500 instead of 400, without its message', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const parseSpy = jest.spyOn(ProfilePatchSchema, 'safeParse').mockImplementation(() => { throw new Error('secret internal detail'); });

    const response = await request(app).patch('/settings/profile').set('Authorization', bearer()).send({ first_name: 'Anne' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: [] } });
    expect(JSON.stringify(response.body)).not.toContain('secret');
    expect(errorSpy).toHaveBeenCalled();
    parseSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('trusts no proxy unless TRUST_PROXY says so', () => {
    expect(app.get('trust proxy')).toBe(false);
  });

  test('no raw multipart body parser buffers uploads in memory', () => {
    const { router } = app as Express & { router: { stack: Array<{ name: string }> } };

    expect(router.stack.map((layer) => layer.name)).not.toContain('rawParser');
    expect(router.stack.map((layer) => layer.name)).toContain('jsonParser');
  });
});

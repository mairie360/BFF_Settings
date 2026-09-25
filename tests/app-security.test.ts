import request from 'supertest';
import type { Express } from 'express';
import app from '../src/app';

describe('application-wide security middleware', () => {
  test.each(['/health', '/unknown-route'])('%s carries the helmet security headers and no X-Powered-By', async (pathname) => {
    const response = await request(app).get(pathname);

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('a body-parse error also carries the security headers', async () => {
    const response = await request(app).patch('/settings/profile').set('Content-Type', 'application/json').send('{not json');

    expect(response.status).toBe(400);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  test('no raw multipart body parser buffers uploads in memory', () => {
    const { router } = app as Express & { router: { stack: Array<{ name: string }> } };

    expect(router.stack.map((layer) => layer.name)).not.toContain('rawParser');
    expect(router.stack.map((layer) => layer.name)).toContain('jsonParser');
  });
});

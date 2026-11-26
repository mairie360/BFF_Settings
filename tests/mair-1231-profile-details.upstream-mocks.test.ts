import path from 'node:path';
import request from 'supertest';
import app from '../src/app';
import { MAX_PHOTO_BYTES } from '../src/routes/settings';
import { ContractMockServer, type MockReply } from './support/contract-mock-server';
import { bearer, meResponse, notificationSettings, preferences, sessionsResult } from './support/core-fixtures';
import { captureLogs } from './support/logs';
import { OpenApiContract } from './support/openapi-contract';
import { loadOrvalContract } from './support/orval-contract';

// The photo, biography, function and service of the profile: Core API (simulated from its published contract)
// owns them, the BFF exposes them in its profile and relays the photo as bytes.

const coreApi = new ContractMockServer('CORE_API', loadOrvalContract('@mairie360/core-api-openapi'));
const CORE = { me: '/api/v1/user/me/', photo: '/api/v1/user/me/photo' } as const;
const bffContract = OpenApiContract.load(path.join(__dirname, '..', 'contracts', 'openapi.json'));
/** A WebP as Core checks it: RIFF size WEBP, then some payload. */
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.from('profile-photo')]);
const coreError = (status: number, raw = 'refused'): MockReply => ({ status, raw, contentType: 'text/plain; charset=utf-8', outOfContract: true });

beforeAll(async () => { await coreApi.start(); });
afterAll(async () => { await coreApi.stop(); });
beforeEach(() => {
  captureLogs();
  coreApi.reset();
  coreApi
    .on('get', '/api/v1/sessions/', { body: sessionsResult([]) })
    .on('get', '/api/v1/sessions/history', { body: sessionsResult([]) })
    .on('get', '/api/v1/user/me/preferences/', { body: preferences() })
    .on('get', '/api/v1/user/me/notifications/', { body: notificationSettings() });
  const url = new URL(coreApi.url);
  process.env.CORE_API_URL = url.hostname;
  process.env.CORE_API_PORT = url.port;
});
afterEach(() => {
  jest.restoreAllMocks();
  expect(coreApi.violations).toEqual([]);
});

function expectBffContract(method: string, pathname: string, response: request.Response) {
  const match = bffContract.match(method, pathname);
  expect(match?.template).toBe(pathname);
  const { documented, schema } = bffContract.responseSchema(match!, response.status);
  expect({ status: response.status, documented }).toEqual({ status: response.status, documented: true });
  if (schema && response.type === 'application/json') expect(bffContract.validate(schema, response.body)).toEqual([]);
}

const signedIn = (call: request.Test) => call.set('Authorization', bearer());

describe('MAIR-1231 profile details', () => {
  it('MAIR-1231 the bootstrap profile carries the biography, the function, the photo flag and the service read from Core', async () => {
    coreApi.on('get', CORE.me, { body: meResponse({ biography: 'Voirie.\nAstreinte le lundi.', job_title: 'Chef de service', has_photo: true, service: { id: 3, name: 'Voirie' } }) });

    const response = await signedIn(request(app).get('/settings/bootstrap'));

    expect(response.status).toBe(200);
    expectBffContract('get', '/settings/bootstrap', response);
    expect(response.body.profile).toMatchObject({ biography: 'Voirie.\nAstreinte le lundi.', job_title: 'Chef de service', has_photo: true, service: { id: 3, name: 'Voirie' } });
  });

  it('MAIR-1231 an agent without details reads as an empty profile, without a photo', async () => {
    coreApi.on('get', CORE.me, { body: meResponse() });

    const response = await signedIn(request(app).get('/settings/bootstrap'));

    expect(response.status).toBe(200);
    expect(response.body.profile.has_photo).toBe(false);
  });

  it('MAIR-1231 PATCH /settings/profile forwards the biography and the function, and null to remove them', async () => {
    coreApi.on('patch', CORE.me, { status: 200 }).on('get', CORE.me, { body: meResponse({ job_title: 'Chef de service', biography: null }) });

    const response = await signedIn(request(app).patch('/settings/profile').send({ job_title: 'Chef de service', biography: null }));

    expect(response.status).toBe(200);
    expectBffContract('patch', '/settings/profile', response);
    expect(coreApi.calls(CORE.me, 'patch')[0].body).toEqual({ job_title: 'Chef de service', biography: null });
    expect(response.body).toMatchObject({ job_title: 'Chef de service', biography: null });
  });

  it.each([
    ['a function over 100 characters', { job_title: 'a'.repeat(101) }, 'body.job_title'],
    ['a function on two lines', { job_title: 'Chef\nde service' }, 'body.job_title'],
    ['a biography over 1000 characters', { biography: 'b'.repeat(1001) }, 'body.biography'],
    ['a service, which only the administration sets', { service: { id: 1, name: 'Voirie' } }, 'body'],
  ])('MAIR-1231 refuses %s with a 400 before any Core call', async (_label, body, field) => {
    const response = await signedIn(request(app).patch('/settings/profile').send(body));

    expect(response.status).toBe(400);
    expect(response.body.error.details.map((detail: { path: string }) => detail.path)).toContain(field);
    expect(coreApi.requests).toEqual([]);
  });
});

describe('MAIR-1231 profile photo', () => {
  it('MAIR-1231 PUT /settings/profile/photo relays the WebP bytes to Core and answers 204', async () => {
    coreApi.on('put', CORE.photo, { status: 204 });

    const response = await signedIn(request(app).put('/settings/profile/photo').set('Content-Type', 'image/webp').send(WEBP));

    expect(response.status).toBe(204);
    const [sent] = coreApi.calls(CORE.photo, 'put');
    expect(sent.bytes?.equals(WEBP)).toBe(true);
    expect(sent.headers['content-type']).toBe('image/webp');
    expect(sent.headers.authorization).toBe(bearer());
  });

  it.each([[400, 'The photo must be a WebP image.'], [413, 'The photo is larger than 102400 bytes.']])(
    'MAIR-1231 relays a Core %s on a photo it refuses',
    async (status, message) => {
      coreApi.on('put', CORE.photo, coreError(status, message));

      const response = await signedIn(request(app).put('/settings/profile/photo').set('Content-Type', 'image/webp').send(WEBP));

      expect(response.status).toBe(status);
      expectBffContract('put', '/settings/profile/photo', response);
    },
  );

  it('MAIR-1231 refuses an empty body with 400 and a body over 100 KiB with 413, before any Core call', async () => {
    const empty = await signedIn(request(app).put('/settings/profile/photo').set('Content-Type', 'image/webp'));
    const large = await signedIn(request(app).put('/settings/profile/photo').set('Content-Type', 'image/webp').send(Buffer.alloc(MAX_PHOTO_BYTES + 1)));

    expect(empty.status).toBe(400);
    expect(large.status).toBe(413);
    expect(large.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(coreApi.requests).toEqual([]);
  });

  it('MAIR-1231 GET /settings/profile/photo serves the bytes of Core as image/webp, without caching', async () => {
    coreApi.on('get', CORE.photo, { raw: WEBP, contentType: 'image/webp' });

    const response = await signedIn(request(app).get('/settings/profile/photo')).buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/webp/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect((response.body as Buffer).equals(WEBP)).toBe(true);
  });

  it('MAIR-1231 GET /settings/profile/photo answers 404 when the agent has none', async () => {
    coreApi.on('get', CORE.photo, coreError(404, 'No photo.'));

    const response = await signedIn(request(app).get('/settings/profile/photo'));

    expect(response.status).toBe(404);
    expectBffContract('get', '/settings/profile/photo', response);
  });

  it('MAIR-1231 DELETE /settings/profile/photo removes it in Core', async () => {
    coreApi.on('delete', CORE.photo, { status: 204 });

    const response = await signedIn(request(app).delete('/settings/profile/photo'));

    expect(response.status).toBe(204);
    expect(coreApi.calls(CORE.photo, 'delete')).toHaveLength(1);
  });

  it.each([['put'], ['get'], ['delete']] as const)('MAIR-1231 %s /settings/profile/photo needs a session', async (method) => {
    const response = await request(app)[method]('/settings/profile/photo');

    expect(response.status).toBe(401);
    expect(coreApi.requests).toEqual([]);
  });
});

describe('MAIR-1231 contract mock and binary bodies', () => {
  it('MAIR-1231 reads image bytes sent to a JSON operation as JSON, so they are reported', async () => {
    coreApi.on('patch', CORE.me, { status: 200 });

    await fetch(new URL(CORE.me, coreApi.url), { method: 'PATCH', headers: { 'Content-Type': 'image/webp' }, body: new Uint8Array(WEBP) });

    expect(coreApi.violations).toEqual([expect.stringContaining('corps JSON invalide')]);
    coreApi.violations.length = 0;
  });
});

import path from 'node:path';
import request from 'supertest';
import app from '../src/app';
import { ContractMockServer, unreachableUrl, type MockReply } from './support/contract-mock-server';
import {
  PREFERENCE_SECTIONS, SESSION_42, SESSION_ANNE, bearer, coreApiUrls, meResponse, notificationSettings, patchMe, preferences, profileOf, session, sessionsResult,
} from './support/core-fixtures';
import { OpenApiContract } from './support/openapi-contract';
import { loadOrvalContract } from './support/orval-contract';

// The whole application is tested with the real client against a real HTTP server simulating Core API. Its contract
// is rebuilt from the installed @mairie360/core-api-openapi package (version pinned in package.json): the mock
// refuses routes, parameters and bodies absent from the contract and validates its success answers. Errors are not
// typed by orval: every simulated error answer is marked `outOfContract`. Every BFF answer is validated against
// contracts/openapi.json. Simulated bodies are typed by the generated models and the expected paths come from the
// URL helpers of the generated client.

const coreApi = new ContractMockServer('CORE_API', loadOrvalContract('@mairie360/core-api-openapi'));
// Core API contract templates (mock keys); the concrete expected paths come from coreApiUrls.
const CORE = {
  me: '/api/v1/user/me/',
  sessions: '/api/v1/sessions/',
  preferences: '/api/v1/user/me/preferences/',
  notifications: '/api/v1/user/me/notifications/',
  health: '/health',
} as const;
// What the bootstrap answers for the default preference mocks (beforeEach).
const STORED = {
  appearance: { theme: 'dark', font_family: 'Marianne', font_size: 16, density: 'compact' },
  general: { language: 'fr', timezone: 'Europe/Paris', date_format: 'DD/MM/YYYY', home_page: '/dashboard', auto_open_notifications: false },
  notifications: { email: true, push: false, desktop: true, messages: true, projects: true, calendar: false },
} as const;
const ALL_AVAILABLE = { sessions: 'available', preferences: 'available', notifications: 'available' } as const;
/** Calls received by Core API, as `METHOD path` (path as built by the generated client). */
const upstreamSequence = () => coreApi.requests.map((call) => `${call.method} ${call.url.pathname}`);
const called = (method: string, url: string) => `${method} ${url}`;
const bffContract = OpenApiContract.load(path.join(__dirname, '..', 'contracts', 'openapi.json'));

beforeAll(async () => { await coreApi.start(); });
afterAll(async () => { await coreApi.stop(); });
beforeEach(() => {
  coreApi.reset();
  // The bootstrap reads them on every call: tests about them override these replies.
  coreApi.on('get', CORE.preferences, { body: preferences() }).on('get', CORE.notifications, { body: notificationSettings() });
  // baseUrl() reads CORE_API_URL and CORE_API_PORT again on every request: no module reload.
  const url = new URL(coreApi.url);
  process.env.CORE_API_URL = url.hostname;
  process.env.CORE_API_PORT = url.port;
});
afterEach(() => {
  expect(coreApi.violations).toEqual([]);
});

function expectBffContract(method: string, pathname: string, response: request.Response) {
  const match = bffContract.match(method, pathname);
  expect(match?.template).toBeDefined();
  const { documented, schema } = bffContract.responseSchema(match!, response.status);
  expect({ status: response.status, documented }).toEqual({ status: response.status, documented: true });
  if (schema && response.type === 'application/json') expect(bffContract.validate(schema, response.body)).toEqual([]);
}

/** Core API error: not typed by orval, so out of contract. Core answers plain text (actix ResponseError). */
const coreError = (status: number, raw = 'An error occurred while accessing the database.'): MockReply =>
  ({ status, raw, contentType: 'text/plain; charset=utf-8', outOfContract: true });

const without = <T extends object>(value: T, key: keyof T) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

const withSession = (call: request.Test, token?: string) => call.set('Authorization', bearer(token));

async function withUnreachableCore() {
  const url = new URL(await unreachableUrl());
  process.env.CORE_API_URL = url.hostname;
  process.env.CORE_API_PORT = url.port;
}

const BFF_ROUTES = [
  { method: 'get', path: '/settings/bootstrap', body: undefined },
  { method: 'patch', path: '/settings/profile', body: { first_name: 'Anne' } },
] as const;

function call(route: (typeof BFF_ROUTES)[number], authorization?: string) {
  let test = route.method === 'get' ? request(app).get(route.path) : request(app).patch(route.path).send(route.body);
  if (authorization) test = test.set('Authorization', authorization);
  return test;
}

describe('BFF Settings with a contract-driven Core API mock', () => {
  describe('session guard on every /settings route', () => {
    test.each(BFF_ROUTES.flatMap((route) => [
      { ...route, label: 'no Authorization header', authorization: undefined },
      { ...route, label: 'a non-Bearer scheme', authorization: 'Basic YW5uZTpzZWNyZXQ=' },
      { ...route, label: 'an empty Bearer token', authorization: 'Bearer ' },
    ]))('$method $path answers 401 without calling Core for $label', async (route) => {
      const response = await call(route, route.authorization);

      expect(response.status).toBe(401);
      expectBffContract(route.method, route.path, response);
      expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid session.', details: [] } });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(coreApi.requests).toHaveLength(0);
    });

    test.each(BFF_ROUTES.flatMap((route) => [
      { ...route, label: 'an accessToken cookie', header: ['Cookie', `accessToken=${SESSION_ANNE}`] as const },
      { ...route, label: 'a session cookie', header: ['Cookie', `session=${SESSION_ANNE}`] as const },
      { ...route, label: 'an x-session-token header', header: ['x-session-token', SESSION_ANNE] as const },
    ]))('$method $path ignores $label and answers 401 without calling Core', async (route) => {
      const response = await call(route).set(route.header[0], route.header[1]);

      expect(response.status).toBe(401);
      expectBffContract(route.method, route.path, response);
      expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Invalid session.', details: [] } });
      expect(coreApi.requests).toHaveLength(0);
    });

    test('forwards the token normalised to `Bearer <token>`', async () => {
      coreApi
        .on('get', CORE.me, { body: meResponse() })
        .on('get', CORE.sessions, { body: sessionsResult([]) });

      const response = await request(app).get('/settings/bootstrap').set('Authorization', `bearer \t${SESSION_42}`);

      expect(response.status).toBe(200);
      expect(coreApi.requests.map((upstream) => upstream.headers.authorization)).toEqual(Array(4).fill(bearer(SESSION_42)));
    });

    test.each(BFF_ROUTES)('$method $path answers 503 when Core API is not configured', async (route) => {
      delete process.env.CORE_API_URL;

      const response = await call(route, bearer());

      expect(response.status).toBe(503);
      expectBffContract(route.method, route.path, response);
      expect(response.body).toEqual({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The CORE_API service is not configured.', details: [] } });
    });

    test.each(BFF_ROUTES)('$method $path answers 502 when Core API is unreachable', async (route) => {
      await withUnreachableCore();

      const response = await call(route, bearer());

      expect(response.status).toBe(502);
      expectBffContract(route.method, route.path, response);
      expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'The CORE_API service is unavailable.', details: [] } });
    });
  });

  describe('GET /settings/bootstrap', () => {
    test('aggregates GET /api/v1/user/me/ and GET /api/v1/sessions/ with the caller session', async () => {
      const me = meResponse();
      const sessions = [session('s-1'), session('s-2', { revoked_at: '2026-09-16T08:00:00Z' })];
      coreApi
        .on('get', CORE.me, { body: me })
        .on('get', CORE.sessions, { body: sessionsResult(sessions) });

      const response = await withSession(request(app).get('/settings/bootstrap'), SESSION_42);

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.headers['cache-control']).toBe('no-store');
      // Core's groups, role and status do not leave the BFF.
      expect(response.body).toEqual({ profile: profileOf(me), sessions, ...STORED, sources: ALL_AVAILABLE });
      // The profile first (required), then the optional reads in parallel.
      expect(upstreamSequence()[0]).toBe(called('GET', coreApiUrls.getGetMeUrl()));
      expect(upstreamSequence().slice(1).sort()).toEqual([
        called('GET', coreApiUrls.getGetActiveSessionsUrl()),
        called('GET', coreApiUrls.getGetMyNotificationSettingsUrl()),
        called('GET', coreApiUrls.getGetMyPreferencesUrl()),
      ].sort());
      for (const upstream of coreApi.requests) {
        expect(upstream.headers.authorization).toBe(bearer(SESSION_42));
        expect(upstream.headers.accept).toBe('application/json');
        expect(upstream.undeclaredQuery).toEqual([]);
        expect(upstream.body).toBeUndefined();
      }
    });

    test('strips internal session fields sent by Core', async () => {
      coreApi
        .on('get', CORE.me, { body: meResponse() })
        .on('get', CORE.sessions, { body: { sessions: [{ ...session('s-1'), token_hash: 'hash-interne', user_id: 2 }] } });

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body.sessions).toEqual([session('s-1')]);
    });

    test('keeps a null phone and accepts a profile without phone', async () => {
      const me = meResponse({ phone: null, phone_country: null, groups: [] });
      coreApi.on('get', CORE.me, { body: me }).on('get', CORE.sessions, { body: sessionsResult([]) });

      const nullPhone = await withSession(request(app).get('/settings/bootstrap'));
      expect(nullPhone.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', nullPhone);
      expect(nullPhone.body.profile).toEqual({ ...profileOf(me), phone: null });

      coreApi.on('get', CORE.me, { body: without(without(me, 'phone'), 'phone_country') });
      const missingPhone = await withSession(request(app).get('/settings/bootstrap'));
      expect(missingPhone.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', missingPhone);
      expect(missingPhone.body).toEqual({
        profile: { first_name: me.first_name, last_name: me.last_name, email: me.email }, sessions: [], ...STORED, sources: ALL_AVAILABLE,
      });
    });

    test.each<[string, MockReply]>([
      ['a Core 500', coreError(500)],
      ['a Core 401', coreError(401, '')],
      ['a body that is not { sessions }', { body: { roles: [] }, outOfContract: true }],
      ['a session missing required fields', { body: { sessions: [{ id: 's-1' }] }, outOfContract: true }],
      ['invalid JSON', { raw: '{"sessions": [', outOfContract: true }],
      ['a dropped connection', { dropConnection: true }],
    ])('still returns the profile with sessions marked unavailable on %s', async (_label, reply) => {
      const me = meResponse();
      coreApi.on('get', CORE.me, { body: me }).on('get', CORE.sessions, reply);

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ profile: profileOf(me), sessions: [], ...STORED, sources: { ...ALL_AVAILABLE, sessions: 'unavailable' } });
    });

    test.each<[string, MockReply]>([
      ['a Core 500', coreError(500)],
      ['a Core 401', coreError(401, '')],
      ['an unknown theme', { body: { theme: 'neon' }, outOfContract: true }],
      ['invalid JSON', { raw: '{"theme": ', outOfContract: true }],
      ['a dropped connection', { dropConnection: true }],
    ])('marks the preferences unavailable on %s and keeps the rest', async (_label, reply) => {
      const me = meResponse();
      coreApi.on('get', CORE.me, { body: me }).on('get', CORE.sessions, { body: sessionsResult([]) }).on('get', CORE.preferences, reply);

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({
        profile: profileOf(me), sessions: [], appearance: null, general: null, notifications: STORED.notifications,
        sources: { ...ALL_AVAILABLE, preferences: 'unavailable' },
      });
    });

    test.each<[string, MockReply]>([
      ['a Core 500', coreError(500)],
      ['a non-boolean setting', { body: { email: 'yes' }, outOfContract: true }],
      ['a dropped connection', { dropConnection: true }],
    ])('marks the notification settings unavailable on %s and keeps the rest', async (_label, reply) => {
      const me = meResponse();
      coreApi.on('get', CORE.me, { body: me }).on('get', CORE.sessions, { body: sessionsResult([]) }).on('get', CORE.notifications, reply);

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({
        profile: profileOf(me), sessions: [], appearance: STORED.appearance, general: STORED.general, notifications: null,
        sources: { ...ALL_AVAILABLE, notifications: 'unavailable' },
      });
    });

    test('answers null for the preferences a user never saved (application defaults)', async () => {
      coreApi
        .on('get', CORE.me, { body: meResponse() })
        .on('get', CORE.sessions, { body: sessionsResult([]) })
        .on('get', CORE.preferences, { body: { theme: null, font_size: 14 } })
        .on('get', CORE.notifications, { body: {} });

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body.appearance).toEqual({ theme: null, font_family: null, font_size: 14, density: null });
      expect(response.body.general).toEqual({ language: null, timezone: null, date_format: null, home_page: null, auto_open_notifications: null });
      expect(response.body.notifications).toEqual({ email: null, push: null, desktop: null, messages: null, projects: null, calendar: null });
    });

    // A well-signed token Core refuses (revoked session): the BFF cannot know it, Core's 401 is kept.
    test('preserves a Core 401 on the profile without reading sessions', async () => {
      coreApi.on('get', CORE.me, coreError(401, ''));

      const response = await withSession(request(app).get('/settings/bootstrap'), SESSION_42);

      expect(response.status).toBe(401);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: [] } });
      expect(coreApi.calls(CORE.sessions)).toHaveLength(0);
    });

    test.each([403, 404, 409])('turns an undeclared Core %i on the profile into a 502', async (status) => {
      coreApi.on('get', CORE.me, coreError(status, 'Forbidden'));

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(502);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'Upstream service error', details: [] } });
    });

    test.each<[string, MockReply, string]>([
      ['a Core 500', coreError(500), 'Upstream service error'],
      ['a Core 503', coreError(503, 'Service Unavailable'), 'Upstream service error'],
      ['invalid JSON', { raw: '<html>proxy</html>', contentType: 'text/html', outOfContract: true }, 'The CORE_API answer is invalid.'],
      ['a dropped connection', { dropConnection: true }, 'The CORE_API service is unavailable.'],
    ])('maps %s on the profile to 502 without leaking the upstream body', async (_label, reply, message) => {
      coreApi.on('get', CORE.me, reply);

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(502);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message, details: [] } });
      expect(JSON.stringify(response.body)).not.toMatch(/database|proxy/);
      expect(coreApi.calls(CORE.sessions)).toHaveLength(0);
    });

    test.each<[string, MockReply, number]>([
      ['a Core 503', coreError(503, 'Service Unavailable'), 2],
      ['a dropped connection', { dropConnection: true }, 2],
      ['a Core 500', coreError(500), 1],
      ['a Core 401', coreError(401, ''), 1],
    ])('retries the idempotent profile read only on a transient failure (%s)', async (_label, reply, attempts) => {
      coreApi.on('get', CORE.me, reply);

      await withSession(request(app).get('/settings/bootstrap'));

      expect(coreApi.calls(CORE.me, 'get')).toHaveLength(attempts);
    });

    test('answers 502 instead of a partial profile when Core omits a required field', async () => {
      coreApi.on('get', CORE.me, { body: without(meResponse(), 'email'), outOfContract: true });

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(502);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'The CORE_API answer is invalid.', details: [] } });
    });
  });

  describe('PATCH /settings/profile', () => {
    test.each([
      ['200 without body, as Core API does', { status: 200 }],
      ['204', { status: 204 }],
    ] as const)('sends the patch to PATCH /api/v1/user/me/, accepts a %s and returns the re-read profile', async (_label, patchReply) => {
      const patch = patchMe({ first_name: 'Anne Marie', last_name: 'Le Gall', email: 'anne.marie@mairie.test', current_password: 'Anne-Password-1', phone: '0987654321' });
      // The re-read profile wins, even when it differs from what was sent (normalised by Core).
      const persisted = meResponse({ first_name: 'Anne Marie', last_name: 'LE GALL', email: 'anne.marie@mairie.test', phone: '0987654321' });
      // The e-mail is compared with the current one first (GET), then the profile is re-read after the PATCH.
      let reads = 0;
      coreApi
        .on('patch', CORE.me, patchReply)
        .on('get', CORE.me, () => ({ body: reads++ === 0 ? meResponse() : persisted }));

      const response = await withSession(request(app).patch('/settings/profile').send(patch), SESSION_42);

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(profileOf(persisted));
      expect(upstreamSequence()).toEqual([
        called('GET', coreApiUrls.getGetMeUrl()), called('PATCH', coreApiUrls.getPatchMeUrl()), called('GET', coreApiUrls.getGetMeUrl()),
      ]);
      const [, sent, reread] = coreApi.requests;
      expect(sent.body).toEqual(patch);
      expect(sent.headers['content-type']).toBe('application/json');
      expect(sent.headers.authorization).toBe(bearer(SESSION_42));
      expect(reread.headers.authorization).toBe(bearer(SESSION_42));
      expect(reread.body).toBeUndefined();
    });

    test.each([
      ['a single field', patchMe({ last_name: 'Le Gall-Martin' }), meResponse({ last_name: 'Le Gall-Martin' })],
      ['a phone removal', patchMe({ phone: null }), meResponse({ phone: null })],
    ])('forwards only %s', async (_label, patch, persisted) => {
      coreApi.on('patch', CORE.me, { status: 200 }).on('get', CORE.me, { body: persisted });

      const response = await withSession(request(app).patch('/settings/profile').send(patch));

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(coreApi.calls(CORE.me, 'patch')[0].body).toEqual(patch);
    });

    test('does not forward an unchanged e-mail and needs no current password for it', async () => {
      const current = meResponse();
      const persisted = meResponse({ first_name: 'Annie' });
      let reads = 0;
      coreApi
        .on('patch', CORE.me, { status: 200 })
        .on('get', CORE.me, () => ({ body: reads++ === 0 ? current : persisted }));
      // The form sends the whole profile, with the current e-mail typed differently.
      const form = { first_name: 'Annie', last_name: current.last_name, email: `  ${current.email.toUpperCase()} `, phone: current.phone };

      const response = await withSession(request(app).patch('/settings/profile').send(form));

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual(profileOf(persisted));
      expect(coreApi.calls(CORE.me, 'patch')[0].body).toEqual({ first_name: 'Annie', last_name: current.last_name, phone: current.phone });
    });

    test('answers the current profile without PATCH when only an unchanged e-mail is sent', async () => {
      const current = meResponse();
      coreApi.on('get', CORE.me, { body: current });

      const response = await withSession(request(app).patch('/settings/profile').send({ email: current.email, current_password: 'Anne-Password-1' }));

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual(profileOf(current));
      expect(upstreamSequence()).toEqual([called('GET', coreApiUrls.getGetMeUrl())]);
    });

    test('rejects a changed e-mail without the current password with 400 and does not call PATCH', async () => {
      coreApi.on('get', CORE.me, { body: meResponse() });

      const response = await withSession(request(app).patch('/settings/profile').send({ first_name: 'Anne', email: 'anne.new@mairie.test' }));

      expect(response.status).toBe(400);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: [
        { path: 'body.current_password', message: 'Required when email is changed' },
      ] } });
      expect(coreApi.calls(CORE.me, 'patch')).toHaveLength(0);
    });

    test('forwards a changed e-mail with the current password', async () => {
      const persisted = meResponse({ email: 'anne.new@mairie.test' });
      let reads = 0;
      coreApi
        .on('patch', CORE.me, { status: 200 })
        .on('get', CORE.me, () => ({ body: reads++ === 0 ? meResponse() : persisted }));

      const response = await withSession(request(app).patch('/settings/profile').send({ email: 'anne.new@mairie.test', current_password: 'Anne-Password-1' }));

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual(profileOf(persisted));
      expect(coreApi.calls(CORE.me, 'patch')[0].body).toEqual({ email: 'anne.new@mairie.test', current_password: 'Anne-Password-1' });
    });

    // Core API (MAIR-480) parses the number as typed against its country and answers it in E.164.
    test.each([
      ['a national number with its country', { phone: '06 12 34.56-78', phone_country: 'FR' }],
      ['an E.164 number', { phone: '+33612345678' }],
      ['a null phone, which clears it', { phone: null }],
      ['an empty phone, which clears it', { phone: '' }],
    ])('forwards %s to Core API as typed', async (_label, body) => {
      const persisted = meResponse({ phone: '+33612345678', phone_country: 'FR' });
      coreApi.on('patch', CORE.me, { status: 200 }).on('get', CORE.me, { body: persisted });

      const response = await withSession(request(app).patch('/settings/profile').send(body));

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(coreApi.calls(CORE.me, 'patch')[0].body).toEqual(body);
      expect(response.body).toMatchObject({ phone: '+33612345678', phone_country: 'FR' });
    });

    test.each([
      ['an empty body', {}],
      ['unsupported fields', { fullName: 'Anne Marie Le Gall', roles: ['Admin'] }],
      ['a known field mixed with an unsupported one', { first_name: 'Anne', status: 'archived' }],
      ['an invalid e-mail', { email: 'anne-at-mairie' }],
      ['a wrong type', { first_name: 42 }],
      ['a name longer than its column', { last_name: 'x'.repeat(65) }],
      ['markup in a name', { first_name: '<script>alert(1)</script>' }],
      ['a phone that is not a number', { phone: '../../etc/passwd' }],
      ['a phone longer than Core accepts', { phone: '0'.repeat(33) }],
      ['a + inside the phone', { phone: '06+12345678' }],
      ['a lower-case country', { phone: '0612345678', phone_country: 'fr' }],
      ['a country that is not a code', { phone: '0612345678', phone_country: 'FRA' }],
      // Core API >= 2.0 (MAIR-390) needs the current password to change the e-mail address.
      ['an empty current password', { email: 'anne@mairie.test', current_password: '' }],
      ['only the current password', { current_password: 'Anne-Password-1' }],
      ['a JSON array', [{ first_name: 'Anne' }]],
    ])('rejects %s with 400 without calling Core', async (_label, body) => {
      const response = await withSession(request(app).patch('/settings/profile').send(body));

      expect(response.status).toBe(400);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body.error).toMatchObject({ code: 'BAD_REQUEST', message: 'Validation failed' });
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(coreApi.requests).toHaveLength(0);
    });

    test('lists the invalid fields in details', async () => {
      const response = await withSession(request(app).patch('/settings/profile').send({ email: 'anne-at-mairie', status: 'archived' }));

      expect(response.status).toBe(400);
      expect(response.body.error.details).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'body.email' }),
        expect.objectContaining({ path: 'body' }),
      ]));
    });

    test('answers an empty body with a detail naming the accepted fields', async () => {
      const response = await withSession(request(app).patch('/settings/profile').send({}));

      expect(response.status).toBe(400);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Validation failed', details: [
        { path: 'body', message: 'Expected at least one of first_name, last_name, email, phone, phone_country' },
      ] } });
      expect(coreApi.requests).toHaveLength(0);
    });

    test('does not retry the PATCH on a transient Core failure', async () => {
      coreApi.on('patch', CORE.me, coreError(503, 'Service Unavailable'));

      const response = await withSession(request(app).patch('/settings/profile').send({ first_name: 'Anne' }));

      expect(response.status).toBe(502);
      expect(coreApi.calls(CORE.me, 'patch')).toHaveLength(1);
      expect(coreApi.calls(CORE.me, 'get')).toHaveLength(0);
    });

    test('rejects a malformed JSON body with 400', async () => {
      const response = await withSession(request(app).patch('/settings/profile').set('Content-Type', 'application/json').send('{"first_name":'));

      expect(response.status).toBe(400);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid request', details: [] } });
      expect(coreApi.requests).toHaveLength(0);
    });

    test.each<[string, MockReply, number, string, string]>([
      ['a Core 401', coreError(401, ''), 401, 'UNAUTHORIZED', 'Authentication required'],
      ['a Core 400', coreError(400, 'Json deserialize error'), 400, 'BAD_REQUEST', 'Invalid request'],
      ['an undeclared Core 404', coreError(404, 'Not Found'), 502, 'BAD_GATEWAY', 'Upstream service error'],
      ['a Core 403 (wrong current password)', coreError(403, 'The current password is incorrect.'), 403, 'FORBIDDEN', 'Access denied'],
      ['a Core 409 (e-mail already used)', coreError(409, 'Conflict'), 409, 'CONFLICT', 'Conflict with the current state of the resource'],
      ['a Core 500', coreError(500), 502, 'BAD_GATEWAY', 'Upstream service error'],
    ])('does not report a save and does not re-read on %s', async (_label, reply, status, code, message) => {
      coreApi.on('patch', CORE.me, reply);

      const response = await withSession(request(app).patch('/settings/profile').send({ first_name: 'Anne' }));

      expect(response.status).toBe(status);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { code, message, details: [] } });
      expect(coreApi.calls(CORE.me, 'get')).toHaveLength(0);
    });

    test('answers 502 when the saved profile cannot be re-read', async () => {
      coreApi.on('patch', CORE.me, { status: 200 }).on('get', CORE.me, coreError(500));

      const response = await withSession(request(app).patch('/settings/profile').send({ first_name: 'Anne' }));

      expect(response.status).toBe(502);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { code: 'BAD_GATEWAY', message: 'Upstream service error', details: [] } });
    });
  });

  describe('PATCH /settings/{appearance,general,notifications}', () => {
    const PATCHES = {
      appearance: { theme: 'light', font_size: 18 },
      general: { language: 'en', auto_open_notifications: true, home_page: null },
      notifications: { email: false, calendar: true, push: null },
    } as const;

    test.each(PREFERENCE_SECTIONS)('/settings/$section sends the patch to PATCH $template and answers the stored section', async ({ section, template, fields }) => {
      const patch = PATCHES[section];
      const stored: Record<string, unknown> = { ...(template === CORE.preferences ? preferences() : notificationSettings()), ...patch };
      coreApi.on('patch', template, { body: stored });

      const response = await withSession(request(app).patch(`/settings/${section}`).send(patch), SESSION_42);

      expect(response.status).toBe(200);
      expectBffContract('patch', `/settings/${section}`, response);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(Object.fromEntries(fields.map((field) => [field, stored[field] ?? null])));
      expect(upstreamSequence()).toEqual([called('PATCH', template)]);
      const [sent] = coreApi.requests;
      expect(sent.body).toEqual(patch);
      expect(sent.headers.authorization).toBe(bearer(SESSION_42));
    });

    test.each([
      ['appearance', 'an empty body', {}],
      ['appearance', 'a field of another section', { language: 'fr' }],
      ['appearance', 'an unknown theme', { theme: 'neon' }],
      ['appearance', 'a font size out of range', { font_size: 40000 }],
      ['appearance', 'a decimal font size', { font_size: 12.5 }],
      ['appearance', 'a blank font family', { font_family: '   ' }],
      ['appearance', 'a density the front does not offer', { density: 'appearance' }],
      ['general', 'an empty body', {}],
      ['general', 'a field of another section', { theme: 'dark' }],
      ['general', 'a language that is not a language code', { language: 'general' }],
      ['general', 'a language with a lowercase region', { language: 'fr-fr' }],
      ['general', 'a date format the front does not offer', { date_format: 'general' }],
      ['general', 'a control character', { timezone: 'Europe/\u0000Paris' }],
      ['general', 'a non-boolean flag', { auto_open_notifications: 'yes' }],
      ['notifications', 'an empty body', {}],
      ['notifications', 'an unknown channel', { sms: true }],
      ['notifications', 'a non-boolean setting', { email: 'yes' }],
      ['notifications', 'a JSON array', [{ email: true }]],
    ])('/settings/%s rejects %s with 400 without calling Core', async (section, _label, body) => {
      const response = await withSession(request(app).patch(`/settings/${section}`).send(body));

      expect(response.status).toBe(400);
      expectBffContract('patch', `/settings/${section}`, response);
      expect(response.body.error).toMatchObject({ code: 'BAD_REQUEST', message: 'Validation failed' });
      expect(coreApi.requests).toHaveLength(0);
    });

    test.each<[string, MockReply, number, string]>([
      ['a Core 400', coreError(400, 'Invalid `theme`'), 400, 'BAD_REQUEST'],
      ['a Core 401', coreError(401, ''), 401, 'UNAUTHORIZED'],
      ['an undeclared Core 404', coreError(404, 'Not Found'), 502, 'BAD_GATEWAY'],
      ['a Core 500', coreError(500), 502, 'BAD_GATEWAY'],
      ['an invalid answer', { body: { theme: 'neon' }, outOfContract: true }, 502, 'BAD_GATEWAY'],
    ])('maps %s on PATCH /settings/appearance without retrying', async (_label, reply, status, code) => {
      coreApi.on('patch', CORE.preferences, reply);

      const response = await withSession(request(app).patch('/settings/appearance').send({ theme: 'dark' }));

      expect(response.status).toBe(status);
      expectBffContract('patch', '/settings/appearance', response);
      expect(response.body.error.code).toBe(code);
      expect(JSON.stringify(response.body)).not.toMatch(/database/);
      expect(coreApi.calls(CORE.preferences, 'patch')).toHaveLength(1);
    });

    test.each(PREFERENCE_SECTIONS)('/settings/$section answers 401 without calling Core and no session', async ({ section }) => {
      const response = await request(app).patch(`/settings/${section}`).send({});

      expect(response.status).toBe(401);
      expectBffContract('patch', `/settings/${section}`, response);
      expect(coreApi.requests).toHaveLength(0);
    });
  });

  describe('GET /check_apis', () => {
    test('reports Core API connected when GET /health answers', async () => {
      coreApi.on('get', CORE.health, { raw: 'OK', contentType: 'text/plain' });

      const response = await request(app).get('/check_apis');

      expect(response.status).toBe(200);
      expectBffContract('get', '/check_apis', response);
      expect(response.body).toEqual({ status: 'OK', core_api: 'Connected' });
      const [health] = coreApi.calls(CORE.health, 'get');
      expect(coreApi.requests).toHaveLength(1);
      // Availability probe: no session is forwarded.
      expect(health.headers.authorization).toBeUndefined();
    });

    test.each<[string, () => Promise<void>]>([
      ['answers 500', async () => { coreApi.on('get', CORE.health, coreError(500)); }],
      ['drops the connection', async () => { coreApi.on('get', CORE.health, { dropConnection: true }); }],
      ['is unreachable', withUnreachableCore],
      ['is not configured', async () => { delete process.env.CORE_API_URL; }],
    ])('reports Core API unreachable with 502 when it %s', async (_label, arrange) => {
      await arrange();

      const response = await request(app).get('/check_apis');

      expect(response.status).toBe(502);
      expectBffContract('get', '/check_apis', response);
      expect(response.body).toEqual({ status: 'Error', core_api: 'Unreachable' });
    });
  });
});

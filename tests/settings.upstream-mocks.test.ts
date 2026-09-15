import path from 'node:path';
import request from 'supertest';
import app from '../src/app';
import { ContractMockServer, unreachableUrl, type MockReply } from './support/contract-mock-server';
import { PREFERENCE_TARGETS, bearer, meResponse, profileOf, session } from './support/core-fixtures';
import { OpenApiContract } from './support/openapi-contract';
import { loadOrvalContract } from './support/orval-contract';

// Toute l'application est testée avec le vrai client fetch contre un vrai serveur HTTP simulant Core API. Son contrat
// est reconstruit depuis le paquet @mairie360/core-api-openapi installé (version épinglée dans package.json) : le mock
// refuse les routes, paramètres et corps absents du contrat et valide ses réponses de succès. Les erreurs ne sont pas
// typées par orval : toute réponse d'erreur simulée est marquée `outOfContract`. Chaque réponse du BFF est validée
// contre contracts/openapi.json.

const coreApi = new ContractMockServer('CORE_API', loadOrvalContract('@mairie360/core-api-openapi'))
  .allowDeviation(
    /réponse 200 GET \/api\/v1\/sessions\/ \$\.roles: propriété requise manquante/,
    // Core API renvoie { sessions } (Core_API src/endpoints/v1/sessions/get/response_view.rs), mais orval a fusionné
    // les deux structs Rust GetResponseView et type la réponse comme la liste des rôles.
    'Contrat Core API erroné sur la réponse de GET /api/v1/sessions/',
  )
  .allowDeviation(
    /requête PATCH \/api\/v1\/user\/me\/(notification-settings|preferences)\/ : .* n'existe pas dans le contrat core_api/,
    // Les adaptateurs de préférences visent des routes que Core API 1.1.1 ne sert pas encore : le mock répond 404
    // comme Core, et le BFF doit relayer ce 404 sans simuler de sauvegarde (vérifié dans upstream-contracts.test.ts).
    'Routes de préférences absentes de Core API 1.1.1',
  );
const bffContract = OpenApiContract.load(path.join(__dirname, '..', 'contracts', 'openapi.json'));

beforeAll(async () => { await coreApi.start(); });
afterAll(async () => { await coreApi.stop(); });
beforeEach(() => {
  coreApi.reset();
  // baseUrl() relit CORE_API_URL et CORE_API_PORT à chaque requête : pas de rechargement de module.
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

/** Erreur Core API : non typée par orval, donc hors contrat. Core renvoie un texte brut (ResponseError actix). */
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
  ...PREFERENCE_TARGETS.map(({ section }) => ({ method: 'patch', path: `/settings/${section}`, body: { theme: 'dark' } })),
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
      expect(response.body).toEqual({ error: { message: 'Session invalide.' } });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(coreApi.requests).toHaveLength(0);
    });

    test.each(BFF_ROUTES)('$method $path answers 503 when Core API is not configured', async (route) => {
      delete process.env.CORE_API_URL;

      const response = await call(route, bearer());

      expect(response.status).toBe(503);
      expectBffContract(route.method, route.path, response);
      expect(response.body).toEqual({ error: { message: 'Le service CORE_API n’est pas configuré.' } });
    });

    test.each(BFF_ROUTES)('$method $path answers 502 when Core API is unreachable', async (route) => {
      await withUnreachableCore();

      const response = await call(route, bearer());

      expect(response.status).toBe(502);
      expectBffContract(route.method, route.path, response);
      expect(response.body).toEqual({ error: { message: 'Le service CORE_API est indisponible.' } });
    });
  });

  describe('GET /settings/bootstrap', () => {
    test('aggregates GET /api/v1/user/me/ and GET /api/v1/sessions/ with the caller session', async () => {
      const me = meResponse();
      const sessions = [session('s-1'), session('s-2', { revoked_at: '2026-09-16T08:00:00Z' })];
      coreApi
        .on('get', '/api/v1/user/me/', { body: me })
        .on('get', '/api/v1/sessions/', { body: { sessions } });

      const response = await withSession(request(app).get('/settings/bootstrap'), 'session-42');

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.headers['cache-control']).toBe('no-store');
      // groups, role et status de Core ne sortent pas du BFF.
      expect(response.body).toEqual({ profile: profileOf(me), sessions, sources: { sessions: 'available' } });
      expect(coreApi.requests.map(({ method, template }) => `${method} ${template}`))
        .toEqual(['GET /api/v1/user/me/', 'GET /api/v1/sessions/']);
      for (const upstream of coreApi.requests) {
        expect(upstream.headers.authorization).toBe(bearer('session-42'));
        expect(upstream.headers.accept).toBe('application/json');
        expect(upstream.undeclaredQuery).toEqual([]);
        expect(upstream.body).toBeUndefined();
      }
    });

    test('strips internal session fields sent by Core', async () => {
      coreApi
        .on('get', '/api/v1/user/me/', { body: meResponse() })
        .on('get', '/api/v1/sessions/', { body: { sessions: [{ ...session('s-1'), token_hash: 'hash-interne', user_id: 2 }] } });

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body.sessions).toEqual([session('s-1')]);
    });

    test('keeps a null phone and accepts a profile without phone', async () => {
      const me = meResponse({ phone: null, groups: [] });
      coreApi.on('get', '/api/v1/user/me/', { body: me }).on('get', '/api/v1/sessions/', { body: { sessions: [] } });

      const nullPhone = await withSession(request(app).get('/settings/bootstrap'));
      expect(nullPhone.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', nullPhone);
      expect(nullPhone.body.profile).toEqual({ ...profileOf(me), phone: null });

      coreApi.on('get', '/api/v1/user/me/', { body: without(me, 'phone') });
      const missingPhone = await withSession(request(app).get('/settings/bootstrap'));
      expect(missingPhone.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', missingPhone);
      expect(missingPhone.body).toEqual({ profile: { first_name: me.first_name, last_name: me.last_name, email: me.email }, sessions: [], sources: { sessions: 'available' } });
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
      coreApi.on('get', '/api/v1/user/me/', { body: me }).on('get', '/api/v1/sessions/', reply);

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(200);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ profile: profileOf(me), sessions: [], sources: { sessions: 'unavailable' } });
    });

    test('preserves a Core 401 on the profile without reading sessions', async () => {
      coreApi.on('get', '/api/v1/user/me/', coreError(401, ''));

      const response = await withSession(request(app).get('/settings/bootstrap'), 'session-expiree');

      expect(response.status).toBe(401);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { message: 'Le service CORE_API a répondu 401.' } });
      expect(coreApi.calls('/api/v1/sessions/')).toHaveLength(0);
    });

    test.each<[string, MockReply, string]>([
      ['a Core 500', coreError(500), 'Le service CORE_API a répondu 500.'],
      ['a Core 503', coreError(503, 'Service Unavailable'), 'Le service CORE_API a répondu 503.'],
      ['invalid JSON', { raw: '<html>proxy</html>', contentType: 'text/html', outOfContract: true }, 'La réponse de CORE_API est invalide.'],
      ['a dropped connection', { dropConnection: true }, 'Le service CORE_API est indisponible.'],
    ])('maps %s on the profile to 502 without leaking the upstream body', async (_label, reply, message) => {
      coreApi.on('get', '/api/v1/user/me/', reply);

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(502);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { message } });
      expect(JSON.stringify(response.body)).not.toMatch(/database|proxy/);
      expect(coreApi.calls('/api/v1/sessions/')).toHaveLength(0);
    });

    test('answers 502 instead of a partial profile when Core omits a required field', async () => {
      coreApi.on('get', '/api/v1/user/me/', { body: without(meResponse(), 'email'), outOfContract: true });

      const response = await withSession(request(app).get('/settings/bootstrap'));

      expect(response.status).toBe(502);
      expectBffContract('get', '/settings/bootstrap', response);
      expect(response.body).toEqual({ error: { message: 'Les données du service sont indisponibles.' } });
    });
  });

  describe('PATCH /settings/profile', () => {
    test.each([
      ['200 without body, as Core API 1.1.1 does', { status: 200 }],
      ['204', { status: 204 }],
    ] as const)('sends the patch to PATCH /api/v1/user/me/, accepts a %s and returns the re-read profile', async (_label, patchReply) => {
      const patch = { first_name: 'Anne Marie', last_name: 'Le Gall', email: 'anne.marie@mairie.test', phone: '+33987654321' };
      // Le profil relu fait foi, même s'il diffère de ce qui a été envoyé (normalisation côté Core).
      const persisted = meResponse({ ...patch, email: 'anne.marie@mairie.test', last_name: 'LE GALL' });
      coreApi
        .on('patch', '/api/v1/user/me/', patchReply)
        .on('get', '/api/v1/user/me/', { body: persisted });

      const response = await withSession(request(app).patch('/settings/profile').send(patch), 'session-42');

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual(profileOf(persisted));
      expect(coreApi.requests.map(({ method, template }) => `${method} ${template}`))
        .toEqual(['PATCH /api/v1/user/me/', 'GET /api/v1/user/me/']);
      const [sent, reread] = coreApi.requests;
      expect(sent.body).toEqual(patch);
      expect(sent.headers['content-type']).toBe('application/json');
      expect(sent.headers.authorization).toBe(bearer('session-42'));
      expect(reread.headers.authorization).toBe(bearer('session-42'));
      expect(reread.body).toBeUndefined();
    });

    test.each([
      ['a single field', { last_name: 'Le Gall-Martin' }],
      ['a phone removal', { phone: null }],
    ])('forwards only %s', async (_label, patch) => {
      coreApi.on('patch', '/api/v1/user/me/', { status: 200 }).on('get', '/api/v1/user/me/', { body: meResponse(patch) });

      const response = await withSession(request(app).patch('/settings/profile').send(patch));

      expect(response.status).toBe(200);
      expectBffContract('patch', '/settings/profile', response);
      expect(coreApi.calls('/api/v1/user/me/', 'patch')[0].body).toEqual(patch);
    });

    test.each([
      ['an empty body', {}],
      ['unsupported fields', { fullName: 'Anne Marie Le Gall', roles: ['Admin'] }],
      ['a known field mixed with an unsupported one', { first_name: 'Anne', status: 'archived' }],
      ['an invalid e-mail', { email: 'anne-at-mairie' }],
      ['a wrong type', { first_name: 42 }],
      ['a JSON array', [{ first_name: 'Anne' }]],
    ])('rejects %s with 400 without calling Core', async (_label, body) => {
      const response = await withSession(request(app).patch('/settings/profile').send(body));

      expect(response.status).toBe(400);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { message: 'Les champs autorisés sont prénom, nom, e-mail et téléphone.' } });
      expect(coreApi.requests).toHaveLength(0);
    });

    test('rejects a malformed JSON body with 400', async () => {
      const response = await withSession(request(app).patch('/settings/profile').set('Content-Type', 'application/json').send('{"first_name":'));

      expect(response.status).toBe(400);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { message: 'Corps de requête invalide.' } });
      expect(coreApi.requests).toHaveLength(0);
    });

    test.each<[string, MockReply, number]>([
      ['a Core 401', coreError(401, ''), 401],
      ['a Core 400', coreError(400, 'Json deserialize error'), 400],
      ['a Core 500', coreError(500), 502],
    ])('does not report a save and does not re-read on %s', async (_label, reply, status) => {
      coreApi.on('patch', '/api/v1/user/me/', reply);

      const response = await withSession(request(app).patch('/settings/profile').send({ first_name: 'Anne' }));

      expect(response.status).toBe(status);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { message: `Le service CORE_API a répondu ${reply.status}.` } });
      expect(coreApi.calls('/api/v1/user/me/', 'get')).toHaveLength(0);
    });

    test('answers 502 when the saved profile cannot be re-read', async () => {
      coreApi.on('patch', '/api/v1/user/me/', { status: 200 }).on('get', '/api/v1/user/me/', coreError(500));

      const response = await withSession(request(app).patch('/settings/profile').send({ first_name: 'Anne' }));

      expect(response.status).toBe(502);
      expectBffContract('patch', '/settings/profile', response);
      expect(response.body).toEqual({ error: { message: 'Le service CORE_API a répondu 500.' } });
    });
  });

  describe('PATCH /settings/{notifications,appearance,general}', () => {
    test.each(PREFERENCE_TARGETS)('/settings/$section relays the Core 404 of $template and never fabricates a save', async ({ section }) => {
      const response = await withSession(request(app).patch(`/settings/${section}`).send({ theme: 'dark', emailDigest: false }));

      expect(response.status).toBe(404);
      expectBffContract('patch', `/settings/${section}`, response);
      expect(response.type).toBe('application/json');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual({ error: { message: 'Route absente du contrat' } });
    });
  });

  describe('GET /check_apis', () => {
    test('reports Core API connected when GET /health answers', async () => {
      coreApi.on('get', '/health', { raw: 'OK', contentType: 'text/plain' });

      const response = await request(app).get('/check_apis');

      expect(response.status).toBe(200);
      expectBffContract('get', '/check_apis', response);
      expect(response.body).toEqual({ status: 'OK', core_api: 'Connected' });
      const [health] = coreApi.calls('/health', 'get');
      expect(coreApi.requests).toHaveLength(1);
      // Sonde de disponibilité : aucune session n'est transmise.
      expect(health.headers.authorization).toBeUndefined();
    });

    test.each<[string, () => Promise<void>]>([
      ['answers 500', async () => { coreApi.on('get', '/health', coreError(500)); }],
      ['drops the connection', async () => { coreApi.on('get', '/health', { dropConnection: true }); }],
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

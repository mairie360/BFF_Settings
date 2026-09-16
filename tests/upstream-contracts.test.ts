import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BootstrapSchema, ProfilePatchSchema, ProfileSchema } from '../src/routes/settings';
import { PREFERENCE_TARGETS, group, meResponse, session } from './support/core-fixtures';
import type { JsonSchema } from './support/openapi-contract';
import { loadOrvalContract, resolveOrvalPackage } from './support/orval-contract';

// Le contrat Core API est reconstruit depuis le paquet @mairie360/core-api-openapi installé :
// monter la version dans package.json suffit à tester le BFF contre le nouveau contrat.

const PACKAGE = '@mairie360/core-api-openapi';

// Opérations Core réellement appelées par le BFF (src/routes/settings.ts, src/routes/check_apis.ts).
const CONSUMED = [
  { operationId: 'getMe', method: 'get', template: '/api/v1/user/me/' },
  { operationId: 'patchMe', method: 'patch', template: '/api/v1/user/me/' },
  { operationId: 'getActiveSessions', method: 'get', template: '/api/v1/sessions/' },
  { operationId: 'health', method: 'get', template: '/health' },
] as const;

const coreApi = loadOrvalContract(PACKAGE);

function responseSchema(method: string, pathname: string, status = 200): JsonSchema {
  const match = coreApi.match(method, pathname);
  if (!match) throw new Error(`${method} ${pathname} absent de ${coreApi.title}`);
  const { schema } = coreApi.responseSchema(match, status);
  if (!schema) throw new Error(`Pas de schéma JSON pour ${status} ${method} ${pathname}`);
  return schema;
}

const properties = (name: string) => Object.keys(coreApi.schema(name).properties as Record<string, JsonSchema>).sort();

describe('Core API contract from the installed @mairie360/core-api-openapi package', () => {
  test('is core_api at the version pinned in package.json', () => {
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as Record<string, Record<string, string>>;
    expect(coreApi.title).toBe('core_api');
    expect(resolveOrvalPackage(PACKAGE).version).toBe(packageJson.devDependencies[PACKAGE]);
  });

  test.each(CONSUMED)('declares $operationId as $method $template', ({ operationId, method, template }) => {
    const operation = coreApi.document.paths[template]?.[method] as { operationId?: string } | undefined;
    expect(operation?.operationId).toBe(operationId);
  });

  test('keeps parameters, bodies and response models of the consumed operations', () => {
    const getMe = coreApi.match('GET', '/api/v1/user/me/')!;
    expect(getMe.operation.parameters).toEqual([]);
    expect(coreApi.responseSchema(getMe, 200)).toEqual({ documented: true, schema: { $ref: '#/components/schemas/GetMeResponseView' } });
    expect(coreApi.schema('GetMeResponseView')).toMatchObject({ required: ['email', 'first_name', 'groups', 'last_name', 'role', 'status'] });

    const patchMe = coreApi.match('PATCH', '/api/v1/user/me/')!;
    expect(coreApi.requestBodySchema(patchMe)).toEqual({ required: true, schema: { $ref: '#/components/schemas/PatchMeView' } });
    // Core répond 200 sans corps : aucun schéma de réponse, le BFF doit relire le profil.
    expect(coreApi.responseSchema(patchMe, 200)).toEqual({ documented: true, schema: undefined });

    const sessions = coreApi.match('GET', '/api/v1/sessions/')!;
    expect(coreApi.responseSchema(sessions, 200)).toEqual({ documented: true, schema: { $ref: '#/components/schemas/GetSessionsResultView' } });
    expect(coreApi.validate(coreApi.schema('GetSessionsResultView'), { sessions: [session('s-1')] })).toEqual([]);

    expect(coreApi.responseSchema(coreApi.match('GET', '/health')!, 200)).toEqual({ documented: true, schema: undefined });
    // Les erreurs ne sont pas typées par orval : aucun statut hors 2XX n'est documenté.
    expect(coreApi.responseSchema(getMe, 401).documented).toBe(false);
  });
});

describe('BFF Settings schemas stay compatible with the Core API contract', () => {
  test('every editable profile field is accepted by PatchMeView', () => {
    expect(Object.keys(ProfilePatchSchema.shape).sort()).toEqual(properties('PatchMeView'));
  });

  test('the profile only reads fields returned by GetMeResponseView', () => {
    expect(properties('GetMeResponseView')).toEqual(expect.arrayContaining(Object.keys(ProfileSchema.shape)));
  });

  test('the bootstrap session exposes exactly the Core SessionSchema fields', () => {
    expect(Object.keys(BootstrapSchema.shape.sessions.element.shape).sort()).toEqual(properties('SessionSchema'));
  });
});

describe('known gaps between the Core API contract and what the BFF calls', () => {
  // Quand ce test échoue, Core API expose les préférences : le BFF doit les relayer au lieu de répondre 404.

  test.each(PREFERENCE_TARGETS)('PATCH $template (/settings/$section) is not exposed by Core API', ({ template }) => {
    expect(coreApi.document.paths[template]).toBeUndefined();
  });
});

describe('Core API fixtures conform to the Core API contract', () => {
  test.each([
    ['a regular agent', meResponse()],
    ['an agent without phone nor group', meResponse({ phone: null, groups: [] })],
    ['an administrator in several groups', meResponse({ role: 'Admin', groups: [group(1), group(2, { description: null })] })],
  ])('GET /api/v1/user/me/ 200 for %s', (_name, body) => {
    expect(coreApi.validate(responseSchema('get', '/api/v1/user/me/'), body)).toEqual([]);
  });

  test.each([
    ['an active session', session('s-1')],
    ['a revoked session', session('s-2', { revoked_at: '2026-09-16T08:00:00Z' })],
  ])('SessionSchema for %s', (_name, body) => {
    expect(coreApi.validate(coreApi.schema('SessionSchema'), body)).toEqual([]);
  });

  test.each([
    ['a full profile', { first_name: 'Anne Marie', last_name: 'Le Gall', email: 'anne@mairie.test', phone: '+33123456789' }],
    ['a phone removal', { phone: null }],
  ])('PATCH /api/v1/user/me/ body for %s', (_name, body) => {
    const patchMe = coreApi.match('PATCH', '/api/v1/user/me/')!;
    expect(coreApi.validate(coreApi.requestBodySchema(patchMe).schema!, ProfilePatchSchema.parse(body))).toEqual([]);
  });
});

describe('contract validator', () => {
  test('reports missing required properties and wrong types in a profile', () => {
    const invalid = { first_name: 'Anne', email: 42, groups: [{ id: '1', name: 'Urbanisme' }] };
    expect(coreApi.validate(responseSchema('get', '/api/v1/user/me/'), invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('$.last_name: propriété requise manquante'),
      expect.stringContaining('$.role: propriété requise manquante'),
      expect.stringContaining('$.email: type string attendu'),
      expect.stringContaining('$.groups[0].id: type number attendu'),
      expect.stringContaining('$.groups[0].owner_id: propriété requise manquante'),
    ]));
  });

  test('rejects operations absent from the contract', () => {
    expect(coreApi.validateRequest('PUT', new URL('http://core/api/v1/user/me/')).errors)
      .toEqual([expect.stringContaining("n'existe pas dans le contrat core_api")]);
    expect(coreApi.match('GET', '/settings/bootstrap')).toBeUndefined();
  });
});

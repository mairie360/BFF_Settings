import { HttpError } from '@mairie360/bffs-lib';
import { Router } from 'express';
import { z } from 'zod';
import { registry, ErrorSchema } from '../openapi-registry';
import { asCaller, coreApi, coreError } from '../clients/coreClient';
import { authorization } from '../clients/upstream';

const errorContent = { content: { 'application/json': { schema: ErrorSchema } } };
const passthroughContent = { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } };
// Common error answers: session refused (BFF or Core), Core failure (network, 5xx, undeclared 4xx or
// invalid answer), Core not configured.
const upstreamErrors = {
  401: { description: 'Invalid session', ...errorContent },
  502: { description: 'Core is unavailable, failed or answered an unexpected status', ...errorContent },
  503: { description: 'Core is not configured', ...errorContent },
};

const router = Router();
router.use((req, _res, next) => {
  authorization(req);
  next();
});
// The examples are valid values, so a generated request (Swagger UI, ZAP) is accepted.
export const ProfileSchema = registry.register('SettingsProfile', z.object({
  first_name: z.string().openapi({ example: 'Security' }),
  last_name: z.string().openapi({ example: 'Admin' }),
  email: z.string().email().openapi({ example: 'security-admin@mairie360.fr' }),
  phone: z.string().nullable().optional().openapi({ example: '0612345678' }),
}));
// Edits follow the database columns (names up to 64 characters, phone up to 15): a longer value made
// Core API 1.2.0 fail with a 500. Names are rendered by the fronts, so `<`
// and `>` are refused.
const PersonName = z.string().trim().min(1).max(64).regex(/^[^<>]*$/, 'Must not contain < or >');
export const ProfilePatchSchema = registry.register('SettingsProfilePatch', z.object({
  first_name: PersonName.openapi({ example: 'Security' }),
  last_name: PersonName.openapi({ example: 'Admin' }),
  email: z.string().trim().email().max(320).openapi({ example: 'security-admin@mairie360.fr' }),
  // Separators typed in the form (spaces, dots, dashes) are accepted and dropped before Core API;
  // an empty value is kept as is.
  phone: z.string()
    .regex(/^(?:\+?\d(?:[\s.-]?\d){9,13})?$/, 'Expected 10 to 14 digits, optionally after a +')
    .nullable()
    .openapi({ example: '0612345678' }),
}).partial().strict());
const SessionSchema = z.object({
  id: z.string(), device_info: z.string(), ip_address: z.string(), created_at: z.string(), expires_at: z.string(), revoked_at: z.string().nullable().optional(),
});
export const BootstrapSchema = registry.register('SettingsBootstrap', z.object({
  profile: ProfileSchema, sessions: z.array(SessionSchema),
  sources: z.object({ sessions: z.enum(['available', 'unavailable']) }),
}));
registry.registerPath({ method: 'get', path: '/settings/bootstrap', responses: {
  200: { description: 'Core profile and sessions of the signed-in user', content: { 'application/json': { schema: BootstrapSchema } } },
  ...upstreamErrors, 502: { description: 'Profile unavailable', ...errorContent },
} });
router.get('/bootstrap', async (req, res) => {
  try {
    const profile = ProfileSchema.parse((await coreApi.getMe(asCaller(req))).data);
    let sessions: z.infer<typeof SessionSchema>[] = [];
    let sessionSource: 'available' | 'unavailable' = 'unavailable';
    try {
      const response = (await coreApi.getActiveSessions(asCaller(req))).data;
      sessions = z.object({ sessions: z.array(SessionSchema) }).parse(response).sessions;
      sessionSource = 'available';
    } catch { /* Session availability is separate from profile availability. */ }
    return res.json(BootstrapSchema.parse({ profile, sessions, sources: { sessions: sessionSource } }));
  } catch (error) { throw coreError(error, [401]); }
});
registry.registerPath({ method: 'patch', path: '/settings/profile', request: {
  body: { required: true, content: { 'application/json': { schema: ProfilePatchSchema } } },
}, responses: { 200: { description: 'Profile saved, then read again', content: { 'application/json': { schema: ProfileSchema } } }, 400: { description: 'Invalid or unsupported fields', ...errorContent }, ...upstreamErrors } });
router.patch('/profile', async (req, res) => {
  const body = ProfilePatchSchema.safeParse(req.body);
  if (!body.success || !Object.keys(body.data).length) {
    throw new HttpError(400, 'The allowed fields are first name, last name, e-mail and phone.', {
      details: body.success ? [] : body.error.issues.map((issue) => ({ path: ['body', ...issue.path].join('.'), message: issue.message })),
    });
  }
  try {
    const patch = typeof body.data.phone === 'string'
      ? { ...body.data, phone: body.data.phone.replace(/[\s.-]/g, '') }
      : body.data;
    await coreApi.patchMe(patch, asCaller(req));
    return res.json(ProfileSchema.parse((await coreApi.getMe(asCaller(req))).data));
  } catch (error) { throw coreError(error, [400, 401]); }
});

// Core API exposes no preference operation: these sections answer 404 and never fake a local save.
// They will relay Core as soon as it publishes the matching operations.
const preferences = ['notifications', 'appearance', 'general'] as const;
for (const section of preferences) {
  registry.registerPath({ method: 'patch', path: `/settings/${section}`, request: {
    body: { required: true, content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } },
  }, responses: {
    200: { description: 'Preferences saved by Core', ...passthroughContent },
    400: { description: 'Unparsable request body', ...errorContent },
    404: { description: 'Not available in Core yet', ...errorContent },
    ...upstreamErrors,
  } });
  router.patch(`/${section}`, () => {
    throw new HttpError(404, 'This preference is not handled by Core API yet.');
  });
}
export default router;

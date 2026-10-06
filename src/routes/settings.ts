import { HttpError, asCaller, callUpstream, parseRequest, requireBearer, validationError } from '@mairie360/bffs-lib';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { registry, ErrorSchema } from '../openapi-registry';
import type { PatchMeView } from '@mairie360/core-api-openapi/model';
import { coreApi } from '../clients/coreClient';

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
// Every /settings route needs the caller's session: 401 before any Core call without a Bearer token.
router.use(requireBearer);
// The examples are valid values, so a generated request (Swagger UI, ZAP) is accepted.
export const ProfileSchema = registry.register('SettingsProfile', z.object({
  first_name: z.string().openapi({ example: 'Security' }),
  last_name: z.string().openapi({ example: 'Admin' }),
  email: z.string().email().openapi({ example: 'security-admin@mairie360.fr' }),
  phone: z.string().nullable().optional().openapi({ example: '0612345678' }),
}));
// Edits follow the database columns (names up to 64 characters, phone up to 15): a longer value made
// Core API 1.2.0 fail with a 500 (Core 2.0 enforces the same limits with a 400). Names are rendered by the fronts, so `<`
// and `>` are refused.
const PersonName = z.string().trim().min(1).max(64).regex(/^[^<>]*$/, 'Must not contain < or >');
export const ProfilePatchSchema = registry.register('SettingsProfilePatch', z.object({
  first_name: PersonName.openapi({ example: 'Security' }),
  last_name: PersonName.openapi({ example: 'Admin' }),
  email: z.string().trim().email().max(320).openapi({ example: 'security-admin@mairie360.fr' }),
  // Separators typed in the form (spaces, dots, dashes) are accepted and dropped before Core API.
  // Core API >= 2.0 only stores 10 to 15 digits: no `+` prefix, and an empty value cannot clear the phone.
  phone: z.string()
    .regex(/^\d(?:[\s.-]?\d){9,14}$/, 'Expected 10 to 15 digits')
    .nullable()
    .openapi({ example: '0612345678' }),
  // Core API >= 2.0 (MAIR-390) only changes the e-mail address with the current password of the account
  // (403 when it is wrong). Only needed, and only forwarded to Core, when `email` differs from the
  // current one; never stored nor returned.
  current_password: z.string().min(1).max(255).openapi({
    description: 'Current password of the account, required when `email` changes the current address',
    example: 'current-password',
  }),
}).partial().strict());
const PROFILE_FIELDS = ['first_name', 'last_name', 'email', 'phone'] as const;
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
const SessionsResultSchema = z.object({ sessions: z.array(SessionSchema) });

/** The caller's Core profile; an invalid answer is a 502 (`The CORE_API answer is invalid.`). */
async function readProfile(req: Request) {
  return callUpstream(
    'CORE_API',
    async () => ProfileSchema.parse((await coreApi.getMe(asCaller('CORE_API', req))).data),
    { declared: [401], retry: true },
  );
}

router.get('/bootstrap', async (req, res) => {
  const profile = await readProfile(req);
  let sessions: z.infer<typeof SessionSchema>[] = [];
  let sessionSource: 'available' | 'unavailable' = 'unavailable';
  try {
    sessions = await callUpstream(
      'CORE_API',
      async () => SessionsResultSchema.parse((await coreApi.getActiveSessions(asCaller('CORE_API', req))).data).sessions,
      { retry: true },
    );
    sessionSource = 'available';
  } catch { /* Session availability is separate from profile availability. */ }
  return res.json(BootstrapSchema.parse({ profile, sessions, sources: { sessions: sessionSource } }));
});
registry.registerPath({ method: 'patch', path: '/settings/profile', request: {
  body: { required: true, content: { 'application/json': { schema: ProfilePatchSchema } } },
}, responses: {
  200: { description: 'Profile saved, then read again', content: { 'application/json': { schema: ProfileSchema } } },
  400: { description: 'Invalid or unsupported fields, or a changed `email` without `current_password`', ...errorContent },
  ...upstreamErrors,
  403: { description: '`email` sent with a wrong `current_password`, or an account without password', ...errorContent },
  409: { description: '`email` is already used by another account', ...errorContent },
} });
router.patch('/profile', async (req, res) => {
  const body = parseRequest(ProfilePatchSchema, req.body, 'body');
  // An empty patch is refused instead of answering a save that changed nothing.
  if (!PROFILE_FIELDS.some((field) => field in body)) {
    throw validationError('body', [{ path: [], message: 'Expected at least one of first_name, last_name, email, phone' }]);
  }
  // The settings form always sends the whole profile: an e-mail equal to the current one (trimmed,
  // case-insensitive) is not a change and is not sent to Core, so it needs no current password.
  const { email, current_password: currentPassword, ...fields } = body;
  let patch: PatchMeView = fields;
  if (email !== undefined) {
    const current = await readProfile(req);
    if (email.trim().toLowerCase() !== current.email.trim().toLowerCase()) {
      if (currentPassword === undefined) {
        throw validationError('body', [{ path: ['current_password'], message: 'Required when email is changed' }]);
      }
      patch = { ...fields, email, current_password: currentPassword };
    } else if (!PROFILE_FIELDS.some((field) => field in fields)) {
      // Nothing left to save: answer the current profile without calling PATCH.
      return res.json(current);
    }
  }
  if (typeof patch.phone === 'string') patch = { ...patch, phone: patch.phone.replace(/[\s.-]/g, '') };
  // Not retried: only idempotent reads are.
  await callUpstream('CORE_API', () => coreApi.patchMe(patch, asCaller('CORE_API', req)), { declared: [400, 401, 403, 409] });
  return res.json(await readProfile(req));
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

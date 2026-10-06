import { asCaller, callUpstream, parseRequest, requireBearer, validationError } from '@mairie360/bffs-lib';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { registry, ErrorSchema } from '../openapi-registry';
import type { PatchMeView } from '@mairie360/core-api-openapi/model';
import { coreApi } from '../clients/coreClient';

const errorContent = { content: { 'application/json': { schema: ErrorSchema } } };
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

// Preferences and notification settings stored by Core API (`/api/v1/user/me/preferences/` and
// `/api/v1/user/me/notifications/`). Every field is nullable: `null` means "application default", and
// a PATCH with `null` resets the field to it. Edits mirror the Core rules (MAIR-205).
const THEMES = ['light', 'dark', 'system'] as const;
/** Core `check_text`: 1 to `max` characters, not blank, no control character. */
const PreferenceText = (max: number) => z.string().max(max)
  .regex(/\S/, 'Must not be blank')
  // Unicode Cc, like Rust `char::is_control`. The OpenAPI document only keeps the first pattern (`\S`).
  .regex(/^\P{Cc}*$/u, 'Must not contain control characters');
const FontSize = z.number().int().min(1).max(32767);
const APPEARANCE_FIELDS = ['theme', 'font_family', 'font_size', 'density'] as const;
const GENERAL_FIELDS = ['language', 'timezone', 'date_format', 'home_page', 'auto_open_notifications'] as const;
const NOTIFICATION_FIELDS = ['email', 'push', 'desktop', 'messages', 'projects', 'calendar'] as const;

export const AppearanceSchema = registry.register('SettingsAppearance', z.object({
  theme: z.enum(THEMES).nullable().openapi({ example: 'dark' }),
  font_family: z.string().nullable().openapi({ example: 'Marianne' }),
  font_size: z.number().int().nullable().openapi({ example: 16 }),
  density: z.string().nullable().openapi({ example: 'compact' }),
}));
export const AppearancePatchSchema = registry.register('SettingsAppearancePatch', z.object({
  theme: z.enum(THEMES).nullable().openapi({ example: 'dark' }),
  font_family: PreferenceText(128).nullable().openapi({ example: 'Marianne' }),
  font_size: FontSize.nullable().openapi({ example: 16 }),
  density: PreferenceText(32).nullable().openapi({ example: 'compact' }),
}).partial().strict());
export const GeneralSchema = registry.register('SettingsGeneral', z.object({
  language: z.string().nullable().openapi({ example: 'fr' }),
  timezone: z.string().nullable().openapi({ example: 'Europe/Paris' }),
  date_format: z.string().nullable().openapi({ example: 'DD/MM/YYYY' }),
  home_page: z.string().nullable().openapi({ example: '/dashboard' }),
  auto_open_notifications: z.boolean().nullable().openapi({ example: false }),
}));
export const GeneralPatchSchema = registry.register('SettingsGeneralPatch', z.object({
  language: PreferenceText(16).nullable().openapi({ example: 'fr' }),
  timezone: PreferenceText(64).nullable().openapi({ example: 'Europe/Paris' }),
  date_format: PreferenceText(32).nullable().openapi({ example: 'DD/MM/YYYY' }),
  home_page: PreferenceText(128).nullable().openapi({ example: '/dashboard' }),
  auto_open_notifications: z.boolean().nullable().openapi({ example: false }),
}).partial().strict());
const notificationFlags = (optional: boolean) => {
  const flag = (example: boolean) => (optional ? z.boolean().nullable().optional() : z.boolean().nullable()).openapi({ example });
  return {
    email: flag(true), push: flag(false), desktop: flag(true), messages: flag(true), projects: flag(true), calendar: flag(false),
  };
};
export const NotificationsSchema = registry.register('SettingsNotifications', z.object(notificationFlags(false)));
export const NotificationsPatchSchema = registry.register('SettingsNotificationsPatch', z.object(notificationFlags(true)).strict());

// Core answers (`UserPreferences`, `UserNotificationSettings`): every field optional and nullable.
const CorePreferencesSchema = z.object({
  theme: z.enum(THEMES).nullish(), font_family: z.string().nullish(), font_size: z.number().int().nullish(), density: z.string().nullish(),
  language: z.string().nullish(), timezone: z.string().nullish(), date_format: z.string().nullish(), home_page: z.string().nullish(),
  auto_open_notifications: z.boolean().nullish(),
});
const CoreNotificationsSchema = z.object(Object.fromEntries(NOTIFICATION_FIELDS.map((field) => [field, z.boolean().nullish()])));

/** The `fields` of a Core answer, a missing field being `null` (application default). */
function pick<K extends string>(fields: readonly K[], source: Partial<Record<K, unknown>>) {
  return Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));
}

const availability = z.enum(['available', 'unavailable']);
export const BootstrapSchema = registry.register('SettingsBootstrap', z.object({
  profile: ProfileSchema, sessions: z.array(SessionSchema),
  // `null` when Core could not be read (see `sources`). A union, not `.nullable()`: zod-to-openapi turns a
  // nullable registered schema into an `allOf` that refuses `null`.
  appearance: z.union([AppearanceSchema, z.null()]),
  general: z.union([GeneralSchema, z.null()]),
  notifications: z.union([NotificationsSchema, z.null()]),
  sources: z.object({ sessions: availability, preferences: availability, notifications: availability }),
}));
registry.registerPath({ method: 'get', path: '/settings/bootstrap', responses: {
  200: { description: 'Core profile, sessions, preferences and notification settings of the signed-in user', content: { 'application/json': { schema: BootstrapSchema } } },
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

/** An optional Core read: `undefined` when it fails, so the bootstrap still answers the profile. */
async function optionalRead<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await callUpstream('CORE_API', read, { retry: true });
  } catch {
    return undefined;
  }
}

router.get('/bootstrap', async (req, res) => {
  const profile = await readProfile(req);
  // Sessions, preferences and notification settings are optional: each failure only marks its source.
  const [sessions, preferences, notifications] = await Promise.all([
    optionalRead(async () => SessionsResultSchema.parse((await coreApi.getActiveSessions(asCaller('CORE_API', req))).data).sessions),
    optionalRead(async () => CorePreferencesSchema.parse((await coreApi.getMyPreferences(asCaller('CORE_API', req))).data)),
    optionalRead(async () => CoreNotificationsSchema.parse((await coreApi.getMyNotificationSettings(asCaller('CORE_API', req))).data)),
  ]);
  const source = (value: unknown) => (value === undefined ? 'unavailable' : 'available');
  return res.json(BootstrapSchema.parse({
    profile,
    sessions: sessions ?? [],
    appearance: preferences ? pick(APPEARANCE_FIELDS, preferences) : null,
    general: preferences ? pick(GENERAL_FIELDS, preferences) : null,
    notifications: notifications ? pick(NOTIFICATION_FIELDS, notifications) : null,
    sources: { sessions: source(sessions), preferences: source(preferences), notifications: source(notifications) },
  }));
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

// Preference sections: each one only accepts its own fields (unknown field: 400, at least one field),
// PATCHes Core and answers the section as stored by Core. The sections `appearance` and `general`
// share Core's preferences.
const sections = [
  {
    section: 'appearance', fields: APPEARANCE_FIELDS, patchSchema: AppearancePatchSchema, schema: AppearanceSchema,
    save: (req: Request, patch: object) => coreApi.patchMyPreferences(patch, asCaller('CORE_API', req)), answer: CorePreferencesSchema,
  },
  {
    section: 'general', fields: GENERAL_FIELDS, patchSchema: GeneralPatchSchema, schema: GeneralSchema,
    save: (req: Request, patch: object) => coreApi.patchMyPreferences(patch, asCaller('CORE_API', req)), answer: CorePreferencesSchema,
  },
  {
    section: 'notifications', fields: NOTIFICATION_FIELDS, patchSchema: NotificationsPatchSchema, schema: NotificationsSchema,
    save: (req: Request, patch: object) => coreApi.patchMyNotificationSettings(patch, asCaller('CORE_API', req)), answer: CoreNotificationsSchema,
  },
] as const;
for (const { section, fields, patchSchema, schema, save, answer } of sections) {
  registry.registerPath({ method: 'patch', path: `/settings/${section}`, request: {
    body: { required: true, content: { 'application/json': { schema: patchSchema } } },
  }, responses: {
    200: { description: `${section} settings saved by Core`, content: { 'application/json': { schema } } },
    400: { description: 'Invalid or unsupported fields', ...errorContent },
    ...upstreamErrors,
  } });
  router.patch(`/${section}`, async (req, res) => {
    const patch: Record<string, unknown> = parseRequest(patchSchema, req.body, 'body');
    if (!Object.keys(patch).length) {
      throw validationError('body', [{ path: [], message: `Expected at least one of ${fields.join(', ')}` }]);
    }
    // Not retried: only idempotent reads are.
    const stored = await callUpstream(
      'CORE_API',
      async () => answer.parse((await save(req, patch)).data) as Record<string, unknown>,
      { declared: [400, 401] },
    );
    return res.json(schema.parse(pick(fields, stored)));
  });
}
export default router;

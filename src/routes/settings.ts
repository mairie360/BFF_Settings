import { HttpError, asCaller, bearerToken, callUpstream, parseRequest, requireSession, validationError } from '@mairie360/bffs-lib';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { registry, ErrorSchema } from '../openapi-registry';
import type { PatchMeView } from '@mairie360/core-api-openapi/model';
import { coreApi } from '../clients/coreClient';

const errorContent = { content: { 'application/json': { schema: ErrorSchema } } };
// Common error answers: session refused (BFF or Core), Core failure (network, 5xx, undeclared 4xx or
// invalid answer), Core not configured.
const upstreamErrors = {
  401: { description: 'Missing, forged or expired session token, or a session Core refuses', ...errorContent },
  // bffs-lib >= 2.4.0 relays a Core 429 with its Retry-After instead of a 502 (MAIR-562).
  429: {
    description: 'Core rate limit reached: retry after the Retry-After header (seconds)',
    headers: { 'Retry-After': { description: 'Seconds to wait before retrying', schema: { type: 'integer' as const } } },
    ...errorContent,
  },
  502: { description: 'Core is unavailable, failed or answered an unexpected status', ...errorContent },
  503: { description: 'Core or the session key (JWT_PUBLIC_KEY) is not configured', ...errorContent },
};

const router = Router();
// Every /settings route needs the caller's session: 401 before any Core call without a Bearer token verified
// with Core's public key JWT_PUBLIC_KEY (EdDSA, expiry; bffs-lib requireSession, MAIR-474, MAIR-680). Core still checks revocation.
router.use(requireSession);
// The examples are valid values, so a generated request (Swagger UI, ZAP) is accepted.
export const ProfileSchema = registry.register('SettingsProfile', z.object({
  first_name: z.string().openapi({ example: 'Security' }),
  last_name: z.string().openapi({ example: 'Admin' }),
  email: z.string().email().openapi({ example: 'security-admin@mairie360.fr' }),
  // Core API (MAIR-480) answers the phone in E.164 next to its country.
  phone: z.string().nullable().optional().openapi({ example: '+33612345678' }),
  phone_country: z.string().nullable().optional().openapi({ description: 'ISO 3166-1 alpha-2 country of the phone', example: 'FR' }),
  // Core API: a changed e-mail only applies once its owner opens the link sent to the new address.
  pending_email: z.string().email().nullable().optional().openapi({
    description: 'New e-mail address waiting for its confirmation link (valid one hour); `email` stays the current address until then. Absent or `null` when there is none',
    example: 'security-admin@nouvelle-adresse.fr',
  }),
  // Profile details of the Settings mockup, from Core's GET /user/me.
  biography: z.string().nullable().optional().openapi({
    description: 'Biography written by the user, plain text with line breaks; `null` when empty',
    example: 'Roads department agent since 2018.',
  }),
  job_title: z.string().nullable().optional().openapi({ description: 'Function (job title) of the user; `null` when empty', example: 'Head of the roads department' }),
  has_photo: z.boolean().default(false).openapi({ description: 'Whether the user stored a photo, read with `GET /settings/profile/photo`', example: false }),
  service: z.object({
    id: z.number().int().openapi({ example: 3 }),
    name: z.string().openapi({ example: 'Roads' }),
  }).nullable().optional().openapi({ description: 'Service of the mairie the administration attached the user to (read-only); `null` when none' }),
}));
// Edits follow the database columns (names up to 64 characters, phone up to 15): a longer value made
// Core API 1.2.0 fail with a 500 (Core 2.0 enforces the same limits with a 400). Names are rendered by the fronts, so `<`
// and `>` are refused.
const PersonName = z.string().trim().min(1).max(64).regex(/^[^<>]*$/, 'Must not contain < or >');
export const ProfilePatchSchema = registry.register('SettingsProfilePatch', z.object({
  first_name: PersonName.openapi({ example: 'Security' }),
  last_name: PersonName.openapi({ example: 'Admin' }),
  email: z.string().trim().email().max(320).openapi({ example: 'security-admin@mairie360.fr' }),
  // Core API (MAIR-480) parses the number as typed against the numbering plan of `phone_country`, or of
  // its own `+` prefix in E.164 (400 otherwise); `null` or `""` clears it. Same characters and length as Core.
  phone: z.string()
    .max(32)
    .regex(/^(?:\+?[\d\s.()-]+)?$/, 'Expected a phone number: digits, spaces, `.`, `-`, `(`, `)` and a leading `+`')
    .nullable()
    .openapi({ example: '06 12 34 56 78' }),
  // Country of a national number (ISO 3166-1 alpha-2); only accepted with `phone`.
  phone_country: z.string().regex(/^[A-Z]{2}$/, 'Expected an ISO 3166-1 alpha-2 code').nullable()
    .openapi({ example: 'FR' }),
  // Core API >= 2.0 (MAIR-390) only changes the e-mail address with the current password of the account
  // (403 when it is wrong). Only needed, and only forwarded to Core, when `email` differs from the
  // current one; never stored nor returned.
  current_password: z.string().min(1).max(255).openapi({
    description: 'Current password of the account, required when `email` changes the current address',
    example: 'current-password',
  }),
  // Plain texts, stored trimmed by Core; `null` or a blank text removes them. Same limits as Core.
  biography: z.string().max(1000).nullable().openapi({
    description: 'Biography, plain text with line breaks, 1000 characters at most; `null` or blank removes it',
    example: 'Roads department agent since 2018.',
  }),
  job_title: z.string().max(100).regex(/^[^\r\n]*$/, 'Must fit on one line').nullable().openapi({
    description: 'Function (job title), one line of 100 characters at most; `null` or blank removes it',
    example: 'Head of the roads department',
  }),
}).partial().strict());
const PROFILE_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'phone_country', 'biography', 'job_title'] as const;
const SessionSchema = registry.register('SettingsSession', z.object({
  id: z.string(), device_info: z.string(), ip_address: z.string(), created_at: z.string(), expires_at: z.string(), revoked_at: z.string().nullable().optional(),
}));

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
// The fonts the Settings V2 front offers (MAIR-912): a closed list, `null` resets to the system font.
// The named fonts of lib-components (MAIR-912, MAIR-1128), the ones Core accepts for the Settings V2 front.
const FONT_FAMILIES = ['system', 'geist', 'atkinson', 'lora'] as const;
// The values the Settings front offers (lib-components `settings/options.ts`). Core stores any short text,
// so the BFF is stricter: anything else is a 400.
const DENSITIES = ['compact', 'normal', 'comfortable'] as const;
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
/** ISO 639 language code, optionally with an ISO 3166 region: `fr`, `en`, `fr-FR`. */
const Language = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Must be a language code such as `fr` or `fr-FR`');
const APPEARANCE_FIELDS = ['theme', 'font_family', 'font_size', 'density'] as const;
const GENERAL_FIELDS = ['language', 'timezone', 'date_format', 'home_page', 'auto_open_notifications', 'autosave'] as const;
const NOTIFICATION_FIELDS = ['email', 'push', 'desktop', 'messages', 'projects', 'calendar', 'system_updates', 'login_alerts'] as const;

export const AppearanceSchema = registry.register('SettingsAppearance', z.object({
  theme: z.enum(THEMES).nullable().openapi({ example: 'dark' }),
  font_family: z.string().nullable().openapi({ example: 'Marianne' }),
  font_size: z.number().int().nullable().openapi({ example: 16 }),
  density: z.string().nullable().openapi({ example: 'compact' }),
}));
export const AppearancePatchSchema = registry.register('SettingsAppearancePatch', z.object({
  theme: z.enum(THEMES).nullable().openapi({ example: 'dark' }),
  font_family: z.enum(FONT_FAMILIES).nullable().openapi({ description: 'Font of the interface: `system`, `geist`, `atkinson` (Atkinson Hyperlegible) or `lora` (MAIR-1128); `null` resets it', example: 'atkinson' }),
  font_size: FontSize.nullable().openapi({ example: 16 }),
  density: z.enum(DENSITIES).nullable().openapi({ example: 'compact' }),
}).partial().strict());
export const GeneralSchema = registry.register('SettingsGeneral', z.object({
  language: z.string().nullable().openapi({ example: 'fr' }),
  timezone: z.string().nullable().openapi({ example: 'Europe/Paris' }),
  date_format: z.string().nullable().openapi({ example: 'DD/MM/YYYY' }),
  home_page: z.string().nullable().openapi({ example: '/dashboard' }),
  auto_open_notifications: z.boolean().nullable().openapi({ example: false }),
  autosave: z.boolean().nullable().openapi({ description: 'Drafts saved automatically every 30 seconds (MAIR-921)', example: true }),
}));
export const GeneralPatchSchema = registry.register('SettingsGeneralPatch', z.object({
  language: Language.nullable().openapi({ example: 'fr' }),
  timezone: PreferenceText(64).nullable().openapi({ example: 'Europe/Paris' }),
  date_format: z.enum(DATE_FORMATS).nullable().openapi({ example: 'DD/MM/YYYY' }),
  home_page: PreferenceText(128).nullable().openapi({ example: '/dashboard' }),
  auto_open_notifications: z.boolean().nullable().openapi({ example: false }),
  autosave: z.boolean().nullable().openapi({ description: 'Drafts saved automatically every 30 seconds (MAIR-921)', example: true }),
}).partial().strict());
const notificationFlags = (optional: boolean) => {
  const flag = (example: boolean) => (optional ? z.boolean().nullable().optional() : z.boolean().nullable()).openapi({ example });
  return {
    email: flag(true), push: flag(false), desktop: flag(true), messages: flag(true), projects: flag(true), calendar: flag(false),
    // MAIR-902: notification type « Mises à jour système »; MAIR-876: e-mail Core sends at every new sign-in.
    system_updates: flag(true), login_alerts: flag(false),
  };
};
export const NotificationsSchema = registry.register('SettingsNotifications', z.object(notificationFlags(false)));
export const NotificationsPatchSchema = registry.register('SettingsNotificationsPatch', z.object(notificationFlags(true)).strict());

// Core answers (`UserPreferences`, `UserNotificationSettings`): every field optional and nullable.
const CorePreferencesSchema = z.object({
  theme: z.enum(THEMES).nullish(), font_family: z.string().nullish(), font_size: z.number().int().nullish(), density: z.string().nullish(),
  language: z.string().nullish(), timezone: z.string().nullish(), date_format: z.string().nullish(), home_page: z.string().nullish(),
  auto_open_notifications: z.boolean().nullish(), autosave: z.boolean().nullish(),
});
const CoreNotificationsSchema = z.object(Object.fromEntries(NOTIFICATION_FIELDS.map((field) => [field, z.boolean().nullish()])));

/** The `fields` of a Core answer, a missing field being `null` (application default). */
function pick<K extends string>(fields: readonly K[], source: Partial<Record<K, unknown>>) {
  return Object.fromEntries(fields.map((field) => [field, source[field] ?? null]));
}

const availability = z.enum(['available', 'unavailable']);
export const BootstrapSchema = registry.register('SettingsBootstrap', z.object({
  profile: ProfileSchema, sessions: z.array(SessionSchema),
  // MAIR-823: the session of this request (the `sid` of its token, `null` for a token without one), and the first page
  // of Core's history of the sessions (newest first, active, expired and revoked ones).
  current_session_id: z.string().nullable().openapi({ description: 'Id of the session of the request, never offered to the disconnection', example: '0b6f2a54-3c1d-4e0a-9f41-6d2b1c7e8a90' }),
  session_history: z.array(SessionSchema),
  // `null` when Core could not be read (see `sources`). A union, not `.nullable()`: zod-to-openapi turns a
  // nullable registered schema into an `allOf` that refuses `null`.
  appearance: z.union([AppearanceSchema, z.null()]),
  general: z.union([GeneralSchema, z.null()]),
  notifications: z.union([NotificationsSchema, z.null()]),
  sources: z.object({ sessions: availability, session_history: availability, preferences: availability, notifications: availability }),
}));
registry.registerPath({ method: 'get', path: '/settings/bootstrap', summary: 'Load the settings page of the signed-in user', responses: {
  200: { description: 'Core profile, sessions, preferences and notification settings of the signed-in user', content: { 'application/json': { schema: BootstrapSchema } } },
  ...upstreamErrors, 502: { description: 'Profile unavailable', ...errorContent },
} });
const SessionsResultSchema = z.object({ sessions: z.array(SessionSchema) });

/**
 * The session id (`sid` claim) of the request's token, `null` when it carries none. Only read after `requireSession`
 * verified the token's signature, so the claim can be trusted.
 */
export function currentSessionId(req: Request): string | null {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const sid = (claims as { sid?: unknown }).sid;
    return typeof sid === 'string' && /^[0-9a-f-]{36}$/i.test(sid) ? sid : null;
  } catch {
    return null;
  }
}

/** Core's active sessions and the first page of its history, both required (a failure is the answer). */
async function readSessions(req: Request) {
  const [sessions, history] = await Promise.all([
    callUpstream('CORE_API', async () => SessionsResultSchema.parse((await coreApi.getActiveSessions(asCaller('CORE_API', req))).data).sessions, { declared: [401], retry: true }),
    callUpstream('CORE_API', async () => SessionsResultSchema.parse((await coreApi.history(undefined, asCaller('CORE_API', req))).data).sessions, { declared: [401], retry: true }),
  ]);
  return { sessions, session_history: history };
}

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
  // The five reads are independent: they start together (MAIR-525). The profile is required (its failure is the
  // answer); sessions, their history, preferences and notification settings are optional: each failure only marks its source.
  const [profile, sessions, history, preferences, notifications] = await Promise.all([
    readProfile(req),
    optionalRead(async () => SessionsResultSchema.parse((await coreApi.getActiveSessions(asCaller('CORE_API', req))).data).sessions),
    optionalRead(async () => SessionsResultSchema.parse((await coreApi.history(undefined, asCaller('CORE_API', req))).data).sessions),
    optionalRead(async () => CorePreferencesSchema.parse((await coreApi.getMyPreferences(asCaller('CORE_API', req))).data)),
    optionalRead(async () => CoreNotificationsSchema.parse((await coreApi.getMyNotificationSettings(asCaller('CORE_API', req))).data)),
  ]);
  const source = (value: unknown) => (value === undefined ? 'unavailable' : 'available');
  return res.json(BootstrapSchema.parse({
    profile,
    sessions: sessions ?? [],
    current_session_id: currentSessionId(req),
    session_history: history ?? [],
    appearance: preferences ? pick(APPEARANCE_FIELDS, preferences) : null,
    general: preferences ? pick(GENERAL_FIELDS, preferences) : null,
    notifications: notifications ? pick(NOTIFICATION_FIELDS, notifications) : null,
    sources: {
      sessions: source(sessions), session_history: source(history), preferences: source(preferences), notifications: source(notifications),
    },
  }));
});
registry.registerPath({ method: 'patch', path: '/settings/profile', summary: 'Update the profile of the signed-in user', request: {
  body: { required: true, content: { 'application/json': { schema: ProfilePatchSchema } } },
}, responses: {
  200: { description: 'Profile saved, then read again. A changed `email` is not applied yet: Core e-mails a confirmation link to the new address and the profile shows it as `pending_email`', content: { 'application/json': { schema: ProfileSchema } } },
  400: { description: 'Invalid or unsupported fields, or a changed `email` without `current_password`', ...errorContent },
  ...upstreamErrors,
  403: { description: '`email` sent with a wrong `current_password`, or an account without password', ...errorContent },
  409: { description: '`email` is already used by another account', ...errorContent },
} });
router.patch('/profile', async (req, res) => {
  const body = parseRequest(ProfilePatchSchema, req.body, 'body');
  // An empty patch is refused instead of answering a save that changed nothing.
  if (!PROFILE_FIELDS.some((field) => field in body)) {
    throw validationError('body', [{ path: [], message: `Expected at least one of ${PROFILE_FIELDS.join(', ')}` }]);
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
  // Not retried: only idempotent reads are.
  await callUpstream('CORE_API', () => coreApi.patchMe(patch, asCaller('CORE_API', req)), { declared: [400, 401, 403, 409] });
  return res.json(await readProfile(req));
});

// The profile photo: a WebP of at most 100 KiB the front crops to 256 x 256. Core checks the format and the size
// (400 / 413); the body parser refuses a larger body with a 413 before any Core call.
export const MAX_PHOTO_BYTES = 100 * 1024;
const photoBody = express.raw({ type: () => true, limit: MAX_PHOTO_BYTES });
const PhotoSchema = z.string().openapi({ type: 'string', format: 'binary' });
/** Options of a Core call as the caller, with extra axios options. */
const callerWith = (req: Request, extra: { headers?: Record<string, string>; responseType?: 'arraybuffer' }) => {
  const caller = asCaller('CORE_API', req);
  return { ...caller, ...extra, headers: { ...caller.headers, ...extra.headers } };
};

registry.registerPath({ method: 'put', path: '/settings/profile/photo', summary: 'Set the photo of the signed-in user', request: {
  body: { required: true, content: { 'image/webp': { schema: PhotoSchema } } },
}, responses: {
  204: { description: 'Photo stored; the profile now answers `has_photo: true`' },
  400: { description: 'The body is empty or not a WebP image', ...errorContent },
  413: { description: 'The image is larger than 102400 bytes', ...errorContent },
  ...upstreamErrors,
} });
router.put('/profile/photo', photoBody, async (req, res) => {
  const photo = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!photo.length) throw validationError('body', [{ path: [], message: 'Expected a WebP image' }]);
  // Not retried: only idempotent reads are.
  await callUpstream('CORE_API', () => coreApi.setMyPhoto(new Blob([photo]), callerWith(req, { headers: { 'Content-Type': 'image/webp' } })), {
    declared: [400, 401, 413],
  });
  return res.status(204).end();
});

registry.registerPath({ method: 'get', path: '/settings/profile/photo', summary: 'Read the photo of the signed-in user', responses: {
  200: { description: 'The photo (WebP)', content: { 'image/webp': { schema: PhotoSchema } } },
  404: { description: 'The user has no photo', ...errorContent },
  ...upstreamErrors,
} });
router.get('/profile/photo', async (req, res) => {
  const answer = await callUpstream('CORE_API', () => coreApi.getMyPhoto(callerWith(req, { responseType: 'arraybuffer' })), {
    declared: [401, 404], retry: true,
  });
  const photo = Buffer.from(answer.data as unknown as ArrayBuffer);
  if (!photo.length) throw new HttpError(502, 'The CORE_API answer is invalid.');
  return res.type('image/webp').send(photo);
});

registry.registerPath({ method: 'delete', path: '/settings/profile/photo', summary: 'Remove the photo of the signed-in user', responses: {
  204: { description: 'No photo left (whether there was one or not)' },
  ...upstreamErrors,
} });
router.delete('/profile/photo', async (req, res) => {
  await callUpstream('CORE_API', () => coreApi.deleteMyPhoto(asCaller('CORE_API', req)), { declared: [401] });
  return res.status(204).end();
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
  registry.registerPath({ method: 'patch', path: `/settings/${section}`, summary: `Save the ${section} settings of the signed-in user`, request: {
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
// Second factor (MAIR-805): the account routes of Core's TOTP + backup codes, relayed as they are. The secret, the
// otpauth URI and the backup codes only travel in these answers (never logged, never cached: `noStore` above).
const TwoFactorStatusSchema = registry.register('SettingsTwoFactorStatus', z.object({
  enabled: z.boolean().openapi({ description: 'Whether the account is protected by a second factor.', example: true }),
  backup_codes_remaining: z.number().int().openapi({ description: 'Backup codes not spent yet; 0 when the second factor is off.', example: 10 }),
}));
const TwoFactorSetupSchema = registry.register('SettingsTwoFactorSetup', z.object({
  secret: z.string().openapi({ description: 'Base32 secret to type in the authenticator application.', example: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }),
  otpauth_uri: z.string().openapi({ description: 'otpauth:// URI to render as a QR code.', example: 'otpauth://totp/Mairie%20360:agent@mairie360.fr?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Mairie%20360' }),
}));
const TwoFactorCodeSchema = registry.register('SettingsTwoFactorCode', z.object({
  code: z.string().trim().min(1).max(32).openapi({ description: 'Six-digit code of the authenticator application, or a backup code.', example: '492039' }),
}));
const TwoFactorDisableSchema = registry.register('SettingsTwoFactorDisable', z.object({
  password: z.string().min(1).max(255).openapi({ description: 'Current password of the account.', example: 'current-password' }),
  code: z.string().trim().min(1).max(32).openapi({ description: 'Six-digit code of the authenticator application, or a backup code.', example: '492039' }),
}));
const BackupCodesSchema = registry.register('SettingsBackupCodes', z.object({
  backup_codes: z.array(z.string()).openapi({ description: 'Ten single-use codes (`xxxx-xxxx`), shown once: they cannot be read again.', example: ['k3m9-x7p2', 'a8d4-q1w6'] }),
}));
const twoFactorErrors = {
  ...upstreamErrors,
  502: { description: 'Core is unavailable, failed or answered an unexpected status, including its 503 when the instance has no encryption key for the second factor', ...errorContent },
};
registry.registerPath({ method: 'get', path: '/settings/2fa', summary: 'Second factor status of the signed-in user', responses: {
  200: { description: 'Whether the second factor is on and how many backup codes are left', content: { 'application/json': { schema: TwoFactorStatusSchema } } },
  ...upstreamErrors,
} });
router.get('/2fa', async (req, res) => {
  const { data } = await callUpstream('CORE_API', () => coreApi.getTwoFactorStatus(asCaller('CORE_API', req)), { declared: [401], retry: true });
  return res.json(TwoFactorStatusSchema.parse(data));
});
registry.registerPath({ method: 'post', path: '/settings/2fa/setup', summary: 'Start the enrolment of an authenticator application', responses: {
  200: { description: 'New secret and otpauth URI; the second factor is only on once confirmed', content: { 'application/json': { schema: TwoFactorSetupSchema } } },
  409: { description: 'The second factor is already active: disable it first', ...errorContent },
  ...twoFactorErrors,
} });
router.post('/2fa/setup', async (req, res) => {
  const { data } = await callUpstream('CORE_API', () => coreApi.setupTwoFactor(asCaller('CORE_API', req)), { declared: [401, 409] });
  return res.json(TwoFactorSetupSchema.parse(data));
});
registry.registerPath({ method: 'post', path: '/settings/2fa/confirm', summary: 'Confirm the enrolment with a first code', request: {
  body: { required: true, content: { 'application/json': { schema: TwoFactorCodeSchema } } },
}, responses: {
  200: { description: 'Second factor on; the ten backup codes, shown once', content: { 'application/json': { schema: BackupCodesSchema } } },
  400: { description: 'Missing code, or a code that does not match', ...errorContent },
  404: { description: 'No enrolment started', ...errorContent },
  ...twoFactorErrors,
} });
router.post('/2fa/confirm', async (req, res) => {
  const body = parseRequest(TwoFactorCodeSchema, req.body, 'body');
  const { data } = await callUpstream('CORE_API', () => coreApi.confirmTwoFactor(body, asCaller('CORE_API', req)), { declared: [400, 401, 404] });
  return res.json(BackupCodesSchema.parse(data));
});
registry.registerPath({ method: 'post', path: '/settings/2fa/disable', summary: 'Turn the second factor off', request: {
  body: { required: true, content: { 'application/json': { schema: TwoFactorDisableSchema } } },
}, responses: {
  204: { description: 'Second factor removed, with its backup codes' },
  400: { description: 'Missing field, wrong password or wrong code', ...errorContent },
  403: { description: 'The instance makes the second factor mandatory (MAIR-808): it cannot be turned off', ...errorContent },
  404: { description: 'The second factor is not active', ...errorContent },
  ...twoFactorErrors,
} });
router.post('/2fa/disable', async (req, res) => {
  const body = parseRequest(TwoFactorDisableSchema, req.body, 'body');
  await callUpstream('CORE_API', () => coreApi.disableTwoFactor(body, asCaller('CORE_API', req)), { declared: [400, 401, 403, 404] });
  return res.status(204).send();
});
registry.registerPath({ method: 'post', path: '/settings/2fa/backup-codes', summary: 'Replace the backup codes', request: {
  body: { required: true, content: { 'application/json': { schema: TwoFactorCodeSchema } } },
}, responses: {
  200: { description: 'Ten new backup codes, shown once; the former ones stop working', content: { 'application/json': { schema: BackupCodesSchema } } },
  400: { description: 'Missing code, or a code that does not match', ...errorContent },
  404: { description: 'The second factor is not active', ...errorContent },
  ...twoFactorErrors,
} });
router.post('/2fa/backup-codes', async (req, res) => {
  const body = parseRequest(TwoFactorCodeSchema, req.body, 'body');
  const { data } = await callUpstream('CORE_API', () => coreApi.regenerateBackupCodes(body, asCaller('CORE_API', req)), { declared: [400, 401, 404] });
  return res.json(BackupCodesSchema.parse(data));
});

// Passkeys (MAIR-810): the account routes of Core's WebAuthn passkeys, relayed. The key itself never leaves Core: a passkey
// is only its id, label, manager name and dates. The sign-in with a passkey is `BFF_user`'s (`POST /auth/passkey`).
const PasskeySchema = registry.register('SettingsPasskey', z.object({
  id: z.number().int().openapi({ description: 'Identifier to give to `DELETE /settings/passkeys/{id}`.', example: 12 }),
  label: z.string().openapi({ description: 'Name the agent gave to the passkey.', example: 'Town hall laptop' }),
  provider: z.string().nullable().openapi({ description: 'Name of the passkey manager Core deduced from the authenticator (iCloud Keychain, Google Password Manager, ...), `null` when unknown.', example: 'Google Password Manager' }),
  created_at: z.string().openapi({ description: 'When the passkey was registered (ISO 8601).', example: '2026-11-17T09:30:00+00:00' }),
  last_used_at: z.string().nullable().openapi({ description: 'Last sign-in with this passkey (ISO 8601), `null` when never used.', example: null }),
}));
const PasskeyRegisterOptionsSchema = registry.register('SettingsPasskeyRegisterOptions', z.object({
  options: z.record(z.string(), z.unknown()).openapi({
    description: 'WebAuthn `PublicKeyCredentialCreationOptions` for `navigator.credentials.create` (user verification required, passkeys already registered excluded).',
    example: { publicKey: { rp: { name: 'Mairie 360', id: 'mairie360-eip.fr' }, challenge: 'q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c' } },
  }),
}));
const PasskeyRegisterSchema = registry.register('SettingsPasskeyRegister', z.object({
  label: z.string().trim().min(1).max(100).regex(/^[^<>]*$/, 'Must not contain < or >').openapi({ description: 'Name of the passkey, to recognise it in the list.', example: 'Town hall laptop' }),
  credential: z.record(z.string(), z.unknown()).openapi({
    description: 'The `PublicKeyCredential` returned by `navigator.credentials.create`, in its WebAuthn JSON form. Forwarded as is: Core verifies it.',
    example: { id: 'k3m9x7p2', rawId: 'k3m9x7p2', type: 'public-key', response: { attestationObject: 'o2NmbXRk', clientDataJSON: 'eyJ0eXBl' } },
  }),
}));
const PasskeyIdParams = z.object({ id: z.coerce.number().int().positive().max(2147483647) });
registry.registerPath({ method: 'get', path: '/settings/passkeys', summary: 'Passkeys of the signed-in user', responses: {
  200: { description: 'The passkeys, oldest first (never the key); empty when there is none', content: { 'application/json': { schema: z.array(PasskeySchema) } } },
  ...upstreamErrors,
} });
router.get('/passkeys', async (req, res) => {
  const { data } = await callUpstream('CORE_API', () => coreApi.listMyPasskeys(asCaller('CORE_API', req)), { declared: [401], retry: true });
  return res.json(z.array(PasskeySchema).parse(data));
});
registry.registerPath({ method: 'post', path: '/settings/passkeys/options', summary: 'Register a passkey: get the challenge', responses: {
  200: { description: 'The WebAuthn creation options; the ceremony lasts two minutes and is read once', content: { 'application/json': { schema: PasskeyRegisterOptionsSchema } } },
  403: { description: 'The administrator does not accept passkeys (two-factor policy)', ...errorContent },
  ...twoFactorErrors,
} });
router.post('/passkeys/options', async (req, res) => {
  const { data } = await callUpstream('CORE_API', () => coreApi.passkeyRegisterOptions(asCaller('CORE_API', req)), { declared: [401, 403] });
  return res.json(PasskeyRegisterOptionsSchema.parse(data));
});
registry.registerPath({ method: 'post', path: '/settings/passkeys', summary: 'Register a passkey: send the browser answer', request: {
  body: { required: true, content: { 'application/json': { schema: PasskeyRegisterSchema } } },
}, responses: {
  201: { description: 'Passkey registered; the agent receives a security e-mail', content: { 'application/json': { schema: PasskeySchema } } },
  400: { description: 'Missing or blank label, no pending registration (never started, expired, already used) or an answer that does not verify', ...errorContent },
  403: { description: 'The administrator does not accept passkeys (two-factor policy)', ...errorContent },
  409: { description: 'This credential is already registered', ...errorContent },
  ...twoFactorErrors,
} });
router.post('/passkeys', async (req, res) => {
  const body = parseRequest(PasskeyRegisterSchema, req.body, 'body');
  const { data } = await callUpstream('CORE_API', () => coreApi.registerPasskey(body as never, asCaller('CORE_API', req)), { declared: [400, 401, 403, 409] });
  return res.status(201).json(PasskeySchema.parse(data));
});
registry.registerPath({ method: 'delete', path: '/settings/passkeys/{id}', summary: 'Delete one of my passkeys', request: { params: PasskeyIdParams }, responses: {
  204: { description: 'Passkey removed; the agent receives a security e-mail' },
  400: { description: 'The id is not a positive integer', ...errorContent },
  404: { description: 'No such passkey among the caller\'s (another account\'s answers the same)', ...errorContent },
  ...upstreamErrors,
} });
router.delete('/passkeys/:id', async (req, res) => {
  const { id } = parseRequest(PasskeyIdParams, req.params, 'params');
  await callUpstream('CORE_API', () => coreApi.deleteMyPasskey(id, asCaller('CORE_API', req)), { declared: [400, 401, 404] });
  return res.status(204).send();
});

// Sessions (MAIR-892, MAIR-823): end one of the other sessions, or all of them. The answer is the sessions read again
// from Core, so the front shows what the server holds.
const SessionsStateSchema = registry.register('SettingsSessions', z.object({
  sessions: z.array(SessionSchema).openapi({ description: 'Active sessions after the change' }),
  session_history: z.array(SessionSchema).openapi({ description: 'First page of the history after the change, newest first' }),
}));
const RevokeOthersResultSchema = registry.register('SettingsRevokeOthers', SessionsStateSchema.extend({
  revoked: z.number().int().openapi({ description: 'Number of sessions ended', example: 2 }),
}));
const SessionIdParams = z.object({ id: z.string().uuid().openapi({ example: '0b6f2a54-3c1d-4e0a-9f41-6d2b1c7e8a90' }) });
const CoreRevokeOthersSchema = z.object({ revoked: z.number().int() });
registry.registerPath({ method: 'delete', path: '/settings/sessions/{id}', summary: 'End one of my other sessions', request: { params: SessionIdParams }, responses: {
  200: { description: 'Session ended; the sessions as Core holds them now', content: { 'application/json': { schema: SessionsStateSchema } } },
  400: { description: 'The id is not a session id', ...errorContent },
  404: { description: 'No active session of the caller has this id (unknown, another account\'s, already ended)', ...errorContent },
  409: { description: 'The id is the session of this request: sign out instead', ...errorContent },
  ...upstreamErrors,
} });
router.delete('/sessions/:id', async (req, res) => {
  const { id } = parseRequest(SessionIdParams, req.params, 'params');
  await callUpstream('CORE_API', () => coreApi.revokeSessionById(id, asCaller('CORE_API', req)), { declared: [400, 401, 404, 409] });
  return res.json(SessionsStateSchema.parse(await readSessions(req)));
});
registry.registerPath({ method: 'post', path: '/settings/sessions/revoke-others', summary: 'End every session but this one', responses: {
  200: { description: 'Other sessions ended; how many, and the sessions as Core holds them now', content: { 'application/json': { schema: RevokeOthersResultSchema } } },
  ...upstreamErrors,
} });
router.post('/sessions/revoke-others', async (req, res) => {
  const { revoked } = await callUpstream(
    'CORE_API',
    async () => CoreRevokeOthersSchema.parse((await coreApi.revokeOtherSessions(asCaller('CORE_API', req))).data),
    { declared: [401] },
  );
  return res.json(RevokeOthersResultSchema.parse({ revoked, ...(await readSessions(req)) }));
});

// Password (MAIR-876, MAIR-823): Core checks the current password (5 checks per user per 15 minutes, right or wrong:
// its 429 is relayed with Retry-After), stores the new one and ends every other session. Never logged nor cached.
const PasswordChangeSchema = registry.register('SettingsPasswordChange', z.object({
  current_password: z.string().min(1).max(255).openapi({ description: 'Current password of the account', example: 'current-password' }),
  new_password: z.string().min(8).max(255).openapi({ description: 'New password, 8 to 255 characters, different from the current one', example: 'New-password-2026' }),
}).strict());
registry.registerPath({ method: 'post', path: '/settings/password', summary: 'Change my password', request: {
  body: { required: true, content: { 'application/json': { schema: PasswordChangeSchema } } },
}, responses: {
  204: { description: 'Password changed; every other session of the account is ended' },
  400: { description: 'Missing field, a new password outside 8-255 characters, or equal to the current one', ...errorContent },
  403: { description: 'Wrong current password, or an account without password', ...errorContent },
  ...upstreamErrors,
} });
router.post('/password', async (req, res) => {
  const body = parseRequest(PasswordChangeSchema, req.body, 'body');
  // Not retried: a retry would spend another password check.
  await callUpstream('CORE_API', () => coreApi.changeMyPassword(body, asCaller('CORE_API', req)), { declared: [400, 401, 403] });
  return res.status(204).send();
});

export default router;

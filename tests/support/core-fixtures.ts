import { createHmac } from 'node:crypto';
import { getCoreAPIMairie360 } from '@mairie360/core-api-openapi/endpoints/coreAPIMairie360';
import type {
  GetMeResponseView, GetSessionsResultView, Group, PatchMeView, SessionSchema, UserNotificationSettings, UserPreferences,
} from '@mairie360/core-api-openapi/model';

// Réponses Core API typées par les modèles du paquet @mairie360/core-api-openapi installé : un champ ajouté,
// retiré ou renommé par le contrat fait échouer la compilation des tests. Elles sont en plus validées à
// l'exécution contre le contrat reconstruit (upstream-contracts.test.ts, mock HTTP). Jetons de session des tests.

/** Chemins des opérations Core API, tels que les construit le client généré (helpers `get*Url`). */
export const coreApiUrls = getCoreAPIMairie360();

export function group(id: number, overrides: Partial<Group> = {}): Group {
  return { id, name: `Groupe ${id}`, description: `Description ${id}`, owner_id: 1, ...overrides };
}

/** Corps de `GET /api/v1/user/me/` (GetMeResponseView). `groups`, `role` et `status` ne sont pas lus par le BFF Settings. */
export function meResponse(overrides: Partial<GetMeResponseView> = {}): GetMeResponseView {
  return {
    email: 'anne.le-gall@mairie.test',
    first_name: 'Anne Marie',
    last_name: 'Le Gall',
    phone: '+33123456789',
    phone_country: 'FR',
    role: 'User',
    roles: ['User'],
    status: 'active',
    groups: [group(1, { name: 'Service urbanisme' })],
    ...overrides,
  };
}

/** Profil attendu en sortie du BFF pour un corps `GET /api/v1/user/me/`. */
export function profileOf(me: GetMeResponseView): Pick<GetMeResponseView, 'first_name' | 'last_name' | 'email' | 'phone' | 'phone_country'> {
  const { first_name, last_name, email, phone, phone_country } = me;
  return { first_name, last_name, email, phone, ...(phone_country === undefined ? {} : { phone_country }) };
}

/** Corps de `PATCH /api/v1/user/me/` (PatchMeView). */
export const patchMe = (patch: PatchMeView): PatchMeView => patch;

/** Session Core (SessionSchema). */
export function session(id: string, overrides: Partial<SessionSchema> = {}): SessionSchema {
  return {
    id,
    device_info: 'Firefox sur Linux',
    ip_address: '192.0.2.10',
    created_at: '2026-09-15T08:00:00Z',
    expires_at: '2026-09-22T08:00:00Z',
    revoked_at: null,
    ...overrides,
  };
}

/** Corps de `GET /api/v1/sessions/` (GetSessionsResultView). */
export const sessionsResult = (sessions: SessionSchema[]): GetSessionsResultView => ({ sessions });

/** Secret of the tests (tests/support/env.ts): the BFF verifies the session tokens with it (bffs-lib requireSession). */
export const JWT_SECRET = 'settings-contract-test-secret';

/** HS256 session token of `userId` signed with `secret`, valid one hour (expired when `expiresIn` is negative). */
export function sessionToken(userId: number | string, secret = JWT_SECRET, expiresIn = 3_600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + expiresIn })).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
}

/** Sessions of Anne (user 7) and of user 42: the BFF verifies them, then forwards them as is to Core API (mock). */
export const SESSION_ANNE = sessionToken(7);
export const SESSION_42 = sessionToken(42);
export const bearer = (token = SESSION_ANNE) => `Bearer ${token}`;

/** Body of `GET`/`PATCH /api/v1/user/me/preferences/` (UserPreferences). */
export function preferences(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    theme: 'dark',
    font_family: 'Marianne',
    font_size: 16,
    density: 'compact',
    language: 'fr',
    timezone: 'Europe/Paris',
    date_format: 'DD/MM/YYYY',
    home_page: '/dashboard',
    auto_open_notifications: false,
    ...overrides,
  };
}

/** Body of `GET`/`PATCH /api/v1/user/me/notifications/` (UserNotificationSettings). */
export function notificationSettings(overrides: Partial<UserNotificationSettings> = {}): UserNotificationSettings {
  return { email: true, push: false, desktop: true, messages: true, projects: true, calendar: false, ...overrides };
}

/** BFF preference sections and the Core operations they relay to (src/routes/settings.ts). */
export const PREFERENCE_SECTIONS = [
  { section: 'appearance', template: '/api/v1/user/me/preferences/', fields: ['theme', 'font_family', 'font_size', 'density'] },
  { section: 'general', template: '/api/v1/user/me/preferences/', fields: ['language', 'timezone', 'date_format', 'home_page', 'auto_open_notifications'] },
  { section: 'notifications', template: '/api/v1/user/me/notifications/', fields: ['email', 'push', 'desktop', 'messages', 'projects', 'calendar'] },
] as const;

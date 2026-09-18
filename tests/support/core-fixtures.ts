import { getCoreAPIMairie360 } from '@mairie360/core-api-openapi/endpoints/coreAPIMairie360';
import type { GetMeResponseView, GetSessionsResultView, Group, PatchMeView, SessionSchema } from '@mairie360/core-api-openapi/model';

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
    role: 'User',
    status: 'active',
    groups: [group(1, { name: 'Service urbanisme' })],
    ...overrides,
  };
}

/** Profil attendu en sortie du BFF pour un corps `GET /api/v1/user/me/`. */
export function profileOf(me: GetMeResponseView): Pick<GetMeResponseView, 'first_name' | 'last_name' | 'email' | 'phone'> {
  const { first_name, last_name, email, phone } = me;
  return { first_name, last_name, email, phone };
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

/** Le BFF Settings ne vérifie que la forme `Bearer <jeton>` : le jeton est transmis tel quel à Core API (simulée). */
export const bearer = (token = 'session-anne') => `Bearer ${token}`;

/**
 * Cibles Core des adaptateurs de préférences (src/routes/settings.ts). Aucune n'existe dans Core API 1.2.0 ni dans
 * son contrat publié : le BFF doit relayer le 404. upstream-contracts.test.ts vérifie qu'elles restent absentes ;
 * quand il échoue, Core les expose et les tests de préférences doivent mocker la vraie opération.
 */
export const PREFERENCE_TARGETS = [
  { section: 'notifications', template: '/api/v1/user/me/notification-settings/' },
  { section: 'appearance', template: '/api/v1/user/me/preferences/' },
  { section: 'general', template: '/api/v1/user/me/preferences/' },
] as const;

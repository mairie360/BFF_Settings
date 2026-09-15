// Réponses Core API conformes au contrat du paquet @mairie360/core-api-openapi installé
// (validées dans upstream-contracts.test.ts) et jetons de session des tests.

export function group(id: number, overrides: Partial<{ name: string; description: string | null; owner_id: number }> = {}) {
  return { id, name: `Groupe ${id}`, description: `Description ${id}`, owner_id: 1, ...overrides };
}

/** Corps de `GET /api/v1/user/me/` (GetMeResponseView). `groups`, `role` et `status` ne sont pas lus par le BFF Settings. */
export function meResponse(overrides: Partial<{ first_name: string; last_name: string; email: string; phone: string | null; role: string; groups: Array<ReturnType<typeof group>> }> = {}) {
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
export function profileOf(me: ReturnType<typeof meResponse>) {
  const { first_name, last_name, email, phone } = me;
  return { first_name, last_name, email, phone };
}

/** Session Core (SessionSchema). */
export function session(id: string, overrides: Partial<{ device_info: string; revoked_at: string | null }> = {}) {
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

/** Le BFF Settings ne vérifie que la forme `Bearer <jeton>` : le jeton est transmis tel quel à Core API (simulée). */
export const bearer = (token = 'session-anne') => `Bearer ${token}`;

/**
 * Cibles Core des adaptateurs de préférences (src/routes/settings.ts). Aucune n'existe dans Core API 1.1.1 ni dans
 * son contrat publié : le BFF doit relayer le 404. upstream-contracts.test.ts vérifie qu'elles restent absentes ;
 * quand il échoue, Core les expose et les tests de préférences doivent mocker la vraie opération.
 */
export const PREFERENCE_TARGETS = [
  { section: 'notifications', template: '/api/v1/user/me/notification-settings/' },
  { section: 'appearance', template: '/api/v1/user/me/preferences/' },
  { section: 'general', template: '/api/v1/user/me/preferences/' },
] as const;

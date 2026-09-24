import { Router } from 'express';
import { z } from 'zod';
import { registry, ErrorSchema } from '../openapi-registry';
import { asCaller, coreApi, coreError } from '../clients/coreClient';
import { authorization, routeError } from '../clients/upstream';

const errorContent = { content: { 'application/json': { schema: ErrorSchema } } };
const passthroughContent = { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } };
// Réponses d'erreur communes : session refusée (BFF ou Core), panne Core (réseau ou 5xx), Core non configuré.
const upstreamErrors = {
  401: { description: 'Session invalide', ...errorContent },
  502: { description: 'Core indisponible', ...errorContent },
  503: { description: 'Core non configuré', ...errorContent },
};

const router = Router();
router.use((req, res, next) => {
  try { authorization(req); next(); } catch (error) { routeError(res, error); }
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
  200: { description: 'Profil et sessions Core de l’utilisateur connecté', content: { 'application/json': { schema: BootstrapSchema } } },
  ...upstreamErrors, 502: { description: 'Profil indisponible', ...errorContent },
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
  } catch (error) { return routeError(res, coreError(error)); }
});
registry.registerPath({ method: 'patch', path: '/settings/profile', request: {
  body: { required: true, content: { 'application/json': { schema: ProfilePatchSchema } } },
}, responses: { 200: { description: 'Profil sauvegardé puis relu', content: { 'application/json': { schema: ProfileSchema } } }, 400: { description: 'Champs invalides ou non pris en charge', ...errorContent }, ...upstreamErrors } });
router.patch('/profile', async (req, res) => {
  const body = ProfilePatchSchema.safeParse(req.body);
  if (!body.success || !Object.keys(body.data).length) return res.status(400).json({ error: { message: 'Les champs autorisés sont prénom, nom, e-mail et téléphone.' } });
  try {
    const patch = typeof body.data.phone === 'string'
      ? { ...body.data, phone: body.data.phone.replace(/[\s.-]/g, '') }
      : body.data;
    await coreApi.patchMe(patch, asCaller(req));
    return res.json(ProfileSchema.parse((await coreApi.getMe(asCaller(req))).data));
  } catch (error) { return routeError(res, coreError(error)); }
});

// Core API n'expose aucune opération de préférences : ces sections répondent 404 et ne simulent jamais
// une sauvegarde locale. Elles relaieront Core dès qu'il publiera les opérations correspondantes.
const preferences = ['notifications', 'appearance', 'general'] as const;
for (const section of preferences) {
  registry.registerPath({ method: 'patch', path: `/settings/${section}`, request: {
    body: { required: true, content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } },
  }, responses: {
    200: { description: 'Préférences enregistrées par Core', ...passthroughContent },
    400: { description: 'Corps de requête invalide', ...errorContent },
    404: { description: 'Fonction non disponible dans Core', ...passthroughContent },
    ...upstreamErrors,
  } });
  router.patch(`/${section}`, (_req, res) => res.status(404).json({
    error: { message: 'Cette préférence n’est pas encore gérée par Core API.' },
  }));
}
export default router;

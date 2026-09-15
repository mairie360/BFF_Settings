import { Router } from 'express';
import { z } from 'zod';
import { registry, ErrorSchema } from '../openapi-registry';
import { authorization, forward, json, routeError } from '../clients/upstream';

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
export const ProfileSchema = registry.register('SettingsProfile', z.object({
  first_name: z.string(), last_name: z.string(), email: z.string().email(), phone: z.string().nullable().optional(),
}));
export const ProfilePatchSchema = registry.register('SettingsProfilePatch', ProfileSchema.partial().strict());
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
    const profile = ProfileSchema.parse(await json(req, 'CORE_API', '/api/v1/user/me/'));
    let sessions: z.infer<typeof SessionSchema>[] = [];
    let sessionSource: 'available' | 'unavailable' = 'unavailable';
    try {
      const response = await json(req, 'CORE_API', '/api/v1/sessions/');
      sessions = z.object({ sessions: z.array(SessionSchema) }).parse(response).sessions;
      sessionSource = 'available';
    } catch { /* Session availability is separate from profile availability. */ }
    return res.json(BootstrapSchema.parse({ profile, sessions, sources: { sessions: sessionSource } }));
  } catch (error) { return routeError(res, error); }
});
registry.registerPath({ method: 'patch', path: '/settings/profile', request: {
  body: { required: true, content: { 'application/json': { schema: ProfilePatchSchema } } },
}, responses: { 200: { description: 'Profil sauvegardé puis relu', content: { 'application/json': { schema: ProfileSchema } } }, 400: { description: 'Champs invalides ou non pris en charge', ...errorContent }, ...upstreamErrors } });
router.patch('/profile', async (req, res) => {
  const body = ProfilePatchSchema.safeParse(req.body);
  if (!body.success || !Object.keys(body.data).length) return res.status(400).json({ error: { message: 'Les champs autorisés sont prénom, nom, e-mail et téléphone.' } });
  try {
    await json(req, 'CORE_API', '/api/v1/user/me/', { method: 'PATCH', body: JSON.stringify(body.data) });
    return res.json(ProfileSchema.parse(await json(req, 'CORE_API', '/api/v1/user/me/')));
  } catch (error) { return routeError(res, error); }
});

// These adapters preserve the owning API's status. They never report a local save.
const preferences = [
  ['notifications', '/api/v1/user/me/notification-settings/'],
  ['appearance', '/api/v1/user/me/preferences/'],
  ['general', '/api/v1/user/me/preferences/'],
] as const;
for (const [section, target] of preferences) {
  registry.registerPath({ method: 'patch', path: `/settings/${section}`, request: {
    body: { required: true, content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } } },
  }, responses: {
    200: { description: 'Préférences enregistrées par Core', ...passthroughContent },
    400: { description: 'Corps de requête invalide', ...errorContent },
    404: { description: 'Fonction non disponible dans Core', ...passthroughContent },
    ...upstreamErrors,
  } });
  router.patch(`/${section}`, (req, res) => forward(req, res, 'CORE_API', target));
}
export default router;

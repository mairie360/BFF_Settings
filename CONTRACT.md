# Contrat BFF / web service

Web services associés : **Settings_Web_Service**. Le document [OpenAPI](contracts/openapi.json), les [types TypeScript](contracts/bff.d.ts), `/openapi.json` et `/swagger.json` proviennent tous de `src/openapi.ts`, qui importe les routes montées par l’application.

## Routes implémentées

Les chemins sont relatifs au BFF. Les proxies web conservent méthode, paramètres, contenu binaire, statuts et cookies. Les chemins `/api/auth/*` restent des adaptateurs de session vers BFF User ; les pages Next.js sont distinctes des routes de données.

| Méthode | Route | Réponse / schéma |
| --- | --- | --- |
| GET | `/health` | 200 OK |
| GET | `/check_apis` | 200 Services disponibles |
| GET | `/settings/bootstrap` | 200 SettingsBootstrap |
| PATCH | `/settings/profile` | 200 SettingsProfile |
| PATCH | `/settings/notifications` | 200 Préférences enregistrées par Core |
| PATCH | `/settings/appearance` | 200 Préférences enregistrées par Core |
| PATCH | `/settings/general` | 200 Préférences enregistrées par Core |

## Mise à jour et validation

Après une modification des routes ou schémas, exécuter `npm run contracts:generate`, puis synchroniser chaque web service associé avec `npm run contracts:sync`. `npm run contracts:check` échoue si le contrat exporté ou les types générés sont périmés. Soumettre les branches associées dans la même livraison.

Le générateur de types est fixé à `openapi-typescript@7.10.1`. Il est exécuté via npm ; aucun jeton privé ne figure dans les contrats.

## Sources

Configurer `CORE_API_URL` (et `CORE_API_PORT` si nécessaire). Le profil utilise les champs Core `first_name`, `last_name`, `email`, `phone`, sans découper un nom complet. La sauvegarde est relue depuis Core. Les sessions excluent les champs internes. Les autres panneaux indiquent leur indisponibilité ; les adaptateurs de préférences préservent la réponse Core et ne créent aucun stockage local.

# BFF_Settings — Documentation technique

[Présentation du module](module.md) · [English](../en/technical.md) · [README](../../README.md)

## Architecture et traitement des requêtes

Serveur Express 5.1.0 écrit en TypeScript. Les schémas Zod et leur registre OpenAPI décrivent les objets échangés; les routeurs adaptent les services amont aux besoins des interfaces.

Le bootstrap valide le profil obligatoire et charge les sessions séparément. La mutation de profil rejette les champs inconnus et les corps vides, transmet un PATCH à Core puis relit le profil. Les préférences notifications ciblent `/notification-settings/`; apparence et général partagent `/preferences/`.

## Données et persistance

Le profil vient de Core `/api/v1/user/me/`; les sessions viennent de `/api/v1/sessions/`. Les champs sont `first_name`, `last_name`, `email` et `phone`. Le schéma des sessions ne conserve que les informations affichables et retire les champs internes. Aucune préférence n’est stockée localement par le BFF.

Les panneaux notifications, apparence, général et système du web service indiquent actuellement leur indisponibilité. La sécurité affiche les sessions, sans gérer les autres réglages. Les adaptateurs de préférences ne garantissent pas que les routes correspondantes soient déployées dans Core.

## Installation et lancement local

Utiliser Node.js 22 pour reproduire le job de contrats et npm avec le fichier de verrouillage versionné. Les versions des autres jobs et de Docker sont précisées plus bas.

Les dépendances directes actuelles ne comprennent pas de client privé `@mairie360/*`. `.npmrc` conserve néanmoins la configuration du registre de cette organisation.

```bash
npm ci
```

Créer `.env` à la racine. Exemple de configuration HTTP locale à adapter aux services démarrés:

```dotenv
PORT=4008
CORE_API_URL=http://localhost:3000
```

```bash
npm run start
```

`PORT` est optionnel; le repli de `src/index.ts` est `4008`.

Vérifier le processus puis consulter la documentation interactive:

```bash
curl --fail --silent --show-error http://localhost:4008/health
```

Interface Swagger: `http://localhost:4008/docs`. Spécification JSON: `/openapi.json`, avec l’alias `/swagger.json`. `/health` vérifie le processus; `/check_apis` est un diagnostic distinct des dépendances.

## Configuration

Les valeurs ci-dessous sont des exemples locaux ou des comportements explicitement indiqués, pas des identifiants de production.

| Variable ou priorité | Exemple / repli indiqué | Rôle |
| --- | --- | --- |
| `PORT` | 4008 | Port de cet exemple local. |
| `CORE_API_URL` | http://localhost:3000 | Adresse de Core; doit être configurée sans suffixe de route. |
| `CORE_API_PORT` | — | Port optionnel si absent de l’URL. |

## Routes et contrat de données

Inventaire extrait de `contracts/openapi.json`. Les paramètres entre accolades sont remplacés par des identifiants réels. Les types détaillés, champs requis, réponses et exemples éventuels sont définis dans ce contrat; les statuts du tableau sont ceux déclarés, sans prétendre lister toutes les erreurs de transport ou de validation.

| Méthode | Chemin | Corps déclaré | Statuts déclarés |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| GET | `/settings/bootstrap` | — | 200, 401, 502, 503 |
| PATCH | `/settings/profile` | application/json | 200, 400, 401, 502, 503 |
| PATCH | `/settings/notifications` | application/json | 200, 400, 401, 404, 502, 503 |
| PATCH | `/settings/appearance` | application/json | 200, 400, 401, 404, 502, 503 |
| PATCH | `/settings/general` | application/json | 200, 400, 401, 404, 502, 503 |

## Session, permissions et erreurs

Toutes les routes `/settings` exigent un Bearer. Les erreurs de profil bloquent le bootstrap; les erreurs de session positionnent `sources.sessions` à `unavailable`. Les appels Core ont un délai de 10 secondes et les réponses métier utilisent `no-store`. Les 4xx de Core sont conservés; une panne Core (réseau, délai ou 5xx) produit 502 sans relayer le corps amont, et un Core non configuré produit 503. Un succès Core sans corps (Core répond 200 vide à `PATCH /api/v1/user/me/`) est accepté, puis le profil est relu.

## Synchronisation et vérifications

```bash
npm run contracts:generate
npm run contracts:check
npm test -- --runInBand
npm run lint
npm run build
```

Les tests de `tests/settings.upstream-mocks.test.ts` exécutent toute l'application avec le vrai client `fetch` contre un serveur HTTP local simulant Core API. Son contrat est reconstruit depuis le paquet `@mairie360/core-api-openapi` installé (types orval, version épinglée dans `package.json`): chaque requête sortante (chemin, paramètres, corps JSON) et chaque réponse de succès simulée est validée contre ce contrat, et chaque réponse du BFF contre `contracts/openapi.json`. Monter la version du paquet suffit à tester le nouveau contrat; les statuts d'erreur ne sont pas typés par orval et sont simulés explicitement. `tests/upstream-contracts.test.ts` épingle la version, les opérations consommées et les écarts connus (réponse de `GET /api/v1/sessions/` mal typée, routes de préférences absentes de Core).

`contracts:generate` exporte le registre runtime dans `contracts/openapi.json` et régénère `contracts/bff.d.ts`. `contracts:check` échoue si le contrat ou les types sont périmés. Exécuter ensuite `npm run contracts:sync` dans chaque web service associé et livrer les modifications de contrat ensemble.

Le générateur de types est fixé à `openapi-typescript@7.10.1` dans `scripts/contracts.mjs` et s’exécute via npm. Pour une modification uniquement documentaire, vérifier les liens, l’exactitude des deux langues et `git diff --check`; ne pas régénérer les contrats sans modification de leur source.

## CI/CD et exécution Docker

Le job `contracts.yml` utilise Node.js 24, `actions/checkout@v7` et `actions/setup-node@v7`. Il s’exécute sur push, pull request et lancement manuel; il installe avec `npm ci`, contrôle les contrats et lance les tests dédiés.

Le fichier `cicd.yml` appelle le workflow partagé `mairie360/CICD` `BFFs-cicd.yml@v3.0.0` (`cicd_version: v3.0.0`, `node_version: "22"`, `openapi_spec_path: contracts/openapi.json`). Les releases sont gérées par semantic-release (`.releaserc.json`).

Le Dockerfile utilise `node:24-alpine` pour la construction et l’exécution; la commande de l’image est `["node", "dist/index.js"]`. Les identifiants GitHub Packages ne sont montés qu’en secrets BuildKit (`npmrc`, `node_auth_token`) pendant `npm ci`.

`security_test.sh` et `performance_test.sh` testent l’image désignée par `IMAGE_REF`: en CI, l’image que `release-dev` vient de publier, soit l’artefact ensuite promu en staging puis en prod. Quand `IMAGE_REF` est vide (usage local), ils construisent d’abord `bff-settings:local` depuis `development.Dockerfile`, ce qui demande `NODE_AUTH_TOKEN` et `./.npmrc`.

`security_test.sh` lance la stack OWASP ZAP de `docker-compose-security.yml`: ZAP rejoue chaque opération de `/openapi.json` avec un JWT admin statique (`sub=1`, HS256, `JWT_SECRET=b"secret"`) et remplit les corps avec les exemples du contrat; `init-test.sql` crée les utilisateurs 1 (Admin) et 2 (User). `PATCH /settings/profile` respecte les colonnes de la base avant d’appeler Core: noms de 1 à 64 caractères sans `<` ni `>`, e-mail de 320 caractères au plus, et téléphone de 10 à 14 chiffres, éventuellement précédés d’un `+` (espaces, points et tirets sont retirés; une valeur vide est conservée).

La stack ZAP porte le hook de couverture OpenAPI de `mairie360/CICD` (`tests/zap/zap_hooks.py`), extrait dans `cicd-repo/` par les jobs CI et cloné au même endroit par `security_test.sh` / `performance_test.sh` au `cicd_version` épinglé (`CICD_VERSION` le remplace). Après le scan, il échoue si une opération du contrat n’a jamais été atteinte, ou si une opération qui exige `bearerAuth` n’a reçu que des 401/403. Les opérations publiques (`/health`, `/check_apis`) déclarent `security: []` dans leur `registerPath` ; une nouvelle route est authentifiée par défaut. La stack k6 importe le module partagé `tests/k6/coverage.js` : `load-test.js` contient un handler par opération de `contracts/openapi.json`, k6 s’arrête à l’init s’il en manque un et échoue sur le seuil `operations_uncovered` si un handler n’envoie pas sa requête. **Ajouter une route implique d’ajouter son handler dans `load-test.js`.** Deux scénarios tournent : `crud` (2 VUs) appelle chaque handler une fois par itération, écritures comprises (le patch du profil restaure les valeurs du seed), et porte la gate ; `reads` (jusqu’à 20 VUs) ne rejoue que les handlers GET. Chaque opération a un seuil `p(95)` fixé par sa famille : 50 ms pour `/health`, 150 ms pour `/check_apis`, 400 ms pour les lectures, 800 ms pour les écritures ; `http_req_failed` doit rester sous 1 %. Les PATCH de préférences (`notifications`, `appearance`, `general`) acceptent leur 404 documenté tant que Core API ne publie pas ces opérations.

Avant un lancement Docker, vérifier les variables de service, les secrets de build et les réseaux dans les fichiers du dépôt. Une CI verte valide ses jobs; elle ne prouve pas la disponibilité des services métier dans un environnement distant.

## Diagnostic

Si le profil charge mais pas les sessions, vérifier `sources.sessions` et la réponse Core `/api/v1/sessions/`. Un PATCH 400 peut venir d’un champ inconnu ou d’un corps vide. Un panneau indisponible ne doit pas être interprété comme une sauvegarde échouée.

## Repères dans le dépôt

- [src/app.ts](../../src/app.ts)
- [src/routes/settings.ts](../../src/routes/settings.ts)
- [src/clients/upstream.ts](../../src/clients/upstream.ts)
- [contracts/openapi.json](../../contracts/openapi.json)
- [contracts/bff.d.ts](../../contracts/bff.d.ts)
- [scripts/contracts.mjs](../../scripts/contracts.mjs)
- [package.json](../../package.json)
- [.github/workflows/contracts.yml](../../.github/workflows/contracts.yml)
- [.github/workflows/cicd.yml](../../.github/workflows/cicd.yml)
- [Dockerfile](../../Dockerfile)
- [docker-compose.yml](../../docker-compose.yml)

Compléments historiques: [CONTRACT.md](../../CONTRACT.md). Les besoins proposés doivent rester distincts du comportement effectivement implémenté.

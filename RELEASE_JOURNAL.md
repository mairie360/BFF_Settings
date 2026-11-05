# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "46af11466c5b96d4f42d5dd824c17a7aa74fcfc3", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-05 03:48 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `46af114` | 2026-11-05 03:48 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Changements de comportement

- Les tokens de session sont désormais vérifiés avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA, `iss`/`aud`) au lieu du secret HS256 partagé. Un token HS256 est refusé (401, sans appel à Core) dès que `JWT_SECRET` n'est plus défini ; il n'est accepté que pendant la transition, tant que `JWT_SECRET` reste en place. Le démarrage échoue sans `JWT_PUBLIC_KEY` valide : les déploiements doivent fournir la clé avant cette version. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- La réponse 503 des routes `/settings` nomme désormais la clé de session (`JWT_PUBLIC_KEY`, ou `JWT_SECRET` pendant la transition) au lieu de `JWT_SECRET` seul. Changement de description du contrat uniquement. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))

#### Technique

- Test de la relance du 429 de Core sur `PATCH /settings/profile` (Retry-After relayé, sans corps ni re-lecture) et documentation du 429 ; la collection d'intégration vérifie la limite des contrôles de mot de passe avec Core à limiteur actif. Aucun changement de code métier. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106), [#111](https://github.com/mairie360/BFF_Settings/pull/111))
- Tests d'intégration sur stack réelle (`docker-compose-integration.yml`, `integration_test.sh`, collection newman) et test de non-régression des logs (marqueur RGPD MAIR-290), ainsi que la simulation RGPD MAIR-497 et le contrôle RGPD des PR MAIR-295 : outillage de CI, sans effet visible. ([#95](https://github.com/mairie360/BFF_Settings/pull/95), [#56](https://github.com/mairie360/BFF_Settings/pull/56), [#60](https://github.com/mairie360/BFF_Settings/pull/60), [#108](https://github.com/mairie360/BFF_Settings/pull/108))
- Workflows CICD montés en v5.2.2 puis v5.3.1 (contrôles RGPD, clé `ANTHROPIC_WORKSPACE_ID`) ; le Dockerfile de production et `development.Dockerfile` passent sur `node:24.22.1-alpine` épinglé par digest, et le conteneur de développement tourne en utilisateur `node`. ([#102](https://github.com/mairie360/BFF_Settings/pull/102), [#96](https://github.com/mairie360/BFF_Settings/pull/96), [#108](https://github.com/mairie360/BFF_Settings/pull/108))
- Mises à jour de dépendances : `zod` 4.6.5 vers 4.6.7 ; images Docker et actions GitHub épinglées par digest (node, postgres, redis, curl, k6, newman, ZAP, checkout, setup-node). ([#60](https://github.com/mairie360/BFF_Settings/pull/60), [#103](https://github.com/mairie360/BFF_Settings/pull/103), [#112](https://github.com/mairie360/BFF_Settings/pull/112))

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement

- Les tokens de session sont désormais vérifiés avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA, `iss`/`aud`) au lieu du secret HS256 partagé. Un token HS256 est refusé (401, sans appel à Core) dès que `JWT_SECRET` n'est plus défini ; il n'est accepté que pendant la transition, tant que `JWT_SECRET` reste en place. Le démarrage échoue sans `JWT_PUBLIC_KEY` valide : les déploiements doivent fournir la clé avant cette version. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- La réponse 503 des routes `/settings` nomme désormais la clé de session (`JWT_PUBLIC_KEY`, ou `JWT_SECRET` pendant la transition) au lieu de `JWT_SECRET` seul. Changement de description du contrat uniquement. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))

#### Technique

- Test de la relance du 429 de Core sur `PATCH /settings/profile` (Retry-After relayé, sans corps ni re-lecture) et documentation du 429 ; la collection d'intégration vérifie la limite des contrôles de mot de passe avec Core à limiteur actif. Aucun changement de code métier. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106), [#111](https://github.com/mairie360/BFF_Settings/pull/111))
- Tests d'intégration sur stack réelle (`docker-compose-integration.yml`, `integration_test.sh`, collection newman) et test de non-régression des logs (marqueur RGPD MAIR-290), ainsi que la simulation RGPD MAIR-497 et le contrôle RGPD des PR MAIR-295 : outillage de CI, sans effet visible. ([#95](https://github.com/mairie360/BFF_Settings/pull/95), [#56](https://github.com/mairie360/BFF_Settings/pull/56), [#60](https://github.com/mairie360/BFF_Settings/pull/60), [#108](https://github.com/mairie360/BFF_Settings/pull/108))
- Workflows CICD montés en v5.2.2 puis v5.3.1 (contrôles RGPD, clé `ANTHROPIC_WORKSPACE_ID`) ; le Dockerfile de production et `development.Dockerfile` passent sur `node:24.22.1-alpine` épinglé par digest, et le conteneur de développement tourne en utilisateur `node`. ([#102](https://github.com/mairie360/BFF_Settings/pull/102), [#96](https://github.com/mairie360/BFF_Settings/pull/96), [#108](https://github.com/mairie360/BFF_Settings/pull/108))
- Mises à jour de dépendances : `zod` 4.6.5 vers 4.6.7 ; images Docker et actions GitHub épinglées par digest (node, postgres, redis, curl, k6, newman, ZAP, checkout, setup-node). ([#60](https://github.com/mairie360/BFF_Settings/pull/60), [#103](https://github.com/mairie360/BFF_Settings/pull/103), [#112](https://github.com/mairie360/BFF_Settings/pull/112))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-11-05 03:48 UTC | dev | — | `46af114` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41963322108) |
| 2026-11-04 18:18 UTC | dev | — | `4c98fea` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41882714898) |
| 2026-11-04 16:54 UTC | dev | — | `9e686f8` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41870269863) |
| 2026-11-03 14:24 UTC | dev | — | `8e71fbf` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41652119314) |
| 2026-11-03 02:00 UTC | dev | — | `f3b3486` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41562914876) |
| 2026-11-02 23:03 UTC | dev | — | `ba51ccd` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41540047195) |
| 2026-11-02 23:00 UTC | dev | — | `c6507aa` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41540030537) |
| 2026-11-01 12:44 UTC | dev | — | `7e8d81e` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41307570178) |
| 2026-11-01 12:41 UTC | dev | — | `c0ac035` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/41307315971) |
| 2026-10-23 13:10 UTC | dev | — | `612ee8d` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39958448175) |
| 2026-10-22 09:01 UTC | dev | — | `d1cb6d3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39751733785) |
| 2026-10-21 10:09 UTC | prod | v2.1.0 | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39580923950) |
| 2026-10-21 09:56 UTC | staging | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39580016456) |
| 2026-10-21 09:48 UTC | dev | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39579115592) |
| 2026-10-21 01:39 UTC | dev | — | `61164e3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39528053667) |
| 2026-10-20 18:20 UTC | dev | — | `b899612` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39473382143) |
| 2026-10-20 18:10 UTC | staging | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

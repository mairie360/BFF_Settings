# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "612ee8d60aed17d9d50476b28c0bc4569890ab58", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-10-23 13:10 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `612ee8d` | 2026-10-23 13:10 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Node.js passe de `24` à `24.22.1` (correctif de sécurité) dans `cicd.yml`, `contracts.yml` et tous les Dockerfiles, avec des images épinglées par digest. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- `development.Dockerfile` : le conteneur de développement tourne désormais sous l'utilisateur non-root `node` (`chown -R node:node /app` puis `USER node`). ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Suite de tests d'intégration sur stack réelle (MAIR-262) : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman rejouée par newman (`tests/postman/`) et garde jest `tests/integration-collection.test.ts`. Elle sert de porte `integration_tests` à la promotion staging. ([#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Workflows partagés `mairie360/CICD` passés de `v4.4.3` à `v4.5.0` dans `cicd.yml`, `promote-staging.yml` et `promote-prod.yml`. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Documentation FR/EN et `CLAUDE.md` mis à jour (version Node, tests d'intégration). ([#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Node.js passe de `24` à `24.22.1` (correctif de sécurité) dans `cicd.yml`, `contracts.yml` et tous les Dockerfiles, avec des images épinglées par digest. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- `development.Dockerfile` : le conteneur de développement tourne désormais sous l'utilisateur non-root `node` (`chown -R node:node /app` puis `USER node`). ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Suite de tests d'intégration sur stack réelle (MAIR-262) : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman rejouée par newman (`tests/postman/`) et garde jest `tests/integration-collection.test.ts`. Elle sert de porte `integration_tests` à la promotion staging. ([#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Workflows partagés `mairie360/CICD` passés de `v4.4.3` à `v4.5.0` dans `cicd.yml`, `promote-staging.yml` et `promote-prod.yml`. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Documentation FR/EN et `CLAUDE.md` mis à jour (version Node, tests d'intégration). ([#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

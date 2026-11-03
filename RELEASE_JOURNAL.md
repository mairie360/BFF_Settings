# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "f3b3486aef4c660d35d729ced0a9e8f9b3db0ac3", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-03 02:00 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `f3b3486` | 2026-11-03 02:00 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Les images Node.js passent au correctif 24.22.1 : `Dockerfile` et `development.Dockerfile` (images `node:24.22.1-alpine` épinglées par digest), `node_version` de `cicd.yml`, `node-version` de `contracts.yml`. Dans l'image de développement, le conteneur tourne désormais avec l'utilisateur non-root `node`. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Dépendances épinglées par digest par Renovate : `actions/checkout`, `actions/setup-node` et les images des stacks de test (postgres, redis, curl, node, k6, newman, zap). ([#103](https://github.com/mairie360/BFF_Settings/pull/103))
- Passage de `mairie360/CICD` à la v5.2.2 dans `cicd.yml`, `gdpr-pr.yml`, `promote-staging.yml` et `promote-prod.yml`, avec `ANTHROPIC_WORKSPACE_ID` transmis à `cicd.yml` et `promote-prod.yml`. Ajout du test `tests/mair-771-cicd-version.test.ts`. (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102))
- Test de non-régression sur `PATCH /settings/profile` : Core répond 429 avec `Retry-After`, le BFF le relaie à l'identique. Aucun changement de code. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106))
- Checklist RGPD sur les pull requests (workflow `gdpr-pr.yml`) et bump de `zod` 4.6.5 → 4.6.7. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Test du marqueur RGPD dans les journaux (`gdpr-marker.yaml`, `docker-compose-gdpr-marker.yml`, `gdpr_marker_test.sh`), sans changement de `src/`. (MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56))
- Tests d'intégration sur stack réelle : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman newman, et test jest de couverture. Ajout de `CLAUDE.md` et de la doc. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Les images Node.js passent au correctif 24.22.1 : `Dockerfile` et `development.Dockerfile` (images `node:24.22.1-alpine` épinglées par digest), `node_version` de `cicd.yml`, `node-version` de `contracts.yml`. Dans l'image de développement, le conteneur tourne désormais avec l'utilisateur non-root `node`. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Dépendances épinglées par digest par Renovate : `actions/checkout`, `actions/setup-node` et les images des stacks de test (postgres, redis, curl, node, k6, newman, zap). ([#103](https://github.com/mairie360/BFF_Settings/pull/103))
- Passage de `mairie360/CICD` à la v5.2.2 dans `cicd.yml`, `gdpr-pr.yml`, `promote-staging.yml` et `promote-prod.yml`, avec `ANTHROPIC_WORKSPACE_ID` transmis à `cicd.yml` et `promote-prod.yml`. Ajout du test `tests/mair-771-cicd-version.test.ts`. (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102))
- Test de non-régression sur `PATCH /settings/profile` : Core répond 429 avec `Retry-After`, le BFF le relaie à l'identique. Aucun changement de code. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106))
- Checklist RGPD sur les pull requests (workflow `gdpr-pr.yml`) et bump de `zod` 4.6.5 → 4.6.7. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Test du marqueur RGPD dans les journaux (`gdpr-marker.yaml`, `docker-compose-gdpr-marker.yml`, `gdpr_marker_test.sh`), sans changement de `src/`. (MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56))
- Tests d'intégration sur stack réelle : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman newman, et test jest de couverture. Ajout de `CLAUDE.md` et de la doc. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

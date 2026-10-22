# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "d1cb6d3f4d925dd27198cd6b002309a051c1ef2b", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-10-22 09:01 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `d1cb6d3` | 2026-10-22 09:01 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Tests d'intégration sur la vraie stack (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95)) : `docker-compose-integration.yml` et `integration_test.sh` lancent Core API, la base et Redis, puis rejouent `tests/postman/collection.json` avec newman contre le BFF. `tests/integration-collection.test.ts` vérifie la collection côté jest.
- Promotion staging : `promote-staging.yml` ajoute un job `integration_tests` qui bloque la promotion en cas d'échec. `cicd.yml`, `promote-staging.yml` et `promote-prod.yml` passent à mairie360/CICD v4.5.0.
- Aucun changement de route, de réponse ou de règle métier n'apparaît dans les fichiers visibles du diff, qui est tronqué au milieu de `docker-compose-integration.yml`.

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Tests d'intégration sur la vraie stack (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95)) : `docker-compose-integration.yml` et `integration_test.sh` lancent Core API, la base et Redis, puis rejouent `tests/postman/collection.json` avec newman contre le BFF. `tests/integration-collection.test.ts` vérifie la collection côté jest.
- Promotion staging : `promote-staging.yml` ajoute un job `integration_tests` qui bloque la promotion en cas d'échec. `cicd.yml`, `promote-staging.yml` et `promote-prod.yml` passent à mairie360/CICD v4.5.0.
- Aucun changement de route, de réponse ou de règle métier n'apparaît dans les fichiers visibles du diff, qui est tronqué au milieu de `docker-compose-integration.yml`.

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-22 09:01 UTC | dev | — | `d1cb6d3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39751733785) |
| 2026-10-21 10:09 UTC | prod | v2.1.0 | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39580923950) |
| 2026-10-21 09:56 UTC | staging | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39580016456) |
| 2026-10-21 09:48 UTC | dev | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39579115592) |
| 2026-10-21 01:39 UTC | dev | — | `61164e3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39528053667) |
| 2026-10-20 18:20 UTC | dev | — | `b899612` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39473382143) |
| 2026-10-20 18:10 UTC | staging | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "8e71fbfea152f99d033ba50e5a5dc6a85ce4c313", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-03 14:24 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `8e71fbf` | 2026-11-03 14:24 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Changements de comportement
- Les routes `/settings/*` vérifient désormais le JWT de session avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA sous le `kid` de Core, avec `iss` et `aud`). Un token HS256 signé avec l'ancien secret reçoit un 401 sans appel à Core quand `JWT_SECRET` n'est pas défini ; HS256 n'est accepté que pendant la transition, tant que `JWT_SECRET` est défini. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- Le BFF refuse de démarrer sans `JWT_PUBLIC_KEY` ou avec une clé mal formée (`assertStartupConfiguration()`) : chaque déploiement doit fournir la clé avant la mise en service. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- Le 503 documenté des routes `/settings` a un nouveau libellé : « Core or the session key (JWT_PUBLIC_KEY, or JWT_SECRET during the HS256 transition) is not configured ». Un appelant qui lit ce texte doit en tenir compte. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))

#### Technique
- Les stacks de test signent les tokens en EdDSA avec une paire de clés Ed25519 générée à chaque run (`stack_secrets.sh`) ; seul Core détient la clé privée, et `core-api` est épinglé à `dev-3b40c2a`. Le diff de cette PR est tronqué : le comportement ci-dessus est déduit des fichiers visibles et de la description. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- Test de non-régression du relais du 429 de Core avec son `Retry-After` sur `PATCH /settings/profile` ; aucun changement de code, le test passe aussi sur l'ancien code. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106))
- Workflows CICD montés en v5.2.2, `ANTHROPIC_WORKSPACE_ID` transmis, et nouvelle garde `tests/mair-771-cicd-version.test.ts`. (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102))
- Checklist RGPD sur les PR (`gdpr-pr.yml`), marqueur RGPD des journaux (`gdpr-marker.yaml`, `docker-compose-gdpr-marker.yml`, `gdpr_marker_test.sh`) et mise à jour de zod en 4.6.7. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60) ; MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56))
- Stack d'intégration newman (`integration_test.sh`, `docker-compose-integration.yml`, collection Postman) : porte `integration_tests` de la promotion staging. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Images et actions épinglées par digest (Renovate, [#103](https://github.com/mairie360/BFF_Settings/pull/103)) ; Node 24.22.1 pour CI et Dockerfiles, et image de développement lancée en utilisateur `node` ([#96](https://github.com/mairie360/BFF_Settings/pull/96)).

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- Les routes `/settings/*` vérifient désormais le JWT de session avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA sous le `kid` de Core, avec `iss` et `aud`). Un token HS256 signé avec l'ancien secret reçoit un 401 sans appel à Core quand `JWT_SECRET` n'est pas défini ; HS256 n'est accepté que pendant la transition, tant que `JWT_SECRET` est défini. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- Le BFF refuse de démarrer sans `JWT_PUBLIC_KEY` ou avec une clé mal formée (`assertStartupConfiguration()`) : chaque déploiement doit fournir la clé avant la mise en service. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- Le 503 documenté des routes `/settings` a un nouveau libellé : « Core or the session key (JWT_PUBLIC_KEY, or JWT_SECRET during the HS256 transition) is not configured ». Un appelant qui lit ce texte doit en tenir compte. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))

#### Technique
- Les stacks de test signent les tokens en EdDSA avec une paire de clés Ed25519 générée à chaque run (`stack_secrets.sh`) ; seul Core détient la clé privée, et `core-api` est épinglé à `dev-3b40c2a`. Le diff de cette PR est tronqué : le comportement ci-dessus est déduit des fichiers visibles et de la description. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))
- Test de non-régression du relais du 429 de Core avec son `Retry-After` sur `PATCH /settings/profile` ; aucun changement de code, le test passe aussi sur l'ancien code. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106))
- Workflows CICD montés en v5.2.2, `ANTHROPIC_WORKSPACE_ID` transmis, et nouvelle garde `tests/mair-771-cicd-version.test.ts`. (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102))
- Checklist RGPD sur les PR (`gdpr-pr.yml`), marqueur RGPD des journaux (`gdpr-marker.yaml`, `docker-compose-gdpr-marker.yml`, `gdpr_marker_test.sh`) et mise à jour de zod en 4.6.7. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60) ; MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56))
- Stack d'intégration newman (`integration_test.sh`, `docker-compose-integration.yml`, collection Postman) : porte `integration_tests` de la promotion staging. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Images et actions épinglées par digest (Renovate, [#103](https://github.com/mairie360/BFF_Settings/pull/103)) ; Node 24.22.1 pour CI et Dockerfiles, et image de développement lancée en utilisateur `node` ([#96](https://github.com/mairie360/BFF_Settings/pull/96)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

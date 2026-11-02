# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "ba51ccd5f490195f9491fdab5bc7d23ec698391d", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-02 23:03 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `ba51ccd` | 2026-11-02 23:03 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Test de non-régression sans changement de code : le 429 de Core sur `PATCH /settings/profile` est relayé en 429 avec le même `Retry-After`, l'enveloppe `TOO_MANY_REQUESTS` et sans détail de Core. Le test passe aussi sur l'ancien code (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106)).
- Workflows CI/CD (`cicd.yml`, `promote-staging.yml`, `promote-prod.yml`, `gdpr-pr.yml`) passés à mairie360/CICD v5.2.2, avec `ANTHROPIC_WORKSPACE_ID` transmis et un test jest qui vérifie la version et la clé de l'IA (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102)).
- Contrôle RGPD des journaux : stack `docker-compose-gdpr-marker.yml`, scénario `gdpr-marker.yaml` et script `gdpr_marker_test.sh` qui cherchent les valeurs du marqueur dans les logs de chaque conteneur, plus un test unitaire qui vérifie qu'une erreur upstream ne journalise ni le token ni les valeurs du profil. Le diff est tronqué : la partie de `tests/settings.upstream-mocks.test.ts` n'est pas visible (MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56)).
- Checklist RGPD sur les pull requests : nouveau workflow `gdpr-pr.yml` (épinglé sur la branche `mair-295-gdpr-pr-checklist` de CICD), `zod` 4.6.5 → 4.6.7 et règle Renovate élargie à `gdpr-pr.yml` (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60)).
- Node.js 24.22.1 : images Docker épinglées par digest, `contracts.yml` et `cicd.yml` alignés sur 24.22.1. `development.Dockerfile` exécute désormais le conteneur de développement avec l'utilisateur non-root `node` ([#96](https://github.com/mairie360/BFF_Settings/pull/96)).
- Tests d'intégration sur stack réelle : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman newman et test jest de couverture, CICD passé à v4.5.0 (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95)).

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Test de non-régression sans changement de code : le 429 de Core sur `PATCH /settings/profile` est relayé en 429 avec le même `Retry-After`, l'enveloppe `TOO_MANY_REQUESTS` et sans détail de Core. Le test passe aussi sur l'ancien code (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106)).
- Workflows CI/CD (`cicd.yml`, `promote-staging.yml`, `promote-prod.yml`, `gdpr-pr.yml`) passés à mairie360/CICD v5.2.2, avec `ANTHROPIC_WORKSPACE_ID` transmis et un test jest qui vérifie la version et la clé de l'IA (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102)).
- Contrôle RGPD des journaux : stack `docker-compose-gdpr-marker.yml`, scénario `gdpr-marker.yaml` et script `gdpr_marker_test.sh` qui cherchent les valeurs du marqueur dans les logs de chaque conteneur, plus un test unitaire qui vérifie qu'une erreur upstream ne journalise ni le token ni les valeurs du profil. Le diff est tronqué : la partie de `tests/settings.upstream-mocks.test.ts` n'est pas visible (MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56)).
- Checklist RGPD sur les pull requests : nouveau workflow `gdpr-pr.yml` (épinglé sur la branche `mair-295-gdpr-pr-checklist` de CICD), `zod` 4.6.5 → 4.6.7 et règle Renovate élargie à `gdpr-pr.yml` (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60)).
- Node.js 24.22.1 : images Docker épinglées par digest, `contracts.yml` et `cicd.yml` alignés sur 24.22.1. `development.Dockerfile` exécute désormais le conteneur de développement avec l'utilisateur non-root `node` ([#96](https://github.com/mairie360/BFF_Settings/pull/96)).
- Tests d'intégration sur stack réelle : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman newman et test jest de couverture, CICD passé à v4.5.0 (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

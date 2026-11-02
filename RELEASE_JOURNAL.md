# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "c6507aacbeb438dcdfd0f9fe7d8e8ab46ff2b8a0", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-02 23:00 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `c6507aa` | 2026-11-02 23:00 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Tests et CI : `cicd.yml`, `gdpr-pr.yml`, `promote-staging.yml` et `promote-prod.yml` passent à mairie360/CICD v5.2.2, avec `ANTHROPIC_WORKSPACE_ID` transmis aux workflows CI et prod. Le check « GDPR checklist » est ajouté sur chaque PR, la stack de marqueur RGPD des logs et les tests d'intégration newman (`integration_test.sh`, collection Postman) sont ajoutés, sans changement de `src/`. (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102) ; MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60) ; MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56) ; MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Dépendances et images : Node.js épinglé à 24.22.1 (CI, Dockerfiles par digest, documentation), `zod` passe de 4.6.5 à 4.6.7, et `development.Dockerfile` s'exécute désormais en utilisateur `node`. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Tests et CI : `cicd.yml`, `gdpr-pr.yml`, `promote-staging.yml` et `promote-prod.yml` passent à mairie360/CICD v5.2.2, avec `ANTHROPIC_WORKSPACE_ID` transmis aux workflows CI et prod. Le check « GDPR checklist » est ajouté sur chaque PR, la stack de marqueur RGPD des logs et les tests d'intégration newman (`integration_test.sh`, collection Postman) sont ajoutés, sans changement de `src/`. (MAIR-771, [#102](https://github.com/mairie360/BFF_Settings/pull/102) ; MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60) ; MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56) ; MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))
- Dépendances et images : Node.js épinglé à 24.22.1 (CI, Dockerfiles par digest, documentation), `zod` passe de 4.6.5 à 4.6.7, et `development.Dockerfile` s'exécute désormais en utilisateur `node`. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "c0ac035cda5f450432bb9f6a2faed2a1c8027138", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-01 12:41 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `c0ac035` | 2026-11-01 12:41 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Nouveau workflow `gdpr-pr.yml` qui exécute la checklist RGPD sur chaque pull request : la section « Personal data » de la description doit être renseignée, et un « Yes » doit être accompagné de l'inventaire `gdpr/inventory.yaml`. Il est épinglé sur la branche `mair-295-gdpr-pr-checklist` de mairie360/CICD en attendant la release. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Node.js épinglé en 24.22.1 dans `cicd.yml`, `contracts.yml` et les images `node:24.22.1-alpine` pinnées par digest ; le conteneur de développement tourne désormais sous l'utilisateur non root `node` ; `zod` passe en 4.6.7 et `renovate.json` est mis à jour. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Tests d'intégration sur une vraie stack Core API : `docker-compose-integration.yml`, `integration_test.sh` et une collection Postman rejouée par newman contre le BFF, avec un test jest de garde. La porte `integration_tests` s'ajoute à la promotion staging, et les workflows de release passent en mairie360/CICD v4.5.0. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Nouveau workflow `gdpr-pr.yml` qui exécute la checklist RGPD sur chaque pull request : la section « Personal data » de la description doit être renseignée, et un « Yes » doit être accompagné de l'inventaire `gdpr/inventory.yaml`. Il est épinglé sur la branche `mair-295-gdpr-pr-checklist` de mairie360/CICD en attendant la release. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Node.js épinglé en 24.22.1 dans `cicd.yml`, `contracts.yml` et les images `node:24.22.1-alpine` pinnées par digest ; le conteneur de développement tourne désormais sous l'utilisateur non root `node` ; `zod` passe en 4.6.7 et `renovate.json` est mis à jour. ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Tests d'intégration sur une vraie stack Core API : `docker-compose-integration.yml`, `integration_test.sh` et une collection Postman rejouée par newman contre le BFF, avec un test jest de garde. La porte `integration_tests` s'ajoute à la promotion staging, et les workflows de release passent en mairie360/CICD v4.5.0. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

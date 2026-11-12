# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "46af11466c5b96d4f42d5dd824c17a7aa74fcfc3", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "46af11466c5b96d4f42d5dd824c17a7aa74fcfc3", "updated": {"dev": "2026-11-05 03:48 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-11-12 18:58 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `46af114` | 2026-11-12 18:58 UTC |
| dev | — | `46af114` | 2026-11-05 03:48 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

- chore(deps): pin node.js to c86ecea (#112) ([#112](https://github.com/mairie360/BFF_Settings/pull/112))
- feat: MAIR-497 GDPR - Usage simulation and AI review of logs and database before prod ([#108](https://github.com/mairie360/BFF_Settings/pull/108))
- test: MAIR-746 [Audit 30/10] BFF_Settings / Core : vérification du mot de passe sans limiteur via PATCH /settings/profile (N4) (#111) ([#111](https://github.com/mairie360/BFF_Settings/pull/111))
- fix: MAIR-680 [Audit 23/10] Toutes les APIs et BFFs : remplacer le secret JWT HS256 partagé par 12 services (A1) ([#109](https://github.com/mairie360/BFF_Settings/pull/109))
- chore(deps): pin dependencies (#103) ([#103](https://github.com/mairie360/BFF_Settings/pull/103))
- fix: MAIR-746 [Audit 30/10] BFF_Settings / Core : vérification du mot de passe sans limiteur via PATCH /settings/profile (N4) (#106) ([#106](https://github.com/mairie360/BFF_Settings/pull/106))
- ci: MAIR-771 APIs, BFFs, Database : monter CICD en v5.2.2 pour activer les contrôles RGPD (#102) ([#102](https://github.com/mairie360/BFF_Settings/pull/102))
- fix: MAIR-290 Détecter les données personnelles dans les journaux avec un test du marqueur (#56) ([#56](https://github.com/mairie360/BFF_Settings/pull/56))
- ci: MAIR-295 Ajouter une checklist RGPD aux PR et des rappels d'échéances automatiques (#60) ([#60](https://github.com/mairie360/BFF_Settings/pull/60))
- fix(security): patch Node.js runtime and toolchain (#96) ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- feat: MAIR-262 Tests d'intégration - Tests de fonctionnement des APIs, tests métier des BFFs et tests de régression (#95) ([#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence dev → staging (en dev, pas encore en staging)

_Rien._

## Différence staging → prod (en staging, pas encore en prod)

- chore(deps): pin node.js to c86ecea (#112) ([#112](https://github.com/mairie360/BFF_Settings/pull/112))
- feat: MAIR-497 GDPR - Usage simulation and AI review of logs and database before prod ([#108](https://github.com/mairie360/BFF_Settings/pull/108))
- test: MAIR-746 [Audit 30/10] BFF_Settings / Core : vérification du mot de passe sans limiteur via PATCH /settings/profile (N4) (#111) ([#111](https://github.com/mairie360/BFF_Settings/pull/111))
- fix: MAIR-680 [Audit 23/10] Toutes les APIs et BFFs : remplacer le secret JWT HS256 partagé par 12 services (A1) ([#109](https://github.com/mairie360/BFF_Settings/pull/109))
- chore(deps): pin dependencies (#103) ([#103](https://github.com/mairie360/BFF_Settings/pull/103))
- fix: MAIR-746 [Audit 30/10] BFF_Settings / Core : vérification du mot de passe sans limiteur via PATCH /settings/profile (N4) (#106) ([#106](https://github.com/mairie360/BFF_Settings/pull/106))
- ci: MAIR-771 APIs, BFFs, Database : monter CICD en v5.2.2 pour activer les contrôles RGPD (#102) ([#102](https://github.com/mairie360/BFF_Settings/pull/102))
- fix: MAIR-290 Détecter les données personnelles dans les journaux avec un test du marqueur (#56) ([#56](https://github.com/mairie360/BFF_Settings/pull/56))
- ci: MAIR-295 Ajouter une checklist RGPD aux PR et des rappels d'échéances automatiques (#60) ([#60](https://github.com/mairie360/BFF_Settings/pull/60))
- fix(security): patch Node.js runtime and toolchain (#96) ([#96](https://github.com/mairie360/BFF_Settings/pull/96))
- feat: MAIR-262 Tests d'intégration - Tests de fonctionnement des APIs, tests métier des BFFs et tests de régression (#95) ([#95](https://github.com/mairie360/BFF_Settings/pull/95))

> Résumé Claude indisponible pour ce passage : listes brutes des commits.

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-11-12 18:58 UTC | staging | — | `46af114` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/43284325814) |
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

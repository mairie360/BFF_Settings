# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "7e8d81ea83ea12869056d683343b8f4600ef5afe", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-01 12:44 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `7e8d81e` | 2026-11-01 12:44 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Technique
- Test de non-régression RGPD (MAIR-290) : le test `MAIR-290 logs an upstream failure without the token, the profile values or the upstream body` vérifie qu'une erreur Core API 500 relayée en 502 sur `PATCH /settings/profile` ne laisse ni le jeton, ni les noms et téléphone envoyés, ni le corps amont dans les journaux. Une étape CI `gdpr_marker` (`gdpr_marker_test.sh`, `docker-compose-gdpr-marker.yml`, `gdpr-marker.yaml`) rejoue ce parcours et cherche ces valeurs dans les journaux de chaque conteneur. (MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56))
- Workflow `gdpr-pr.yml` sur chaque pull request : il contrôle que la section « Personal data » de la description est remplie et qu'un « Yes » est accompagné de l'inventaire. Il ne touche pas au code du BFF. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Mise à jour de la dépendance `zod` de 4.6.5 à 4.6.7 dans `package.json`, et adaptation de `renovate.json` au nouveau workflow. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Node.js épinglé à 24.22.1 dans les workflows, les images Docker (digest vérifié) et la documentation. `development.Dockerfile` lance le conteneur de développement avec l'utilisateur `node` et non `root`. (sans clé Jira, [#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Tests d'intégration sur la vraie stack : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman rejouée par newman et test jest de garde. Les workflows de release passent sur `mairie360/CICD` v4.5.0. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Test de non-régression RGPD (MAIR-290) : le test `MAIR-290 logs an upstream failure without the token, the profile values or the upstream body` vérifie qu'une erreur Core API 500 relayée en 502 sur `PATCH /settings/profile` ne laisse ni le jeton, ni les noms et téléphone envoyés, ni le corps amont dans les journaux. Une étape CI `gdpr_marker` (`gdpr_marker_test.sh`, `docker-compose-gdpr-marker.yml`, `gdpr-marker.yaml`) rejoue ce parcours et cherche ces valeurs dans les journaux de chaque conteneur. (MAIR-290, [#56](https://github.com/mairie360/BFF_Settings/pull/56))
- Workflow `gdpr-pr.yml` sur chaque pull request : il contrôle que la section « Personal data » de la description est remplie et qu'un « Yes » est accompagné de l'inventaire. Il ne touche pas au code du BFF. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Mise à jour de la dépendance `zod` de 4.6.5 à 4.6.7 dans `package.json`, et adaptation de `renovate.json` au nouveau workflow. (MAIR-295, [#60](https://github.com/mairie360/BFF_Settings/pull/60))
- Node.js épinglé à 24.22.1 dans les workflows, les images Docker (digest vérifié) et la documentation. `development.Dockerfile` lance le conteneur de développement avec l'utilisateur `node` et non `root`. (sans clé Jira, [#96](https://github.com/mairie360/BFF_Settings/pull/96))
- Tests d'intégration sur la vraie stack : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman rejouée par newman et test jest de garde. Les workflows de release passent sur `mairie360/CICD` v4.5.0. (MAIR-262, [#95](https://github.com/mairie360/BFF_Settings/pull/95))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

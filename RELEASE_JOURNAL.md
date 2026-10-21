# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod": "cec91efc2017916ccc1998748a2b66bcbfa1df93", "prod_tag": "v2.0.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-10-21 09:48 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.0.0 | `cec91ef` | — |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `59441d2` | 2026-10-21 09:48 UTC |

## Ajouté sur main depuis la dernière release prod (v2.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry : le BFF exporte ses traces et ses métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` quand la variable est définie ; sans elle, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent (ni URL, ni query string, ni en-tête, ni identifiant, ni IP). Nouvelles variables `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED`. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement
- Un 429 renvoyé par Core n'est plus converti en 502. Avant : 502 `BAD_GATEWAY`. Maintenant : les routes `/settings` répondent 429 `TOO_MANY_REQUESTS` avec l'en-tête `Retry-After` (secondes). Les appelants (front, BFF) doivent gérer ce 429 et attendre avant de réessayer. Le contrat OpenAPI déclare ce 429 sur chaque route qui déclarait 502. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- Contrats et images de test : `@mairie360/core-api-openapi` passe de `0.0.0-dev-95531e2` à `2.1.0` puis `2.2.0`, `@mairie360/bffs-lib` de 2.2.0 à 2.5.0 ; les stacks ZAP et k6 utilisent désormais les images prod (database 3.3.0, liquibase-migrations 3.3.0, core-api 2.2.0). (MAIR-568 et MAIR-612, [#80](https://github.com/mairie360/BFF_Settings/pull/80), [#92](https://github.com/mairie360/BFF_Settings/pull/92))
- CI : workflows manuels `promote-staging.yml` et `promote-prod.yml` ; `cicd.yml` ne tourne sur push que sur `main` et utilise mairie360/CICD v4.4.3 ; passage de CICD v4.2.2 à v4.4.3 via Renovate, avec transmission des secrets du journal de release, et mise à jour de follow-redirects pour npm audit. (MAIR-494, MAIR-571, MAIR-612, [#89](https://github.com/mairie360/BFF_Settings/pull/89), [#83](https://github.com/mairie360/BFF_Settings/pull/83), [#92](https://github.com/mairie360/BFF_Settings/pull/92))

## Différence dev → staging (en dev, pas encore en staging)

_Rien._

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Télémétrie OpenTelemetry : le BFF exporte ses traces et ses métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` quand la variable est définie ; sans elle, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent (ni URL, ni query string, ni en-tête, ni identifiant, ni IP). Nouvelles variables `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED`. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement
- Un 429 renvoyé par Core n'est plus converti en 502. Avant : 502 `BAD_GATEWAY`. Maintenant : les routes `/settings` répondent 429 `TOO_MANY_REQUESTS` avec l'en-tête `Retry-After` (secondes). Les appelants (front, BFF) doivent gérer ce 429 et attendre avant de réessayer. Le contrat OpenAPI déclare ce 429 sur chaque route qui déclarait 502. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- Contrats et images de test : `@mairie360/core-api-openapi` passe de `0.0.0-dev-95531e2` à `2.1.0` puis `2.2.0`, `@mairie360/bffs-lib` de 2.2.0 à 2.5.0 ; les stacks ZAP et k6 utilisent désormais les images prod (database 3.3.0, liquibase-migrations 3.3.0, core-api 2.2.0). (MAIR-568 et MAIR-612, [#80](https://github.com/mairie360/BFF_Settings/pull/80), [#92](https://github.com/mairie360/BFF_Settings/pull/92))
- CI : workflows manuels `promote-staging.yml` et `promote-prod.yml` ; `cicd.yml` ne tourne sur push que sur `main` et utilise mairie360/CICD v4.4.3 ; passage de CICD v4.2.2 à v4.4.3 via Renovate, avec transmission des secrets du journal de release, et mise à jour de follow-redirects pour npm audit. (MAIR-494, MAIR-571, MAIR-612, [#89](https://github.com/mairie360/BFF_Settings/pull/89), [#83](https://github.com/mairie360/BFF_Settings/pull/83), [#92](https://github.com/mairie360/BFF_Settings/pull/92))

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-21 09:56 UTC | staging | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39580016456) |
| 2026-10-21 09:48 UTC | dev | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39579115592) |
| 2026-10-21 01:39 UTC | dev | — | `61164e3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39528053667) |
| 2026-10-20 18:20 UTC | dev | — | `b899612` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39473382143) |
| 2026-10-20 18:10 UTC | staging | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

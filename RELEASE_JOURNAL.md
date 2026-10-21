# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod": "cec91efc2017916ccc1998748a2b66bcbfa1df93", "prod_tag": "v2.0.0", "staging": "bdc4a888d2065a9663a3c09e69c05bcf3c373090", "updated": {"dev": "2026-10-21 09:48 UTC", "staging": "2026-10-20 18:10 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.0.0 | `cec91ef` | — |
| staging | — | `bdc4a88` | 2026-10-20 18:10 UTC |
| dev | — | `59441d2` | 2026-10-21 09:48 UTC |

## Ajouté sur main depuis la dernière release prod (v2.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry : le BFF exporte des traces et des métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` quand cette variable est définie ; sans elle, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement
- Une erreur 429 de Core sur les routes `/settings` qui déclarent les erreurs amont (dont `GET /settings/bootstrap`) n'est plus relayée en 502 `BAD_GATEWAY`. Le BFF répond désormais 429 `TOO_MANY_REQUESTS` et relaie l'en-tête `Retry-After` de Core. Un appelant qui traitait le 502 comme une panne doit aussi gérer le 429. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- `cicd.yml` : `mairie360/CICD` passe de v4.2.1 à v4.2.2, puis v4.3.0, v4.3.1 et v4.3.2 via Renovate, et les secrets du journal de release (`ANTHROPIC_API_KEY`, `RELEASE_APP_ID`, `RELEASE_APP_PK`) sont transmis au workflow. (MAIR-571, [#81](https://github.com/mairie360/BFF_Settings/pull/81), [#83](https://github.com/mairie360/BFF_Settings/pull/83), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#85](https://github.com/mairie360/BFF_Settings/pull/85), [#86](https://github.com/mairie360/BFF_Settings/pull/86))
- Contrats et dépendances : `@mairie360/bffs-lib` passe de 2.2.0 à 2.5.0 et `@mairie360/core-api-openapi` de `0.0.0-dev-95531e2` à 2.1.0 ; `follow-redirects` est en 1.16.1 dans le lockfile. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80), [#89](https://github.com/mairie360/BFF_Settings/pull/89))
- Workflows de promotion : `promote-staging.yml` et `promote-prod.yml` sont ajoutés (déclenchement manuel, sur `main` seulement) ; un push sur `main` ne lance plus que `release-dev`. (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))
- Stacks de test : les images `database`, `liquibase-migrations` et `core-api` de `docker-compose-security.yml` et `docker-compose-performance.yml` passent des builds dev à `dev-949384c` et `dev-0ac33bd`. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- Documentation et `CLAUDE.md` : notes sur la télémétrie et sur la procédure de promotion. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62), MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- `cicd.yml` : sur push, seul `main` déclenche le pipeline (le tag poussé par l'app de release ne le relance plus) ; le workflow passe sur `mairie360/CICD` v4.4.3. (MAIR-612, [#92](https://github.com/mairie360/BFF_Settings/pull/92))
- Contrats et stacks de test : `@mairie360/core-api-openapi` passe de 2.1.0 à 2.2.0 ; les images `database` et `liquibase-migrations` passent à 3.3.0 et `core-api` à 2.2.0 dans les stacks ZAP et k6. (MAIR-612, [#92](https://github.com/mairie360/BFF_Settings/pull/92))
- Promotion : `promote-staging.yml` et `promote-prod.yml` (manuels, sur `main`) sont ajoutés ; `cicd.yml` passe sur `mairie360/CICD` v4.4.0 ; `follow-redirects` est en 1.16.1 dans le lockfile. (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))
- Renovate : `mairie360/CICD` passe en v4.3.2. (MAIR-571, [#86](https://github.com/mairie360/BFF_Settings/pull/86))

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Télémétrie OpenTelemetry : le BFF exporte des traces et des métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` quand cette variable est définie ; sans elle, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement
- Une erreur 429 de Core sur les routes `/settings` qui déclarent les erreurs amont (dont `GET /settings/bootstrap`) n'est plus relayée en 502 `BAD_GATEWAY`. Le BFF répond désormais 429 `TOO_MANY_REQUESTS` et relaie l'en-tête `Retry-After` de Core. Un appelant qui traitait le 502 comme une panne doit aussi gérer le 429. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- `cicd.yml` : `mairie360/CICD` passe de v4.2.1 à v4.2.2, puis v4.3.0, v4.3.1 et v4.3.2 via Renovate, et les secrets du journal de release (`ANTHROPIC_API_KEY`, `RELEASE_APP_ID`, `RELEASE_APP_PK`) sont transmis au workflow. (MAIR-571, [#81](https://github.com/mairie360/BFF_Settings/pull/81), [#83](https://github.com/mairie360/BFF_Settings/pull/83), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#85](https://github.com/mairie360/BFF_Settings/pull/85))
- Contrats et dépendances : `@mairie360/bffs-lib` passe de 2.2.0 à 2.5.0 et `@mairie360/core-api-openapi` de `0.0.0-dev-95531e2` à 2.1.0. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- Stacks de test : les images `database`, `liquibase-migrations` et `core-api` passent de `dev-90c22bb` et `dev-95531e2` à `dev-949384c` et `dev-0ac33bd`. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-21 09:48 UTC | dev | — | `59441d2` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39579115592) |
| 2026-10-21 01:39 UTC | dev | — | `61164e3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39528053667) |
| 2026-10-20 18:20 UTC | dev | — | `b899612` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39473382143) |
| 2026-10-20 18:10 UTC | staging | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

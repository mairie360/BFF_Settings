# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "61164e37a7dbf8e0219ad178bb336930b1b91750", "prod": "cec91efc2017916ccc1998748a2b66bcbfa1df93", "prod_tag": "v2.0.0", "staging": "bdc4a888d2065a9663a3c09e69c05bcf3c373090", "updated": {"dev": "2026-10-21 01:39 UTC", "staging": "2026-10-20 18:10 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.0.0 | `cec91ef` | — |
| staging | — | `bdc4a88` | 2026-10-20 18:10 UTC |
| dev | — | `61164e3` | 2026-10-21 01:39 UTC |

## Ajouté sur main depuis la dernière release prod (v2.0.0)

#### Nouveautés

- Télémétrie OpenTelemetry : traces et métriques HTTP exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF, jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))
- Workflows manuels `promote-staging.yml` et `promote-prod.yml` : promotion d'un commit de `main` vers staging puis prod, avec `-f sha=<sha>` optionnel. (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))

#### Changements de comportement

- Un push sur `main` ne déclenche plus que la release dev (`cicd.yml` s'arrête à `release-dev`). Staging et prod ne reçoivent un commit que par promotion manuelle. (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))
- Une réponse 429 de Core n'est plus relayée en 502 mais en 429 avec l'en-tête `Retry-After`, sur les routes `/settings` (avec le corps `ErrorResponse`). Un appelant qui ne gère que le 502 doit désormais traiter le 429. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique

- `cicd.yml` suit les releases mairie360/CICD v4.2.1 à v4.3.2 via Renovate (PR [#85](https://github.com/mairie360/BFF_Settings/pull/85), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#86](https://github.com/mairie360/BFF_Settings/pull/86)), puis le tag v4.2.2 ([#81](https://github.com/mairie360/BFF_Settings/pull/81)). Les secrets du journal de release (`ANTHROPIC_API_KEY`, `RELEASE_APP_ID`, `RELEASE_APP_PK`) sont transmis au workflow réutilisable. (MAIR-571, [#83](https://github.com/mairie360/BFF_Settings/pull/83))
- Dépendances : `@mairie360/bffs-lib` passe de 2.2.0 à 2.5.0 et `@mairie360/core-api-openapi` de `0.0.0-dev-95531e2` à 2.1.0 ; contrats OpenAPI et images dev des stacks de test (database, liquibase-migrations, core-api) mis à jour. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- Documentation (`CLAUDE.md`, `docs/fr` et `docs/en`) mise à jour pour la télémétrie et la promotion.

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement

- Un push sur `main` ne déclenche plus que la release dev : `cicd.yml` s'arrête à `release-dev`. Un commit n'arrive en staging que via le workflow manuel `promote-staging.yml` (puis `promote-prod.yml` pour la prod). (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))

#### Corrections

- `npm audit` bloquait chaque run de `main` à cause de advisories sur `follow-redirects`. Avant : run en échec. Maintenant : `follow-redirects` 1.16.1 dans le lockfile, d'après la description de la PR (le lockfile n'apparaît pas dans le diff fourni). (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))

#### Technique

- `cicd.yml` passe de mairie360/CICD v4.3.2 à v4.4.0. Ajout de `promote-staging.yml` et `promote-prod.yml`, épinglés sur la même release, avec un verrou de concurrence par cible. Renovate regroupe les trois fichiers dans une seule PR (`renovate.json`). (MAIR-494, [#89](https://github.com/mairie360/BFF_Settings/pull/89))
- Mise à jour de la version CICD par Renovate (v4.3.2, [#86](https://github.com/mairie360/BFF_Settings/pull/86)) ; documentation de la promotion dans `CLAUDE.md` et `docs/`.

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés

- Télémétrie OpenTelemetry : traces et métriques HTTP exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` ; sans cette variable, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. Variables `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED` documentées. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement

- Une réponse 429 de Core n'est plus relayée en 502 mais en 429 avec l'en-tête `Retry-After`, sur les routes `/settings` (par exemple `GET /settings/bootstrap`). Un appelant qui ne traite que le 502 doit désormais gérer le 429. La réponse suit le corps `ErrorResponse` avec le code `TOO_MANY_REQUESTS`. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique

- Le workflow réutilisable transmet désormais les secrets du journal de release (`ANTHROPIC_API_KEY`, `RELEASE_APP_ID`, `RELEASE_APP_PK`) : `cicd.yml` les mappe comme `CODECOV_TOKEN` et `N8N_WEBHOOK_SECRET`. (MAIR-571, [#83](https://github.com/mairie360/BFF_Settings/pull/83))
- mairie360/CICD passe de v4.2.1 à v4.3.1 puis v4.3.0 via Renovate ([#85](https://github.com/mairie360/BFF_Settings/pull/85), [#84](https://github.com/mairie360/BFF_Settings/pull/84)), et v4.2.2 ([#81](https://github.com/mairie360/BFF_Settings/pull/81)). Dépendances : `@mairie360/bffs-lib` 2.5.0 et `@mairie360/core-api-openapi` 2.1.0 ([#80](https://github.com/mairie360/BFF_Settings/pull/80)).

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-21 01:39 UTC | dev | — | `61164e3` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39528053667) |
| 2026-10-20 18:20 UTC | dev | — | `b899612` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39473382143) |
| 2026-10-20 18:10 UTC | staging | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

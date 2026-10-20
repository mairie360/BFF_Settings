# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "bdc4a888d2065a9663a3c09e69c05bcf3c373090", "prod": "cec91efc2017916ccc1998748a2b66bcbfa1df93", "prod_tag": "v2.0.0", "staging": "bdc4a888d2065a9663a3c09e69c05bcf3c373090", "updated": {"dev": "2026-10-19 20:12 UTC", "staging": "2026-10-20 18:10 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.0.0 | `cec91ef` | — |
| staging | — | `bdc4a88` | 2026-10-20 18:10 UTC |
| dev | — | `bdc4a88` | 2026-10-19 20:12 UTC |

## Ajouté sur main depuis la dernière release prod (v2.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry : quand `OTEL_EXPORTER_OTLP_ENDPOINT` est défini, bff-settings exporte en OTLP ses traces (span serveur nommé d'après la route, appels à Core portant `traceparent`) et ses métriques HTTP. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. Sans cette variable, ou avec `OTEL_SDK_DISABLED=true`, rien n'est exporté. `OTEL_SERVICE_NAME` (par défaut `bff-settings`) et `OTEL_RESOURCE_ATTRIBUTES` sont pris en charge. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Corrections
- Limite de débit de Core : quand Core répond 429, les routes `/settings` (par exemple `GET /settings/bootstrap`) répondaient `502` avec le code `BAD_GATEWAY`. Elles répondent maintenant `429`, avec le code `TOO_MANY_REQUESTS` et l'en-tête `Retry-After` (en secondes) relayé depuis Core. Ce `429` est déclaré dans `contracts/openapi.json` pour toutes les routes qui déclarent un `502`, `/check_apis` mis à part. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- Dépendances : passage de `@mairie360/bffs-lib` à 2.5.0 et de `@mairie360/core-api-openapi` à 2.1.0, mise à jour des images Docker des stacks de performance et de sécurité, ajout de tests de contrat. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- CI : trois montées du workflow réutilisable `mairie360/CICD` (v4.2.2, v4.3.0, v4.3.1) et transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` à l'étape du journal des releases. (MAIR-571, [#81](https://github.com/mairie360/BFF_Settings/pull/81), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#85](https://github.com/mairie360/BFF_Settings/pull/85), [#83](https://github.com/mairie360/BFF_Settings/pull/83))

## Différence dev → staging (en dev, pas encore en staging)

_Rien._

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Télémétrie OpenTelemetry : quand `OTEL_EXPORTER_OTLP_ENDPOINT` est défini, bff-settings exporte en OTLP ses traces (span serveur nommé d'après la route, appels à Core portant `traceparent`) et ses métriques HTTP. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. Sans cette variable, ou avec `OTEL_SDK_DISABLED=true`, rien n'est exporté. `OTEL_SERVICE_NAME` (par défaut `bff-settings`) et `OTEL_RESOURCE_ATTRIBUTES` sont pris en charge. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Corrections
- Limite de débit de Core : quand Core répond 429, les routes `/settings` (par exemple `GET /settings/bootstrap`) répondaient `502` avec le code `BAD_GATEWAY`. Elles répondent maintenant `429`, avec le code `TOO_MANY_REQUESTS` et l'en-tête `Retry-After` (en secondes) relayé depuis Core. Ce `429` est déclaré dans `contracts/openapi.json` pour toutes les routes qui déclarent un `502`, `/check_apis` mis à part. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- Dépendances : passage de `@mairie360/bffs-lib` à 2.5.0 et de `@mairie360/core-api-openapi` à 2.1.0, mise à jour des images Docker des stacks de performance et de sécurité, ajout de tests de contrat. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- CI : trois montées du workflow réutilisable `mairie360/CICD` (v4.2.2, v4.3.0, v4.3.1) et transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` à l'étape du journal des releases. (MAIR-571, [#81](https://github.com/mairie360/BFF_Settings/pull/81), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#85](https://github.com/mairie360/BFF_Settings/pull/85), [#83](https://github.com/mairie360/BFF_Settings/pull/83))

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-20 18:10 UTC | staging | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "bdc4a888d2065a9663a3c09e69c05bcf3c373090", "prod": "cec91efc2017916ccc1998748a2b66bcbfa1df93", "prod_tag": "v2.0.0", "staging": "cec91efc2017916ccc1998748a2b66bcbfa1df93", "updated": {"dev": "2026-10-19 20:12 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.0.0 | `cec91ef` | — |
| staging | — | `cec91ef` | — |
| dev | — | `bdc4a88` | 2026-10-19 20:12 UTC |

## Ajouté sur main depuis la dernière release prod (v2.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry : le BFF exporte en OTLP ses traces (span serveur nommé d'après la route, spans des handlers, appels à Core avec `traceparent`) et ses métriques HTTP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, la télémétrie reste désactivée. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. Le nom du service vaut `bff-settings` par défaut et se change avec `OTEL_SERVICE_NAME`. `OTEL_RESOURCE_ATTRIBUTES` ajoute des attributs comme `service.version` ou `deployment.environment.name`, et `OTEL_SDK_DISABLED=true` coupe la télémétrie. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement
- Quand Core renvoie un 429 (limite de débit atteinte), les routes `/settings` (par ex. `GET /settings/bootstrap`) répondent maintenant `429` avec l'en-tête `Retry-After` relayé et le code d'erreur `TOO_MANY_REQUESTS`. Avant, elles répondaient `502` `BAD_GATEWAY`. Le contrat `contracts/openapi.json` déclare cette réponse 429 sur chaque route qui peut renvoyer 502. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- Dépendances : `@mairie360/bffs-lib` passe de 2.2.0 à 2.5.0 et `@mairie360/core-api-openapi` de `0.0.0-dev-95531e2` à 2.1.0. Les images Docker par défaut des stacks de performance et de sécurité sont mises à jour. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- CI : le workflow `mairie360/CICD` passe de v4.2.1 à v4.3.1 ([#81](https://github.com/mairie360/BFF_Settings/pull/81), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#85](https://github.com/mairie360/BFF_Settings/pull/85)). Les secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` sont transmis à l'étape de journal des releases. (MAIR-571, [#83](https://github.com/mairie360/BFF_Settings/pull/83))

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- Télémétrie OpenTelemetry : le BFF exporte en OTLP ses traces (span serveur nommé d'après la route, spans des handlers, appels à Core avec `traceparent`) et ses métriques HTTP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, la télémétrie reste désactivée. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. Le nom du service vaut `bff-settings` par défaut et se change avec `OTEL_SERVICE_NAME`. `OTEL_RESOURCE_ATTRIBUTES` ajoute des attributs comme `service.version` ou `deployment.environment.name`, et `OTEL_SDK_DISABLED=true` coupe la télémétrie. (MAIR-504, [#62](https://github.com/mairie360/BFF_Settings/pull/62))

#### Changements de comportement
- Quand Core renvoie un 429 (limite de débit atteinte), les routes `/settings` (par ex. `GET /settings/bootstrap`) répondent maintenant `429` avec l'en-tête `Retry-After` relayé et le code d'erreur `TOO_MANY_REQUESTS`. Avant, elles répondaient `502` `BAD_GATEWAY`. Le contrat `contracts/openapi.json` déclare cette réponse 429 sur chaque route qui peut renvoyer 502. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))

#### Technique
- Dépendances : `@mairie360/bffs-lib` passe de 2.2.0 à 2.5.0 et `@mairie360/core-api-openapi` de `0.0.0-dev-95531e2` à 2.1.0. Les images Docker par défaut des stacks de performance et de sécurité sont mises à jour. (MAIR-568, [#80](https://github.com/mairie360/BFF_Settings/pull/80))
- CI : le workflow `mairie360/CICD` passe de v4.2.1 à v4.3.1 ([#81](https://github.com/mairie360/BFF_Settings/pull/81), [#84](https://github.com/mairie360/BFF_Settings/pull/84), [#85](https://github.com/mairie360/BFF_Settings/pull/85)). Les secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` sont transmis à l'étape de journal des releases. (MAIR-571, [#83](https://github.com/mairie360/BFF_Settings/pull/83))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-19 20:12 UTC | dev | — | `bdc4a88` | [run](https://github.com/mairie360/BFF_Settings/actions/runs/39316611576) |
<!-- release-journal-history:end -->

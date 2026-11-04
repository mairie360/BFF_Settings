# Journal des releases — BFF_Settings

<!-- release-journal-state {"dev": "9e686f8b76f695b58c934895d5f1f02d0981f57d", "prod": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "prod_tag": "v2.1.0", "staging": "59441d29679d67d5461cbd12e0d9efe610bc3cd1", "updated": {"dev": "2026-11-04 16:54 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:56 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v2.1.0 | `59441d2` | 2026-10-21 10:09 UTC |
| staging | — | `59441d2` | 2026-10-21 09:56 UTC |
| dev | — | `9e686f8` | 2026-11-04 16:54 UTC |

## Ajouté sur main depuis la dernière release prod (v2.1.0)

#### Changements de comportement
- `PATCH /settings/profile` : Core limite désormais les vérifications du mot de passe actuel d'un changement d'e-mail (5 par utilisateur et par 15 minutes). Le 429 de Core est relayé avec son `Retry-After` et le code `TOO_MANY_REQUESTS`, alors que la route ne le déclarait pas auparavant. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106), [#111](https://github.com/mairie360/BFF_Settings/pull/111))
- Authentification des sessions : le BFF vérifie les jetons avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA sous le `kid` de Core, `iss` et `aud`). Les jetons HS256 sont refusés (401) dès que `JWT_SECRET` n'est plus défini, et le démarrage échoue sans clé ou avec une clé mal formée. Les déploiements doivent donc fournir `JWT_PUBLIC_KEY`. Le 503 des routes `/settings` nomme désormais la clé de session. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))

#### Technique
- Tests et garde-fous : collection newman étendue (MAIR-746), stack d'intégration `docker-compose-integration.yml` et `integration_test.sh` (MAIR-262), marqueur RGPD des journaux (MAIR-290), checklist RGPD des PR (MAIR-295), test de version CICD (MAIR-771). (#95, #56, #60, #102)
- CI et images : workflows sur mairie360/CICD v5.2.2 avec `ANTHROPIC_WORKSPACE_ID`, runtime Node.js 24.22.1 épinglé par digest, conteneur de développement lancé en utilisateur `node`, actions et images épinglées par SHA via Renovate, `zod` 4.6.7. (#96, #103, #102)

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- `PATCH /settings/profile` : Core limite désormais les vérifications du mot de passe actuel d'un changement d'e-mail (5 par utilisateur et par 15 minutes). Le 429 de Core est relayé avec son `Retry-After` et le code `TOO_MANY_REQUESTS`, alors que la route ne le déclarait pas auparavant. (MAIR-746, [#106](https://github.com/mairie360/BFF_Settings/pull/106), [#111](https://github.com/mairie360/BFF_Settings/pull/111))
- Authentification des sessions : le BFF vérifie les jetons avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA sous le `kid` de Core, `iss` et `aud`). Les jetons HS256 sont refusés (401) dès que `JWT_SECRET` n'est plus défini, et le démarrage échoue sans clé ou avec une clé mal formée. Les déploiements doivent donc fournir `JWT_PUBLIC_KEY`. Le 503 des routes `/settings` nomme désormais la clé de session. (MAIR-680, [#109](https://github.com/mairie360/BFF_Settings/pull/109))

#### Technique
- Tests et garde-fous : collection newman étendue (MAIR-746), stack d'intégration `docker-compose-integration.yml` et `integration_test.sh` (MAIR-262), marqueur RGPD des journaux (MAIR-290), checklist RGPD des PR (MAIR-295), test de version CICD (MAIR-771). (#95, #56, #60, #102)
- CI et images : workflows sur mairie360/CICD v5.2.2 avec `ANTHROPIC_WORKSPACE_ID`, runtime Node.js 24.22.1 épinglé par digest, conteneur de développement lancé en utilisateur `node`, actions et images épinglées par SHA via Renovate, `zod` 4.6.7. (#96, #103, #102)

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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

# BFF_Settings

Provide the personal profile and session list for the settings interface. The BFF exposes explicit Core fields and confirms a save by reading back the stored profile.

Fournir le profil personnel et la liste des sessions pour l’interface de paramètres. Le BFF expose les champs Core explicites et confirme une sauvegarde en relisant le profil enregistré.

## Documentation

| Language / Langue | Module | Technical / Technique |
| --- | --- | --- |
| English | [Module overview](docs/en/module.md) | [Technical documentation](docs/en/technical.md) |
| Français | [Présentation du module](docs/fr/module.md) | [Documentation technique](docs/fr/technical.md) |

The sections below are a quick reference in English; the French version of the setup, the routes and the checks is in [docs/fr/technical.md](docs/fr/technical.md).

Les sections ci-dessous sont un aide-mémoire en anglais ; leur version française (installation, routes, vérifications) est dans [docs/fr/technical.md](docs/fr/technical.md).

## Quick start

Node.js 24 and read access to the GitHub Packages of `mairie360` (`NODE_AUTH_TOKEN`, `read:packages`) are needed for the private `@mairie360/*` packages.

```bash
export NODE_AUTH_TOKEN=<token with read:packages>
npm ci
cp .env.example .env   # then fill it, see below
npm run start
```

The BFF listens on port `4008`: `GET /health` checks the process, `GET /check_apis` its upstreams, `/docs` serves Swagger UI and `/openapi.json` the contract.

Configuration (local example, every upstream is required: there is no `localhost` default):

```dotenv
PORT=4008
CORE_API_URL=http://localhost:3000
# Core's Ed25519 public key (MAIR-680), required: paste the public key of the Core you run against.
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n<base64 of Core's public key>\n-----END PUBLIC KEY-----"
```

## Routes

Generated contract: [`contracts/openapi.json`](contracts/openapi.json) (7 operations), published on every release as `@mairie360/bff-settings-openapi` for the front.

| Method | Path | Summary |
| --- | --- | --- |
| `GET` | `/health` | Checks that the BFF is up |
| `GET` | `/check_apis` | Checks that the upstream APIs are reachable |
| `GET` | `/settings/bootstrap` | Load the settings page of the signed-in user |
| `PATCH` | `/settings/profile` | Update the profile of the signed-in user |
| `PATCH` | `/settings/appearance` | Save the appearance settings of the signed-in user |
| `PATCH` | `/settings/general` | Save the general settings of the signed-in user |
| `PATCH` | `/settings/notifications` | Save the notifications settings of the signed-in user |

## Upstream contracts

The BFF calls its upstreams through these published packages (never through a local checkout); bumping one of them is how an upstream change reaches this BFF:

- `@mairie360/core-api-openapi`

## Commands

```bash
npm run lint                 # eslint
npm test                     # jest: unit, route and upstream-mock tests
npm run contracts:generate   # regenerate contracts/ after a route, schema or status change
npm run contracts:check      # CI gate: fails when contracts/ is stale
```

Docker stacks, one at a time (they need `NODE_AUTH_TOKEN` and pull access to `ghcr.io/mairie360`):

- `./integration_test.sh`: newman collection against the stack of `docker-compose-integration.yml`
- `./security_test.sh`: OWASP ZAP scan of `/openapi.json` (`docker-compose-security.yml`)
- `./performance_test.sh`: k6 load test (`docker-compose-performance.yml`)
- `./gdpr_marker_test.sh`: GDPR marker check (`docker-compose-gdpr-marker.yml`)
- `./gdpr_simulation_test.sh`: GDPR erasure simulation (`docker-compose-gdpr-simulation.yml`)

CI is the reusable `mairie360/CICD` workflow called by `.github/workflows/cicd.yml`.

## Contracts and background / Contrats et compléments

- [CONTRACT.md](CONTRACT.md)
- [contracts/openapi.json](contracts/openapi.json)

# BFF_Settings — Technical documentation

[Module overview](module.md) · [Français](../fr/technical.md) · [README](../../README.md)

## Architecture and request handling

Express 5.1.0 server written in TypeScript. Zod schemas and their OpenAPI registry describe exchanged objects; routers adapt upstream services to interface needs.

Bootstrap validates the required profile and loads sessions separately. Profile mutation rejects unknown fields and empty bodies, sends a PATCH to Core, then reads the profile again. Notification preferences target `/notification-settings/`; appearance and general share `/preferences/`.

## Data and persistence

The profile comes from Core `/api/v1/user/me/`; sessions come from `/api/v1/sessions/`. Fields are `first_name`, `last_name`, `email` and `phone`. The session schema retains displayable information and removes internal fields. The BFF stores no preferences locally.

The web service’s notifications, appearance, general and system panels currently report unavailability. Security displays sessions without managing other settings. Preference adapters do not guarantee that the corresponding Core routes are deployed.

## Installation and local startup

Use Node.js 22 to reproduce the contract job and npm with the committed lockfile. Other job and Docker versions are detailed below.

Current direct dependencies include no private `@mairie360/*` client. `.npmrc` still retains the organization’s registry configuration.

```bash
npm ci
```

Create `.env` in the repository root. Local HTTP configuration example to adapt to the running services:

```dotenv
PORT=4008
CORE_API_URL=http://localhost:3000
```

```bash
npm run start
```

`PORT` is optional; the `src/index.ts` fallback is `4008`.

Check the process, then open the interactive documentation:

```bash
curl --fail --silent --show-error http://localhost:4008/health
```

Swagger UI: `http://localhost:4008/docs`. JSON specification: `/openapi.json`, with `/swagger.json` as an alias. `/health` checks the process; `/check_apis` is a separate dependency diagnostic.

## Configuration

Values below are local examples or explicitly described behavior, not production credentials.

| Variable or precedence | Example / stated fallback | Purpose |
| --- | --- | --- |
| `PORT` | 4008 | Port used by this local example. |
| `CORE_API_URL` | http://localhost:3000 | Core base address; must be configured without a route suffix. |
| `CORE_API_PORT` | — | Optional port when absent from the URL. |

## Routes and data contract

Inventory extracted from `contracts/openapi.json`. Replace brace parameters with real identifiers. Detailed types, required fields, responses and any examples are defined in that contract; table statuses are the declared statuses, not an exhaustive list of transport or validation errors.

| Method | Path | Declared body | Declared statuses |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| GET | `/settings/bootstrap` | — | 200, 401, 502 |
| PATCH | `/settings/profile` | application/json | 200, 400 |
| PATCH | `/settings/notifications` | application/json | 200, 404 |
| PATCH | `/settings/appearance` | application/json | 200, 404 |
| PATCH | `/settings/general` | application/json | 200, 404 |

## Session, permissions and errors

All `/settings` routes require a Bearer token. Profile errors block bootstrap; session errors set `sources.sessions` to `unavailable`. Core calls have a 10-second timeout and business responses use `no-store`.

## Synchronization and verification

```bash
npm run contracts:generate
npm run contracts:check
npm test -- --runInBand
npm run lint
npm run build
```

`contracts:generate` exports the runtime registry to `contracts/openapi.json` and regenerates `contracts/bff.d.ts`. `contracts:check` fails when the contract or types are stale. Then run `npm run contracts:sync` in each associated web service and deliver contract changes together.

The type generator is pinned to `openapi-typescript@7.10.1` in `scripts/contracts.mjs` and runs through npm. For documentation-only changes, check links, accuracy in both languages and `git diff --check`; do not regenerate contracts without changing their source.

## CI/CD and Docker execution

The `contracts.yml` job uses Node.js 24, `actions/checkout@v7` and `actions/setup-node@v7`. It runs on pushes, pull requests and manual dispatch; it installs with `npm ci`, checks contracts and runs the associated tests.

The `cicd.yml` file calls the shared `mairie360/CICD` `BFFs-cicd.yml@v2.3.0` workflow (`node_version: "22"`, `openapi_spec_path: contracts/openapi.json`). Releases are handled by semantic-release (`.releaserc.json`).

The Dockerfile uses `node:24-alpine` for build and runtime; the image command is `["node", "dist/index.js"]`. GitHub Packages credentials are only mounted as BuildKit secrets (`npmrc`, `node_auth_token`) during `npm ci`.

Before running Docker, check service variables, build secrets and networks in the repository files. Green CI validates its jobs; it does not prove business-service availability in a remote environment.

## Troubleshooting

If the profile loads but sessions do not, check `sources.sessions` and the Core `/api/v1/sessions/` response. PATCH 400 can result from an unknown field or an empty body. An unavailable panel should not be interpreted as a failed save.

## Repository reference

- [src/app.ts](../../src/app.ts)
- [src/routes/settings.ts](../../src/routes/settings.ts)
- [src/clients/upstream.ts](../../src/clients/upstream.ts)
- [contracts/openapi.json](../../contracts/openapi.json)
- [contracts/bff.d.ts](../../contracts/bff.d.ts)
- [scripts/contracts.mjs](../../scripts/contracts.mjs)
- [package.json](../../package.json)
- [.github/workflows/contracts.yml](../../.github/workflows/contracts.yml)
- [.github/workflows/cicd.yml](../../.github/workflows/cicd.yml)
- [Dockerfile](../../Dockerfile)
- [docker-compose.yml](../../docker-compose.yml)

Historical supplements: [CONTRACT.md](../../CONTRACT.md). Proposed requirements must remain distinct from implemented behavior.

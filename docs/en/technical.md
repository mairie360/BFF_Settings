# BFF_Settings — Technical documentation

[Module overview](module.md) · [Français](../fr/technical.md) · [README](../../README.md)

## Architecture and request handling

Express 5.1.0 server written in TypeScript. Zod schemas and their OpenAPI registry describe exchanged objects; routers adapt upstream services to interface needs.

Bootstrap validates the required profile, then loads sessions, preferences (`appearance`, `general`) and notification settings in parallel; each optional read that fails is `null` (sessions: empty) and marked `unavailable` in `sources`. Profile mutation rejects unknown fields and empty bodies, sends a PATCH to Core, then reads the profile again. Preference sections relay Core API 2.0: `PATCH /settings/appearance` (`theme` `light`/`dark`/`system`, `font_family`, `font_size`, `density`) and `PATCH /settings/general` (`language`, `timezone`, `date_format`, `home_page`, `auto_open_notifications`) share Core `/api/v1/user/me/preferences/`; `PATCH /settings/notifications` (`email`, `push`, `desktop`, `messages`, `projects`, `calendar`, booleans) targets `/api/v1/user/me/notifications/`. Each section only accepts its own fields (an unknown field or an empty body is a 400), follows the Core rules (texts 1 to 16/32/64/128 characters, not blank, without control characters; `font_size` 1 to 32767), accepts `null` to reset a field to the application default, and answers its fields as stored by Core (`null` = default).

## Data and persistence

The profile comes from Core `/api/v1/user/me/`; sessions come from `/api/v1/sessions/`. Fields are `first_name`, `last_name`, `email` and `phone`. The session schema retains displayable information and removes internal fields. The BFF stores no preferences locally.

The system panel of the web service reports unavailability. Security displays sessions without managing other settings.

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

`PORT` is optional; the `src/index.ts` fallback is `4008`. `CORE_API_URL` is required: the process refuses to start without a valid one (`Missing or invalid upstream configuration: CORE_API_URL`), and there is no `localhost` default. `.env` is loaded by `import 'dotenv/config'` on the first line of `src/index.ts`.

Check the process, then open the interactive documentation:

```bash
curl --fail --silent --show-error http://localhost:4008/health
```

Swagger UI: `http://localhost:4008/docs`. JSON specification: `/openapi.json`, with `/swagger.json` as an alias. `/health` checks the process; `/check_apis` is a separate dependency diagnostic answering `{ "status": "OK" | "Error", "core_api": "Connected" | "Unreachable" }` (`CheckApisResponse`) with 200 or 502.

## Configuration

Values below are local examples or explicitly described behavior, not production credentials.

| Variable or precedence | Example / stated fallback | Purpose |
| --- | --- | --- |
| `PORT` | 4008 | Port used by this local example. |
| `CORE_API_URL` | http://localhost:3000 | Required. Core base address (scheme optional, `http` by default), without a route suffix; read on every call, 503 when missing or invalid. |
| `CORE_API_PORT` | — | Optional port when absent from the URL. |
| `TRUST_PROXY` | unset (no proxy trusted) | Express `trust proxy` (`true`, a hop count or addresses/subnets), so `req.ip` is the real client behind the ingress. |

## Routes and data contract

Inventory extracted from `contracts/openapi.json`. Replace brace parameters with real identifiers. Detailed types, required fields, responses and any examples are defined in that contract; table statuses are the declared statuses, not an exhaustive list of transport or validation errors.

| Method | Path | Declared body | Declared statuses |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| GET | `/settings/bootstrap` | — | 200, 401, 502, 503 |
| PATCH | `/settings/profile` | application/json | 200, 400, 401, 403, 409, 502, 503 |
| PATCH | `/settings/notifications` | application/json | 200, 400, 401, 502, 503 |
| PATCH | `/settings/appearance` | application/json | 200, 400, 401, 502, 503 |
| PATCH | `/settings/general` | application/json | 200, 400, 401, 502, 503 |

## Session, permissions and errors

All `/settings` routes require `Authorization: Bearer <token>` (the only accepted credential: cookies and `x-session-token` are ignored) and answer 401 before any Core call without it; the token is forwarded to Core normalised to `Bearer <token>`. Profile errors block bootstrap; session errors set `sources.sessions` to `unavailable`. Core calls have a 10-second timeout; the Core reads (GET) are retried once on no answer, 502, 503 or 504, the profile PATCH never is. Business responses use `no-store`, and every response but `/docs` carries strict API headers (`Content-Security-Policy: default-src 'none'`). Every error is answered in the envelope shared by all the BFFs (`@mairie360/bffs-lib`), declared as `ErrorResponse` in the contract: `{ "error": { "code": "BAD_GATEWAY", "message": "...", "details": [] } }`. `code` follows the HTTP status; A PATCH 400 answers `Validation failed` and `details` lists the invalid fields (`{ "path": "body.email", "message": "..." }`; an empty profile patch has one `body` detail); `details` is empty otherwise. Only the Core 4xx a route declares are preserved (401 on bootstrap, 400, 401, 403 and 409 on the profile PATCH); any other Core status, a Core outage (network, timeout) or an invalid Core answer becomes 502 without relaying the upstream body, and an unconfigured Core becomes 503. Unknown routes answer 404, an unparsable JSON body 400 and an unexpected error a generic 500. A Core success without body (Core answers an empty 200 to `PATCH /api/v1/user/me/`) is accepted, then the profile is re-read.

## Synchronization and verification

```bash
npm run contracts:generate
npm run contracts:check
npm test -- --runInBand
npm run lint
npm run build
```

The tests in `tests/settings.upstream-mocks.test.ts` run the whole application with the real `fetch` client against a local HTTP server simulating Core API. Its contract is rebuilt from the installed `@mairie360/core-api-openapi` package (orval types, version pinned in `package.json`): every outgoing request (path, parameters, JSON body) and every mocked success response is validated against that contract, and every BFF response against `contracts/openapi.json`. Bumping the package version is enough to test the new contract; error statuses are not typed by orval and are simulated explicitly. `tests/upstream-contracts.test.ts` pins the version, the consumed operations and the preference operations.

`contracts:generate` exports the runtime registry to `contracts/openapi.json` and regenerates `contracts/bff.d.ts`. `contracts:check` fails when the contract or types are stale. Then run `npm run contracts:sync` in each associated web service and deliver contract changes together.

The type generator is pinned to `openapi-typescript@7.10.1` in `scripts/contracts.mjs` and runs through npm. For documentation-only changes, check links, accuracy in both languages and `git diff --check`; do not regenerate contracts without changing their source.

## CI/CD and Docker execution

The `contracts.yml` job uses Node.js 24, `actions/checkout@v7` and `actions/setup-node@v7`. It runs on pushes, pull requests and manual dispatch; it installs with `npm ci`, checks contracts and runs the associated tests.

The `cicd.yml` file calls the shared `mairie360/CICD` `BFFs-cicd.yml@v3.2.0` workflow (`cicd_version: v3.2.0`, `node_version: "24"`, `openapi_spec_path: contracts/openapi.json`). Releases are handled by semantic-release (`.releaserc.json`).

The Dockerfiles use `node:24-alpine` pinned by digest for every stage (same Node.js 24 as both workflows); the image command is `["node", "dist/index.js"]`. GitHub Packages credentials are only mounted as BuildKit secrets (`npmrc`, `node_auth_token`) during `npm ci`.

`security_test.sh` and `performance_test.sh` test the image named by `IMAGE_REF`: in CI, the image `release-dev` has just published, the same artifact that is then promoted to staging and prod. When `IMAGE_REF` is empty (local use), they first build `bff-settings:local` from `development.Dockerfile`, which needs `NODE_AUTH_TOKEN` and `./.npmrc`.

`security_test.sh` runs the OWASP ZAP stack of `docker-compose-security.yml`: ZAP replays every operation of `/openapi.json` with a static admin JWT (`sub=1`, HS256, `JWT_SECRET=b"secret"`) and fills bodies from the contract examples; `init-test.sql` seeds users 1 (Admin) and 2 (User). `PATCH /settings/profile` follows the database columns before calling Core: names of 1 to 64 characters without `<` or `>`, an e-mail of at most 320 characters, and a phone of 10 to 15 digits (spaces, dots and dashes are dropped; Core API 2.0 refuses a `+` prefix and an empty phone, and ignores `null`, so a phone cannot be cleared). The settings form always sends the whole profile, so the BFF first reads the current profile when `email` is sent: an address equal to the current one (trimmed, case-insensitive) is dropped from the patch, and when nothing else is left the current profile is answered without any Core PATCH. Only a real change of `email` requires `current_password` (Core API 2.0, MAIR-390): the BFF answers 400 without it and relays the Core 403 (wrong password) and 409 (e-mail already used).

The ZAP stack carries the OpenAPI coverage hook of `mairie360/CICD` (`tests/zap/zap_hooks.py`), checked out as `cicd-repo/` by the CI jobs and cloned there by `security_test.sh` / `performance_test.sh` at the pinned `cicd_version` (`CICD_VERSION` overrides it). After the scan, it fails when an operation of the contract was never reached, or when an operation that requires `bearerAuth` only got 401/403. Public operations (`/health`, `/check_apis`) declare `security: []` in their `registerPath`; a new route is authenticated by default. The k6 stack imports the shared `tests/k6/coverage.js`: `load-test.js` holds one handler per operation of `contracts/openapi.json`, k6 aborts at init when one is missing and fails its `operations_uncovered` threshold when a handler does not send its request. **Adding a route means adding its handler in `load-test.js`.** Two scenarios run: `crud` (2 VUs) calls every handler once per iteration, writes included (the profile patch restores the seeded values), and carries the gate; `reads` (ramp to 20 VUs) replays only the GET handlers. Every operation has a `p(95)` threshold set by its family: 50 ms for `/health`, 150 ms for `/check_apis`, 400 ms for reads, 800 ms for writes; `http_req_failed` must stay below 1 %. The preference PATCHes (`notifications`, `appearance`, `general`) accept their documented 404 until Core API publishes these operations.

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

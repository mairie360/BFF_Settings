# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`bff-settings` is a Backend-for-Frontend for the **Settings_Web_Service** in the mairie360 project.
It is a thin Express 5 / TypeScript adapter: it authenticates the caller's Bearer token, calls the
upstream **Core** API, reshapes responses for the settings UI, and publishes an OpenAPI contract that
the web service consumes. It holds no database and no local state.

## Commands

```bash
npm ci                      # install (Node.js 24 in both workflows and the Docker images)
npm run start               # ts-node src/index.ts, listens on PORT (default 4008)
npm run build               # tsc -> dist/
npm run lint                # eslint (flat config: eslint.config.cjs)
npm run lint:fix
npm test                    # jest
npm test -- tests/health.test.ts        # single file
npm test -- -t "saving a profile"       # single test by name
npm test -- --runInBand                 # how CI runs it

npm run contracts:generate  # regenerate contracts/openapi.json + contracts/bff.d.ts from the code
npm run contracts:check     # fail if either committed artifact is stale (runs in CI)

./performance_test.sh       # isolated k6 load test  (docker-compose-performance.yml)
./security_test.sh          # isolated OWASP ZAP DAST (docker-compose-security.yml)
```

Run `contracts:generate` and commit the result whenever you change a route path, method, or Zod
schema — CI (`contracts:check`) and a jest test both fail otherwise. See "Contract pipeline" below.

## Architecture

**Request flow:** `src/index.ts` -> `src/app.ts` mounts three routers (`/health`, `/check_apis`,
`/settings`). Every `/settings` request goes through the lib's `noStore` (`Cache-Control: no-store`)
and `requireSession` (bffs-lib >= 1.2.0, MAIR-474: 401 before any Core call unless `Authorization: Bearer <token>`
carries a token verified with `JWT_SECRET`, HS256 with `exp` and a positive `sub`; cookies and
`x-session-token` are ignored; 503 without `JWT_SECRET`, and `start()` refuses to listen without it). Core
still checks revocation. `tests/token-refusals.test.ts` walks `contracts/openapi.json`: every operation that
inherits `bearerAuth` answers 401 to a missing or forged token (other scheme, garbage, other secret, expired,
`alg: none`, swapped payload, RS256, non-numeric `sub`) without calling Core and gets past the check with a
genuine one. Tests sign their tokens with the secret `tests/support/env.ts` sets (`sessionToken`, `bearer()`). `trust proxy` comes from `TRUST_PROXY` (lib `parseTrustProxy`).

**Errors (`@mairie360/bffs-lib`).** Every error body is `{ error: { code, message, details } }`, the
`ErrorResponse` schema (`src/openapi-registry.ts`, the lib's `ErrorResponseSchema.clone()`). Routes throw
`HttpError`; `app.ts` ends with the lib's `notFoundHandler` and `errorHandler()`, which keep the status
(400 for an unparsable body) and turn anything unexpected into a generic 500.

**`src/clients/`:**
- `coreClient.ts`: only the generated Core client `coreApi` (axios instance with `Accept: application/json`,
  no `baseURL`). Every call passes the lib's `asCaller('CORE_API', req)` (401 without a Bearer token, then
  `baseUrl('CORE_API')`: `CORE_API_URL` + optional `CORE_API_PORT`, 503 when missing, no `localhost`
  default, 10 s timeout) or `withoutSession('CORE_API', 5_000)` for the probe.
- Failures go through the lib's `callUpstream('CORE_API', call, { declared, retry })`: only the Core 4xx listed
  in `declared` (the statuses the route's contract declares) are kept; any other status, no answer
  (`The CORE_API service is unavailable.`) or an invalid answer parsed inside the call (`The CORE_API answer
  is invalid.`) becomes a 502. The Core body is never relayed. `retry: true` (one retry on no answer /
  502 / 503 / 504) is set on the Core GETs only, never on the PATCH.
- Security headers: the lib's `securityHeaders` + `apiOnlyHeaders()` (`default-src 'none'` everywhere but
  `/docs`).

**Routes:**
- `routes/health.ts` — liveness only (`{ status: 'ok' }`), no upstream call.
- `routes/check_apis.ts` — dependency diagnostic: the lib's `checkApis({ core_api: ... })` probes Core `/health`
  without session (same `CORE_API_URL` as the real calls), returns 200 or 502 with the `CheckApisResponse`
  schema (`checkApisResponseSchema(['core_api'])`). Add a probe for any new upstream.
- `routes/settings.ts` — the real work:
  - `GET /settings/bootstrap` aggregates Core `/api/v1/user/me/` (required; failure = error), then in
    parallel `/api/v1/sessions/`, `/api/v1/user/me/preferences/` and `/api/v1/user/me/notifications/`
    (optional; a failure sets `sources.{sessions,preferences,notifications}: 'unavailable'` and the section
    to `null`). Session objects are re-parsed through a Zod schema, which strips internal fields like `token_hash`.
  - The profile carries `phone` (E.164, as Core answers it) and `phone_country`. A patch forwards the phone as
    typed (Core MAIR-480 parses it against `phone_country`, or its `+` prefix, and clears it on `null`/`""`).
  - `PATCH /settings/profile` validates with the lib's `parseRequest(ProfilePatchSchema, req.body, 'body')`
    (`.strict()`: unknown fields are a 400 `Validation failed` with `body.<field>` details) and refuses an
    empty patch with the same 400 (never a silent success), PATCHes Core, then **re-reads** and returns the
    persisted profile. When `email` is sent it first reads the profile: an unchanged address (trimmed,
    case-insensitive) is dropped, since the front always sends it; only a real change needs `current_password`
    (Core API 2.0, MAIR-390), and a patch left empty answers the current profile without PATCH.
  - `PATCH /settings/{appearance,general}` relay Core `PATCH /api/v1/user/me/preferences/` and
    `PATCH /settings/notifications` relays `PATCH /api/v1/user/me/notifications/`: strict per-section schemas
    mirroring the Core rules, stricter for `density`, `date_format` (the front's values) and `language` (language
    code), which keeps ZAP's Path Traversal check from flagging free text (unknown field or empty body: 400;
    `null` resets to the default), answer the
    section's fields from Core's answer (missing = `null`).
  - Every `/settings` route documents 401/502/503 through `upstreamErrors`; the contract tests fail on
    any status the route can return but does not declare.

## Contract pipeline

The OpenAPI document is generated from the code, not hand-written:
1. Each route module calls `registry.registerPath(...)` and `registry.register(name, zodSchema)` on the
   shared registry in `src/openapi-registry.ts`.
2. `src/openapi.ts` imports every route module (for side effects) and builds `openApiDocument`.
3. `app.ts` serves it live at `/openapi.json`, `/swagger.json`, and Swagger UI at `/docs`.
4. `scripts/export-swagger.ts` writes it to `contracts/openapi.json` (and `openapi.json` at repo root).
5. `scripts/contracts.mjs` runs `openapi-typescript@7.10.1` (pinned, via `npm exec`) to produce
   `contracts/bff.d.ts`.
6. `tests/contracts.test.ts` asserts the live document equals the committed `contracts/openapi.json`.

## Tests with a contract-driven Core API mock

`tests/settings.upstream-mocks.test.ts` imports the **whole app** with the **real** `fetch` client and serves
Core API from a local HTTP server (`tests/support/contract-mock-server.ts`). The Core contract is rebuilt at
test time from the **installed** `@mairie360/core-api-openapi` devDependency (`tests/support/orval-contract.ts`
parses the orval `endpoints/*.ts` + `model/*.ts` with the TypeScript compiler API), so bumping the package is
enough to test a new contract. The mock rejects paths, methods, params and bodies absent from the contract and
validates mocked success responses; orval does not type errors, so mocked error replies need
`outOfContract: true`. Every BFF response is checked against `contracts/openapi.json` (status documented +
schema), so an undocumented status fails the test. `tests/upstream-contracts.test.ts` pins the package
version, the consumed operations, BFF↔Core schema compatibility and the known gaps.

- `CORE_API_URL` / `CORE_API_PORT` are read per request, so tests set them in `beforeEach` (no module reload).
- A known gap can be accepted with a justified `allowDeviation`; none is needed with Core API 2.0.
- `beforeEach` mocks Core preferences and notification settings with valid answers, because the bootstrap
  reads them on every call; tests about them override these replies.
- Fixtures live in `tests/support/core-fixtures.ts` and are validated against the contract.
- `openapi-contract.ts`, `contract-mock-server.ts` and `orval-contract.ts` are shared verbatim with `BFF_user`,
  `BFF_Calendar`, `BFF_Dashboard`, `BFF_Elearning` and `BFF_Message`; keep the copies identical.

## Isolated test stacks (perf / security)

Mirrors the Calendar BFF / APIs pattern: two standalone Compose stacks driven by shell scripts that
return the tool's exit code (`docker-compose-{performance,security}.yml`, `performance_test.sh`,
`security_test.sh`). Both bring up `database` + `liquibase-migrations` + `seeder` (`init-test.sql`,
user id 2) + `redis` + `core-api` (probed on `/ready` by a curl sidecar — the published image is
distroless) + the BFF image named by `IMAGE_REF` (in CI, the image published by `release-dev`; locally,
`bff-settings:local`, built by the scripts from `development.Dockerfile` when `IMAGE_REF` is empty). No
`bff-user`: BFF_Settings never calls it.

Both scripts source `stack_secrets.sh` (MAIR-474): a random `JWT_SECRET` per run, shared by core-api, the
BFF and k6, and `ADMIN_JWT` (`sub=1`, 4 h) signed with it for the ZAP replacer; the compose files refuse to
start without them. They drop the volumes before and after a run, exit 1 when a dependency does not start
(`docker compose wait` would report 0 for a test container that never ran), and `performance_test.sh` pins
every service to the first `min(PERF_CPUS, nproc)` CPUs (4 by default, like the CI runner).

- **Performance** — k6 (`load-test.js`) has one handler per operation of the contract and mints HS256
  JWTs with the run's secret. The perf seeder also runs `init-perf.sql`, BFF_user's Core seed copied as is
  (10 000 agents `500001`-`510000` with five sessions each; keep it in step with BFF_user and the id ranges
  of `load-test.js`). Scenarios: `crud` runs every handler through `coverage.run()` and carries the coverage
  gate, each VU writing as its own agent (the last ten) so the handlers check what Core stored (the phone in
  E.164, then cleared; each preference value); `reads` replays the GET handlers as random agents and checks
  their own profile, session and sources; `bootstrap_rush` sends `GET /settings/bootstrap` at a fixed rate.
  Thresholds: one `p(95)` per operation by family (`/health` 50 ms, `/check_apis` 150 ms, reads 400 ms,
  writes 800 ms), strict `checks == 100%`, `http_req_failed == 0`, `dropped_iterations == 0`.
  `K6_PROFILE`: `ci` (default, 30 readers, rush at 30/s, what the 4 vCPU runner holds) or `stress` (100
  readers, 100/s, by hand).
- **Security** — OWASP ZAP imports `/openapi.json`, replays every operation with `ADMIN_JWT` via a header
  replacer, and fails on any alert not downgraded in `.zap/rules.tsv`. Rule `100000` (server errors) is no
  longer ignored. Rule `6` (Path Traversal) is scoped out of `PATCH /settings/general` only: ZAP sends
  `home_page` = `/general` (the last path segment), a valid in-app path Core (MAIR-479) accepts, and a random
  mixed-case value Core refuses, and reads the difference as a traversal; `home_page` is never read as a file.

## ZAP OpenAPI coverage gate

`security_test.sh` / `performance_test.sh` clone `mairie360/CICD` into `cicd-repo/` (gitignored) at
the pinned `cicd_version` (`CICD_VERSION=<branch>` overrides it). ZAP runs its `zap_hooks.py` with
`--hook`: every operation of the served spec must be reached, and non-public ones with a
non-401/403 answer. The spec requires `bearerAuth` at the top level (`openapi.ts`); `/health` and
`/check_apis` set `security: []`. k6 imports `coverage.js`: a new route without a handler in
`load-test.js` makes k6 abort at init, so **adding a route means adding its handler**.

## Gotchas

- **ESLint** uses only the flat `eslint.config.cjs` (the legacy `.eslintrc.js` was removed, like in the
  sibling BFFs).
- **Node version.** `contracts.yml`, `cicd.yml` (`node_version: "24"`) and every Dockerfile stage use
  Node 24; the images pin `node:24-alpine` by digest (Renovate bumps it).
- **Fail fast.** `src/index.ts` loads `dotenv/config` first, then `start()` runs the lib's
  `assertConfigured(UPSTREAMS)` (`['CORE_API']`) before `listen`, only under `require.main === module`.
  Add any new upstream to `UPSTREAMS`.
- Dockerfiles read GitHub Packages credentials through BuildKit secrets (`npmrc`, `node_auth_token`)
  only during `npm ci`; the test compose files declare both secrets.
- `contracts:sync` is referenced in the docs/CONTRACT.md but `scripts/contracts.mjs` has `source = null`,
  so the sync branch is an inert stub — syncing to web-service repos is not wired up here.
- `.npmrc` points `@mairie360:*` at GitHub Packages and needs `NODE_AUTH_TOKEN`; the only `@mairie360/*`
  package is the `core-api-openapi` devDependency used by the tests (no runtime client).
- `cicd.yml` calls the shared `mairie360/CICD` `BFFs-cicd.yml@v2.3.0` (with `openapi_spec_path` and
  explicit `CODECOV_TOKEN` / `N8N_WEBHOOK_SECRET` secrets); Renovate keeps `cicd_version` aligned with
  the tag, and `.releaserc.json` drives semantic-release.
- The test stacks pin the dev releases `database` / `liquibase-migrations` `dev-99f6127` and `core-api`
  `dev-abaa6c2` (the contract `@mairie360/core-api-openapi` `0.0.0-dev-abaa6c2`). Core API ≥ 1.1.1 panics on `/user/me` for users without a role, so `init-test.sql` gives user 2 the
  `User` role.
- `tests/contracts.test.ts` mocks `globalThis.fetch` and requires `contracts/openapi.json` to exist.

## Docs

Human-facing guides live in `docs/{en,fr}/{module,technical}.md`; `CONTRACT.md` is the BFF↔web-service
contract summary. Keep both language versions in sync when editing docs.

## Pull request reviewers

Every PR requests a review from the whole team, minus its author: `CarolinHugo`, `LAURETbenjamin`, `MathTek` and `Quentintnrl` (`gh pr create … --reviewer CarolinHugo,LAURETbenjamin,MathTek`). `.github/CODEOWNERS` makes GitHub request them automatically as well.

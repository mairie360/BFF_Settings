# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`bff-settings` is a Backend-for-Frontend for the **Settings_Web_Service** in the mairie360 project.
It is a thin Express 5 / TypeScript adapter: it authenticates the caller's Bearer token, calls the
upstream **Core** API, reshapes responses for the settings UI, and publishes an OpenAPI contract that
the web service consumes. It holds no database and no local state.

## Commands

```bash
npm ci                      # install (Node.js 24 in contracts CI and Docker images)
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
`/settings`). Every `/settings` request passes through Bearer auth middleware and gets
`Cache-Control: no-store`.

**`src/clients/upstream.ts` is the core abstraction** — all upstream I/O goes through it:
- `authorization(req)` — requires `Authorization: Bearer <token>`, throws `UpstreamError(401)`.
- `baseUrl(service)` — resolves the target from env vars `<SERVICE>_URL` (+ optional `<SERVICE>_PORT`),
  e.g. `CORE_API_URL`. Missing config -> `UpstreamError(503)`.
- `json(req, service, path, init)` — typed JSON call; keeps upstream 4xx, maps 5xx and network errors to
  `UpstreamError(502)`. An empty 2xx body returns `undefined` (Core answers `PATCH /api/v1/user/me/` with an
  empty 200, not a 204).
- `forward(req, res, service, path)` — transparent proxy that preserves method, body (incl. binary /
  multipart), 2xx–4xx status, and a whitelist of response headers; an upstream 5xx becomes a 502 without
  its body. Used by the preference adapters.
- `routeError(res, err)` — the single error response shape: `{ error: { message } }`, status from
  `UpstreamError.status` or 502.

**Routes:**
- `routes/health.ts` — liveness only (`{ status: 'ok' }`), no upstream call.
- `routes/check_apis.ts` — dependency diagnostic; pings each `<service>/health`, returns 200 or 502.
- `routes/settings.ts` — the real work:
  - `GET /settings/bootstrap` aggregates Core `/api/v1/user/me/` (required; failure = error) and
    `/api/v1/sessions/` (optional; failure sets `sources.sessions: 'unavailable'`). Session objects
    are re-parsed through a Zod schema, which strips internal fields like `token_hash`.
  - `PATCH /settings/profile` validates against `ProfilePatchSchema` (`.strict()` — unknown fields
    and empty bodies are 400, never a silent success), PATCHes Core, then **re-reads** and returns the
    persisted profile.
  - `PATCH /settings/{notifications,appearance,general}` are pass-through adapters via `forward()` —
    they preserve Core's status (including 404: Core 1.1.1 serves neither `notification-settings/` nor
    `preferences/`) and never fabricate a local save.
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
- Known gaps are accepted with a justified `allowDeviation`: `GET /api/v1/sessions/` is typed by orval as the
  roles `GetResponseView` (Core really returns `{ sessions }`), and the preference routes are absent from Core
  (the mock answers 404, like Core). When a gap test in `upstream-contracts.test.ts` fails, remove the deviation.
- Fixtures live in `tests/support/core-fixtures.ts` and are validated against the contract.
- `openapi-contract.ts`, `contract-mock-server.ts` and `orval-contract.ts` are shared verbatim with `BFF_user`,
  `BFF_Calendar`, `BFF_Dashboard`, `BFF_Elearning` and `BFF_Message`; keep the copies identical.
- `.npmrc` sets `min-release-age=7`: npm 11 refuses a freshly published `@mairie360/*` version unless run with
  `--min-release-age=0`.

## Isolated test stacks (perf / security)

Mirrors the Calendar BFF / APIs pattern: two standalone Compose stacks driven by shell scripts that
return the tool's exit code (`docker-compose-{performance,security}.yml`, `performance_test.sh`,
`security_test.sh`). Both bring up `database` + `liquibase-migrations` + `seeder` (`init-test.sql`,
user id 2) + `redis` + `core-api` (probed by a curl sidecar — the published image is distroless) +
the BFF image named by `IMAGE_REF` (in CI, the image published by `release-dev`; locally,
`bff-settings:local`, built by the scripts from `development.Dockerfile` when `IMAGE_REF` is empty).

- **Performance** — k6 (`load-test.js`) hits `/health` and the authenticated `/settings/bootstrap`,
  minting an HS256 JWT (`sub=2`) with the same secret as `core-api` (`b"secret"`). Thresholds:
  `http_req_failed < 1%`, health p95 < 50 ms, settings p95 < 400 ms.
- **Security** — OWASP ZAP imports `/openapi.json`, replays every operation with a static JWT via a
  header replacer, and fails on any alert not downgraded to `IGNORE` in `.zap/rules.tsv`. Expect one
  round of `rules.tsv` tuning after the first real run.

`rules.tsv` neutralises informational alerts only; if `core-api` responds 5xx on a half-wired route the
scan will surface it — fix or triage rather than blanket-ignoring.

## ZAP OpenAPI coverage gate

`security_test.sh` / `performance_test.sh` clone `mairie360/CICD` into `cicd-repo/` (gitignored) at
the pinned `cicd_version` (`CICD_VERSION=<branch>` overrides it). ZAP runs its `zap_hooks.py` with
`--hook`: every operation of the served spec must be reached, and non-public ones with a
non-401/403 answer. The spec requires `bearerAuth` at the top level (`openapi.ts`); `/health` and
`/check_apis` set `security: []`. The k6 half (`coverage.js`, one handler per operation in
`load-test.js`) is MAIR-196.

## Gotchas

- **ESLint** uses only the flat `eslint.config.cjs` (the legacy `.eslintrc.js` was removed, like in the
  sibling BFFs).
- **Node version split.** `contracts.yml` and the Dockerfiles (`node:24-alpine`) use Node 24, while the
  shared `cicd.yml` still passes `node_version: "22"` (same as every sibling BFF).
- Dockerfiles read GitHub Packages credentials through BuildKit secrets (`npmrc`, `node_auth_token`)
  only during `npm ci`; the test compose files declare both secrets.
- `contracts:sync` is referenced in the docs/CONTRACT.md but `scripts/contracts.mjs` has `source = null`,
  so the sync branch is an inert stub — syncing to web-service repos is not wired up here.
- `src/views/check_api_view.ts` defines `CheckApiResponseSchema` but the `check_apis` route builds its
  response object ad hoc; the schema is not what's served.
- `.npmrc` points `@mairie360:*` at GitHub Packages and needs `NODE_AUTH_TOKEN`; the only `@mairie360/*`
  package is the `core-api-openapi` devDependency used by the tests (no runtime client).
- `cicd.yml` calls the shared `mairie360/CICD` `BFFs-cicd.yml@v2.3.0` (with `openapi_spec_path` and
  explicit `CODECOV_TOKEN` / `N8N_WEBHOOK_SECRET` secrets); Renovate keeps `cicd_version` aligned with
  the tag, and `.releaserc.json` drives semantic-release.
- The test stacks pin `database` / `liquibase-migrations` 1.1.0, `core-api` 1.1.1 and `bff-user` 0.4.0.
  Core API ≥ 1.1.1 panics on `/user/me` for users without a role, so `init-test.sql` gives user 2 the
  `User` role.
- `tests/contracts.test.ts` mocks `globalThis.fetch` and requires `contracts/openapi.json` to exist.

## Docs

Human-facing guides live in `docs/{en,fr}/{module,technical}.md`; `CONTRACT.md` is the BFF↔web-service
contract summary. Keep both language versions in sync when editing docs.

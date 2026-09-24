import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { createCoverage } from '/coverage.js';

// ---------------------------------------------------------------------------
// k6 load test of the BFF Settings.
//
// Every operation of the contract (contracts/openapi.json, mounted as /openapi.json) has one
// handler below: the shared OpenAPI coverage module (mairie360/CICD tests/k6/coverage.js, see
// performance_test.sh) aborts at init when an operation has no handler, and fails the
// `operations_uncovered` threshold when a handler ends without sending its request. Adding a route
// to the BFF therefore means adding its handler here.
//
// Two scenarios share the handlers:
// - `crud` (2 VUs): `coverage.run()` calls every handler once per iteration, reads and writes, so
//   it carries the coverage gate.
// - `reads` (up to 20 VUs): replays only the GET handlers.
// Every operation gets a p(95) threshold, whose budget depends on its family (`budgetOf`).
// ---------------------------------------------------------------------------

// Must match the JWT_SECRET of the core-api service of the test stack.
const JWT_SECRET = __ENV.JWT_SECRET || 'b"secret"';
// User role only, seeded by init-test.sql (sub of the token).
const USER_ID = __ENV.PERF_USER_ID || '2';
// Profile of user 2 as seeded by init-test.sql: PATCH /settings/profile writes a phone number, then
// restores these values so the reads keep seeing the seed.
const SEEDED_PROFILE = { first_name: 'Perf', last_name: 'Tester', phone: null };

function b64url(value) {
  return encoding.b64encode(value, 'rawurl');
}

// Minimal HS256 JWT accepted by Core API (sub + role + exp claims).
function mintJwt(sub, role) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, role, exp: now + 3600 }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.hmac('sha256', JWT_SECRET, signingInput, 'base64rawurl');
  return `${signingInput}.${signature}`;
}

// Core API (core-api 1.2.0, latest release) has no preferences operation: the BFF answers the
// documented 404 on these sections until Core publishes them. Only that 404 is accepted.
const preferenceStatuses = { responseCallback: http.expectedStatuses(200, 404) };
function preferenceHandler(section, body) {
  return ({ request }) =>
    check(request({ body, params: preferenceStatuses }), {
      [`${section} 200 (404: not in Core yet)`]: (r) => r.status === 200 || r.status === 404,
    });
}

const handlers = {
  // --- Connectivity (public) ---
  'GET /health': ({ request }) =>
    check(request(), { 'health 200': (r) => r.status === 200 }),
  'GET /check_apis': ({ request }) =>
    check(request(), { 'check_apis 200': (r) => r.status === 200 }),

  // --- Settings ---
  'GET /settings/bootstrap': ({ request }) =>
    check(request(), { 'bootstrap 200': (r) => r.status === 200 }),
  'PATCH /settings/profile': ({ request }) => {
    const updated = request({ body: { first_name: 'Perf', last_name: 'Tester', phone: '06 12 34 56 78' } });
    // No check on the re-read value: the two `crud` VUs patch the same user concurrently.
    check(updated, { 'patch profile 200': (r) => r.status === 200 });
    check(request({ body: SEEDED_PROFILE }), { 'restore profile 200': (r) => r.status === 200 });
  },
  'PATCH /settings/notifications': preferenceHandler('notifications', { email: true }),
  'PATCH /settings/appearance': preferenceHandler('appearance', { theme: 'dark' }),
  'PATCH /settings/general': preferenceHandler('general', { language: 'fr' }),
};

const coverage = createCoverage(handlers);
const readOperations = coverage.operations.filter((o) => o.method === 'GET');

// p(95) budget of an operation, per family.
function budgetOf({ op, method }) {
  if (op === 'GET /health') return 50; // process probe
  if (op === 'GET /check_apis') return 150; // -> Core /health
  if (method === 'GET') return 400; // BFF aggregation + Core reads
  return 800; // writes (profile: Core PATCH then GET)
}

const perOperationThresholds = {};
for (const operation of coverage.operations) {
  perOperationThresholds[`http_req_duration{op:${operation.op}}`] = [`p(95)<${budgetOf(operation)}`];
}

export const options = {
  scenarios: {
    reads: {
      executor: 'ramping-vus',
      exec: 'reads',
      stages: [
        { duration: '30s', target: 20 }, // ramp-up
        { duration: '1m', target: 20 }, // steady load
        { duration: '10s', target: 0 }, // ramp-down
      ],
    },
    crud: {
      executor: 'constant-vus',
      exec: 'crud',
      vus: 2,
      duration: '1m40s',
    },
  },
  thresholds: {
    ...coverage.thresholds,
    ...perOperationThresholds,
    http_req_failed: ['rate<0.01'], // < 1% errors
    checks: ['rate>0.99'],
  },
};

export function setup() {
  return { user: { Authorization: `Bearer ${mintJwt(USER_ID, 'user')}` } };
}

// Every GET handler, with a plain request() (no coverage accounting: `crud` owns the gate).
export function reads(data) {
  for (const operation of readOperations) {
    const request = (call = {}) =>
      http.get(coverage.url(operation.op, call.path, call.query), {
        headers: Object.assign({}, data.user, call.headers),
        tags: { op: operation.op },
      });
    handlers[operation.op]({ request, data, op: operation.op, method: operation.method, path: operation.path });
  }
  sleep(1);
}

export function crud(data) {
  coverage.run({ headers: data.user, data });
  sleep(1);
}

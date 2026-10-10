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
// Three scenarios share the handlers:
// - `crud`: `coverage.run()` calls every handler once per iteration, reads and writes, so it carries the
//   coverage gate. Each VU writes as its own seeded agent (the last ten of init-perf.sql), so the
//   handlers can check the value Core stored.
// - `reads`: replays only the GET handlers, as random seeded agents.
// - `bootstrap_rush`: `GET /settings/bootstrap` at a fixed arrival rate, failing on any dropped iteration.
// Every operation gets a p(95) threshold, whose budget depends on its family (`budgetOf`).
//
// MAIR-474: the stack also runs init-perf.sql (BFF_user's Core seed: 10 000 agents with five sessions
// each, one of them active), every read checks that it got the agent's own profile and sessions, and the
// thresholds are strict (every check passes, no failed request, no dropped iteration). K6_PROFILE sizes
// the load: `ci` (default) is what the 4 vCPU CI runner holds, `stress` is the high load, run by hand.
// ---------------------------------------------------------------------------

// The JWT_SECRET of the core-api / bff-settings services of the test stack: random per run, generated
// by stack_secrets.sh (MAIR-474). No default: nothing is signed with a committed secret.
const JWT_SECRET = __ENV.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set: run ./performance_test.sh, which generates it');
// Rows of init-perf.sql: agents 500001..510000 (`perf.agent.<id>@mairie360.fr`). The reads use the first
// 9 990, the crud VUs write as the last ten.
const AGENTS = { first: 500001, readers: 9990, writers: 10 };

const PROFILES = {
  ci: { readVus: 30, crudVus: 2, rushRate: 30 },
  stress: { readVus: 100, crudVus: 4, rushRate: 100 },
};
const PROFILE = PROFILES[__ENV.K6_PROFILE || 'ci'];
if (!PROFILE) throw new Error(`Unknown K6_PROFILE ${__ENV.K6_PROFILE}: ${Object.keys(PROFILES).join(', ')}`);

function b64url(value) {
  return encoding.b64encode(value, 'rawurl');
}

// Minimal HS256 JWT accepted by Core API and the BFF (sub + role + exp claims).
function mintJwt(sub, role) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, role, exp: now + 3600 }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.hmac('sha256', JWT_SECRET, signingInput, 'base64rawurl');
  return `${signingInput}.${signature}`;
}

const tokens = {};
function agent(id) {
  if (!tokens[id]) tokens[id] = { Authorization: `Bearer ${mintJwt(String(id), 'user')}` };
  return { id, headers: tokens[id] };
}
const randomReader = () => agent(AGENTS.first + Math.floor(Math.random() * AGENTS.readers));
// The agent the current crud VU writes as.
const writer = () => agent(AGENTS.first + AGENTS.readers + ((__VU - 1) % AGENTS.writers));

function json(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

/** The bootstrap of `who`: its own profile, its active session, every section available. */
function checkBootstrap(response, who, prefix) {
  return check(response, {
    [`${prefix} 200`]: (r) => r.status === 200,
    [`${prefix} is the agent with its session`]: (r) => {
      const body = json(r) || {};
      return r.status === 200 && body.profile?.email === `perf.agent.${who.id}@mairie360.fr`
        && Array.isArray(body.sessions) && body.sessions.length >= 1
        && Object.values(body.sources || {}).every((source) => source === 'available');
    },
  });
}

// A preference section: Core answers the stored section, which must hold the value sent.
function preferenceHandler(section, body) {
  const [field, value] = Object.entries(body)[0];
  return ({ request }) => check(request({ body, headers: writer().headers }), {
    [`${section} 200`]: (r) => r.status === 200,
    [`${section} stored`]: (r) => r.status === 200 && (json(r) || {})[field] === value,
  });
}

const handlers = {
  // --- Connectivity (public) ---
  'GET /health': ({ request }) =>
    check(request(), { 'health 200': (r) => r.status === 200 }),
  'GET /check_apis': ({ request }) =>
    check(request(), { 'check_apis 200': (r) => r.status === 200 }),

  // --- Settings ---
  'GET /settings/bootstrap': ({ request }) => {
    const who = randomReader();
    checkBootstrap(request({ headers: who.headers }), who, 'bootstrap');
  },
  // Core API (MAIR-480) parses the national number with its country and answers it in E.164; `null`
  // clears it again, so every iteration starts from the seed.
  'PATCH /settings/profile': ({ request }) => {
    const who = writer();
    check(request({ body: { phone: '06 12 34 56 78', phone_country: 'FR' }, headers: who.headers }), {
      'patch profile 200': (r) => r.status === 200,
      'patch profile stored in E.164': (r) =>
        r.status === 200 && (json(r) || {}).phone === '+33612345678' && (json(r) || {}).phone_country === 'FR',
    });
    check(request({ body: { phone: null }, headers: who.headers }), {
      'clear phone 200': (r) => r.status === 200 && (json(r) || {}).phone == null,
    });
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
        { duration: '30s', target: Math.ceil(PROFILE.readVus / 2) }, // ramp-up
        { duration: '30s', target: PROFILE.readVus },
        { duration: '2m', target: PROFILE.readVus }, // steady load
        { duration: '20s', target: 0 }, // ramp-down
      ],
    },
    crud: {
      executor: 'constant-vus',
      exec: 'crud',
      vus: PROFILE.crudVus,
      duration: '3m20s',
    },
    bootstrap_rush: {
      executor: 'constant-arrival-rate',
      exec: 'bootstrapRush',
      startTime: '1m', // once the reads are at their peak
      rate: PROFILE.rushRate,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 30,
      maxVUs: 200,
    },
  },
  thresholds: {
    ...coverage.thresholds,
    ...perOperationThresholds,
    'http_req_duration{op:bootstrap_rush}': ['p(95)<400'],
    dropped_iterations: ['count==0'], // the rush kept its rate
    // Strict (MAIR-474): one wrong status, one wrong row or one failed request fails the run.
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
};

// Every GET handler, with a plain request() (no coverage accounting: `crud` owns the gate).
export function reads() {
  for (const operation of readOperations) {
    const request = (call = {}) =>
      http.get(coverage.url(operation.op, call.path, call.query), {
        headers: call.headers || {},
        tags: { op: operation.op },
      });
    handlers[operation.op]({ request, op: operation.op, method: operation.method, path: operation.path });
  }
  sleep(1);
}

export function bootstrapRush() {
  const who = randomReader();
  checkBootstrap(
    http.get(coverage.url('GET /settings/bootstrap'), { headers: who.headers, tags: { op: 'bootstrap_rush' } }),
    who,
    'rush bootstrap',
  );
}

export function crud() {
  coverage.run({});
  sleep(1);
}

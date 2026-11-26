import http from 'k6/http';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { check, sleep } from 'k6';
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

// EdDSA tokens signed by performance_test.sh with this run's key, like Core signs them (MAIR-474,
// MAIR-680): k6 cannot sign Ed25519 and nothing is signed with a committed key. The file maps every
// seeded agent's id to its token (role `user`).
const TOKENS = JSON.parse(open(__ENV.JWT_TOKENS_FILE || '/tokens.json'));
// Rows of init-perf.sql: agents 500001..510000 (`perf.agent.<id>@mairie360.fr`). The reads use the first
// 9 990, the crud VUs write as the last ten.
const AGENTS = { first: 500001, readers: 9990, writers: 10 };

const PROFILES = {
  ci: { readVus: 30, crudVus: 2, rushRate: 30 },
  stress: { readVus: 100, crudVus: 4, rushRate: 100 },
};
const PROFILE = PROFILES[__ENV.K6_PROFILE || 'ci'];
if (!PROFILE) throw new Error(`Unknown K6_PROFILE ${__ENV.K6_PROFILE}: ${Object.keys(PROFILES).join(', ')}`);

// Token of seeded caller `id`, signed by performance_test.sh (fails the run on an unknown id).
function jwtOf(id) {
  const token = TOKENS[String(id)];
  if (!token) throw new Error(`no token signed for user ${id}: see performance_test.sh`);
  return token;
}

const tokens = {};
function agent(id) {
  if (!tokens[id]) tokens[id] = { Authorization: `Bearer ${jwtOf(id)}` };
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

// MAIR-805: second factor. RFC 6238 code of `secret` (base32) at `step`, as an authenticator application computes it.
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret, step) {
  let bits = '';
  for (const ch of secret) bits += BASE32.indexOf(ch).toString(2).padStart(5, '0');
  const key = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i += 1) key[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const counter = new Uint8Array(8);
  for (let i = 7, n = step; i >= 0; i -= 1, n = Math.floor(n / 256)) counter[i] = n % 256;
  const mac = new Uint8Array(crypto.hmac('sha1', key.buffer, counter.buffer, 'binary'));
  const o = mac[19] & 0x0f;
  const n = (((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 1000000;
  return String(n).padStart(6, '0');
}
const currentStep = () => Math.floor(Date.now() / 30000);

// The seeded agents' password (init-perf.sql): turning the factor off asks for it.
const AGENT_PASSWORD = 'PerfAgent!2fa-0001';

/** A request that is not the operation under test (set-up and clean-up): untagged, it must succeed. */
function fixture(operation, who, body) {
  const response = http.post(coverage.url(operation), body === undefined ? null : JSON.stringify(body), {
    headers: { ...who.headers, 'Content-Type': 'application/json' },
  });
  if (response.status >= 300) throw new Error(`${operation} fixture answered ${response.status}`);
  return response;
}

/** Turns the second factor of `who` on: its secret and ten backup codes, the agent being unprotected before. */
function enrol(who) {
  const secret = fixture('POST /settings/2fa/setup', who).json('secret');
  const codes = fixture('POST /settings/2fa/confirm', who, { code: totp(secret, currentStep()) }).json('backup_codes');
  return { secret, codes };
}

/** Back to the seed: no factor, so every iteration (and every handler) starts from the same agent. */
function unenrol(who, code) {
  fixture('POST /settings/2fa/disable', who, { password: AGENT_PASSWORD, code });
}

// MAIR-823: a fresh session of `who` opened at Core with its password (the tokens of performance_test.sh carry no
// session id). Its id is the `sid` of the JWT Core answers.
const CORE_URL = __ENV.CORE_URL || 'http://core:3000';
function openCoreSession(who) {
  const response = http.post(`${CORE_URL}/api/v1/auth/login`, JSON.stringify({
    email: `perf.agent.${who.id}@mairie360.fr`, password: AGENT_PASSWORD, device_info: 'k6',
  }), { headers: { 'Content-Type': 'application/json' } });
  if (response.status !== 200) throw new Error(`Core login fixture answered ${response.status}`);
  const jwt = response.headers.Authorization.replace(/^Bearer /, '');
  return JSON.parse(encoding.b64decode(jwt.split('.')[1], 'rawurl', 's')).sid;
}

const handlers = {
  // --- Connectivity (public) ---
  'GET /health': ({ request }) =>
    check(request(), { 'health 200': (r) => r.status === 200 }),
  'GET /check_apis': ({ request }) =>
    check(request(), { 'check_apis 200': (r) => r.status === 200 }),

  // --- Global search ---
  // As a seeded agent: each module answers or is listed as unavailable, never an error.
  'GET /search': ({ request }) =>
    check(request({ query: { q: 'ag' }, headers: randomReader().headers }), {
      'search 200': (r) => r.status === 200,
      'search is the grouped answer': (r) => {
        const body = json(r);
        return Boolean(body) && Array.isArray(body.groups) && Array.isArray(body.unavailable);
      },
    }),

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
  'PATCH /settings/notifications': preferenceHandler('notifications', { system_updates: true }),
  'PATCH /settings/appearance': preferenceHandler('appearance', { font_family: 'atkinson' }),
  'PATCH /settings/general': preferenceHandler('general', { autosave: true }),

  // --- Sessions and password (MAIR-823): the writer opens a session at Core first, then ends it here ---
  'DELETE /settings/sessions/{id}': ({ request }) => {
    const who = writer();
    const sid = openCoreSession(who);
    check(request({ path: { id: sid }, headers: who.headers }), {
      'end session 200': (r) => r.status === 200,
      'ended session left the active ones': (r) =>
        r.status === 200 && !(json(r)?.sessions || []).some((s) => s.id === sid),
    });
  },
  'POST /settings/sessions/revoke-others': ({ request }) => {
    const who = writer();
    openCoreSession(who);
    check(request({ headers: who.headers }), {
      'revoke others 200': (r) => r.status === 200 && (json(r)?.revoked || 0) >= 1 && (json(r)?.sessions || []).length === 0,
    });
  },
  // Changed, then set back, so the second-factor handlers keep the seeded password.
  'POST /settings/password': ({ request }) => {
    const who = writer();
    const other = `${AGENT_PASSWORD}-k6`;
    check(request({ body: { current_password: AGENT_PASSWORD, new_password: other }, headers: who.headers }), {
      'change password 204': (r) => r.status === 204,
    });
    fixture('POST /settings/password', who, { current_password: other, new_password: AGENT_PASSWORD });
  },

  // --- Second factor (MAIR-805): the writer ends every handler unprotected again ---
  'GET /settings/2fa': ({ request }) =>
    check(request({ headers: randomReader().headers }), {
      '2fa status 200': (r) => r.status === 200 && json(r)?.enabled === false && json(r)?.backup_codes_remaining === 0,
    }),
  'POST /settings/2fa/setup': ({ request }) =>
    check(request({ headers: writer().headers }), {
      '2fa setup 200': (r) => r.status === 200 && !!json(r)?.secret && `${json(r)?.otpauth_uri}`.startsWith('otpauth://'),
    }),
  'POST /settings/2fa/confirm': ({ request }) => {
    const who = writer();
    const secret = fixture('POST /settings/2fa/setup', who).json('secret');
    const response = request({ body: { code: totp(secret, currentStep()) }, headers: who.headers });
    check(response, {
      '2fa confirm 200': (r) => r.status === 200 && json(r)?.backup_codes?.length === 10,
    });
    if (response.status === 200) unenrol(who, response.json('backup_codes')[0]);
  },
  'POST /settings/2fa/backup-codes': ({ request }) => {
    const who = writer();
    const { codes } = enrol(who);
    const response = request({ body: { code: codes[0] }, headers: who.headers });
    check(response, {
      '2fa backup codes 200': (r) => r.status === 200 && json(r)?.backup_codes?.length === 10,
    });
    unenrol(who, response.status === 200 ? response.json('backup_codes')[0] : codes[1]);
  },
  'POST /settings/2fa/disable': ({ request }) => {
    const who = writer();
    const { codes } = enrol(who);
    check(request({ body: { password: AGENT_PASSWORD, code: codes[0] }, headers: who.headers }), {
      '2fa disable 204': (r) => r.status === 204,
    });
  },

  // --- Passkeys (MAIR-810) ---
  // Nothing here can sign a WebAuthn answer, and passkeys are refused by default (the policy of the
  // instance): the list and the delete of an unknown id are answered as they are, the other routes
  // answer the policy's 403 before they look at the body. The successful registration is Core's
  // (tests/endpoints/passkeys.rs) and the jest mocks'.
  'GET /settings/passkeys': ({ request }) =>
    check(request({ headers: randomReader().headers }), {
      'passkeys 200': (r) => r.status === 200 && Array.isArray(json(r)) && json(r).length === 0,
    }),
  'POST /settings/passkeys/options': ({ request }) =>
    check(request({ body: {}, headers: writer().headers, params: { responseCallback: http.expectedStatuses(403) } }), {
      'passkey options refused by the policy 403': (r) => r.status === 403,
    }),
  'POST /settings/passkeys': ({ request }) =>
    check(
      request({
        body: { label: 'k6', credential: { id: 'AAAA', rawId: 'AAAA', type: 'public-key', response: { attestationObject: 'AAAA', clientDataJSON: 'AAAA' } } },
        headers: writer().headers,
        params: { responseCallback: http.expectedStatuses(403) },
      }),
      { 'passkey registration refused by the policy 403': (r) => r.status === 403 },
    ),
  'DELETE /settings/passkeys/{id}': ({ request }) =>
    check(request({ path: { id: 999999999 }, headers: writer().headers, params: { responseCallback: http.expectedStatuses(404) } }), {
      'unknown passkey 404': (r) => r.status === 404,
    }),
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

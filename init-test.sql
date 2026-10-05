-- Minimal seed for the isolated test stacks (performance / security) of BFF Settings.
-- The test JWTs reference two users:
--   * sub = "1": Admin role. docker-compose-security.yml injects a static token for it
--     through the ZAP replacer, so every operation is scanned authenticated;
--   * sub = "2": User role only. load-test.js signs a token for it on the fly.
-- BFF Settings only reads the Core profile (/api/v1/user/me/) and the session list.

-- Passwords must be argon2id hashes (chk_users_password_hashed, MAIR-169): this is the
-- Database template hash, nobody signs in with it (the tests use forged JWTs).
INSERT INTO users (id, first_name, last_name, email, password, status)
VALUES
    (1, 'Security', 'Admin', 'security-admin@mairie360.fr', '$argon2id$v=19$m=19456,t=2,p=1$/iKF9PbiDRDs4EKPjlIIhg$UKx9vfwwps250mEP/bYp63CXbEnQGULeUAhDq+az9Aw', 'active'),
    (2, 'Perf', 'Tester', 'perf-tester@mairie360.fr', '$argon2id$v=19$m=19456,t=2,p=1$/iKF9PbiDRDs4EKPjlIIhg$UKx9vfwwps250mEP/bYp63CXbEnQGULeUAhDq+az9Aw', 'active')
ON CONFLICT (id) DO NOTHING;

-- Core API >= 1.1.1 requires at least one role on the user for GET /user/me
-- (otherwise Core panics with "index out of bounds" -> 502 on /settings/bootstrap).
-- Core returns a single role: user 1 must only hold Admin.
DELETE FROM user_roles
WHERE user_id = 1 AND role_id <> (SELECT id FROM roles WHERE lower(name) = 'admin');

INSERT INTO user_roles (user_id, role_id)
SELECT 1, r.id FROM roles r WHERE lower(r.name) = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT 2, r.id FROM roles r WHERE lower(r.name) = 'user'
ON CONFLICT DO NOTHING;

-- Explicit ids do not advance the sequence: move it past them so that users created
-- during the tests do not collide.
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));

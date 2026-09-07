import request from 'supertest';
import { readFileSync } from 'node:fs';
import app from '../src/app';

const fetchMock = jest.spyOn(globalThis, 'fetch');
beforeEach(() => { fetchMock.mockReset(); });
afterAll(() => { fetchMock.mockRestore(); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('runtime and exported routes/data have the same OpenAPI document', async () => {
  const expected = JSON.parse(readFileSync('contracts/openapi.json', 'utf8'));
  for (const path of ['/openapi.json', '/swagger.json']) {
    const result = await request(app).get(path);
    expect(result.status).toBe(200);
    expect(result.body).toEqual(expected);
  }
});

test('bootstrap rejects a missing session before contacting upstream services', async () => {
  const result = await request(app).get('/settings/bootstrap');
  expect(result.status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

beforeEach(() => { process.env.CORE_API_URL = 'http://core.example'; });
const profile = { first_name: 'Anne Marie', last_name: 'Le Gall', email: 'anne@example.test', phone: null };
test('bootstrap strips internal session fields and distinguishes unavailable sessions', async () => {
  const session = { id: 'session-1', device_info: 'Browser', ip_address: '127.0.0.1', created_at: '2026-09-01', expires_at: '2026-09-08', revoked_at: null };
  fetchMock.mockResolvedValueOnce(response(profile)).mockResolvedValueOnce(response({ sessions: [{ ...session, token_hash: 'internal' }] }));
  const result = await request(app).get('/settings/bootstrap').set('Authorization', 'Bearer test-session');
  expect(result.status).toBe(200); expect(result.body.profile).toEqual(profile); expect(result.body.sessions).toEqual([session]);
});
test('saving a profile preserves compound names and re-reads persisted data', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(response(profile));
  const result = await request(app).patch('/settings/profile').set('Authorization', 'Bearer test-session').send(profile);
  expect(result.status).toBe(200); expect(result.body).toEqual(profile);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(profile);
  expect(fetchMock.mock.calls[1][1]?.method).toBeUndefined();
});
test('unsupported profile fields never report a successful save', async () => {
  const result = await request(app).patch('/settings/profile').set('Authorization', 'Bearer test-session').send({ fullName: 'Anne Marie Le Gall', roles: ['Admin'] });
  expect(result.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
});
test('missing preferences API remains unavailable', async () => {
  fetchMock.mockResolvedValueOnce(response({ message: 'Not found' }, 404));
  const result = await request(app).patch('/settings/appearance').set('Authorization', 'Bearer test-session').send({ theme: 'dark' });
  expect(result.status).toBe(404);
});

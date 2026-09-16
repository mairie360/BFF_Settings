import axios from 'axios';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import app from '../src/app';

// Les appels à Core API passent par le client généré : les autres comportements du BFF sont vérifiés
// contre un vrai serveur HTTP piloté par le contrat (settings.upstream-mocks.test.ts).
const requestSpy = jest.spyOn(axios.Axios.prototype, 'request');
beforeEach(() => { requestSpy.mockClear(); });
afterAll(() => { requestSpy.mockRestore(); });

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
  expect(requestSpy).not.toHaveBeenCalled();
});

test('unsupported profile fields never report a successful save', async () => {
  const result = await request(app)
    .patch('/settings/profile')
    .set('Authorization', 'Bearer test-session')
    .send({ fullName: 'Anne Marie Le Gall', roles: ['Admin'] });

  expect(result.status).toBe(400);
  expect(requestSpy).not.toHaveBeenCalled();
});

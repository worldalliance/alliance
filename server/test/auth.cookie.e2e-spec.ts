import { createTestApp, TestContext } from './e2e-test-utils';
import * as request from 'supertest';

describe('Auth via Http-Only cookies (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);

    await ctx.agent.post('/auth/register').send({
      email: 'newuser@test.com',
      password: 'password',
      name: 'Cookie Tester',
      mode: 'cookie',
    });
  }, 50000);

  it('rejects invalid login', () => {
    return ctx.agent
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'password' })
      .expect(401);
  });

  it('registers a new user', () => {
    return ctx.agent
      .post('/auth/register')
      .send({
        email: 'newuser2@test.com',
        password: 'password',
        name: 'Cookie Tester',
        mode: 'cookie',
      })
      .expect(201);
  });

  it('user can login', () => {
    const loginResponse = ctx.agent.post('/auth/login').send({
      email: 'newuser@test.com',
      password: 'password',
      mode: 'cookie',
    });

    loginResponse.expect(200);
  });

  it('logged in user can get profile', () => {
    return ctx.agent.get('/auth/me').expect(200);
  });

  describe('refresh flow', () => {
    it('allows refresh with valid cookie', () => {
      return ctx.agent.post('/auth/refresh').expect(200);
    });

    it('rejects refresh with invalid cookie', () => {
      return request(ctx.app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});

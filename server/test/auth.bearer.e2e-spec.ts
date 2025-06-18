import * as request from 'supertest';
import { User } from '../src/user/user.entity';
import { Repository } from 'typeorm';
import { AuthTokens } from '../src/auth/dto/authtokens.dto';
import { createTestApp, TestContext } from './e2e-test-utils';

describe('Auth (e2e)', () => {
  let userRepository: Repository<User>;
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepository = ctx.dataSource.getRepository(User);
  }, 50000);

  it('returns 401 for invalid login', () => {
    return request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'baduser@test.com', password: 'password' })
      .expect(401);
  });

  it('registers a new user', () => {
    return request(ctx.app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'newusertest@test.com',
        password: 'password',
        name: 'Test User',
      })
      .expect(201);
  });

  it('returns a token for a valid login', async () => {
    const user = userRepository.create({
      email: 'newusertest@test.com',
      password: 'password',
      name: 'Test User',
    });
    await userRepository.save(user);

    const response = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'newusertest@test.com',
        password: 'password',
        mode: 'header',
      })
      .expect(200);

    const body = response.body as AuthTokens;

    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
  });

  describe('token refresh', () => {
    it('returns 401 for invalid refresh token', () => {
      return request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid' })
        .expect(401);
    });

    it('returns a new access token for a valid refresh token', async () => {
      const user = userRepository.create({
        email: 'newusertest@test.com',
        password: 'password',
        name: 'Test User',
      });
      await userRepository.save(user);

      const loginResponse = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'newusertest@test.com',
          password: 'password',
          mode: 'header',
        })
        .expect(200);

      const loginBody = loginResponse.body as AuthTokens;

      const refreshResponse = await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${loginBody.refresh_token}`)
        .expect(200);

      const refreshBody = refreshResponse.body as Pick<
        AuthTokens,
        'access_token'
      >;

      expect(refreshBody.access_token).toBeDefined();
    });
  });

  afterEach(async () => {
    await userRepository.query('DELETE FROM "user"');
  });

  afterAll(async () => {
    await ctx.app.close();
  });
});

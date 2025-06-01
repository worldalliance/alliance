import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { User } from '../src/user/user.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { AuthController } from '../src/auth/auth.controller';
import { User } from '../src/user/user.entity';
import { Action } from '../src/actions/entities/action.entity';
import { UserAction } from '../src/actions/entities/user-action.entity';
import { Image } from '../src/images/entities/image.entity';
import { Communique } from '../src/communiques/entities/communique.entity';
import { ActionEvent } from '../src/actions/entities/action-event.entity';

describe('Auth via Http-Only cookies (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forFeature([User, Action, UserAction]),
        AuthModule,
        UserModule,
        JwtModule, // JWT strategy still needed internally
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Action, UserAction, Image, Communique, ActionEvent],
          synchronize: true,
        }),
      ],
      controllers: [AuthController],
    }).compile();
    ctx = await createTestApp([]);

    await ctx.agent.post('/auth/register').send({
      email: 'newuser@test.com',
      password: 'password',
      name: 'Cookie Tester',
      mode: 'cookie',
    });
  });

  /** ------------------------------------------------------------------ *
   *  Helper: create an agent that persists the server-managed cookies   *
   * ------------------------------------------------------------------- */
  const agent = () => request.agent(app.getHttpServer());

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

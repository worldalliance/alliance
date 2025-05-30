import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/user/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthTokens } from '../src/auth/dto/authtokens.dto';
import { UserAction } from '../src/actions/entities/user-action.entity';
import { Action } from '../src/actions/entities/action.entity';
import { AuthController } from '../src/auth/auth.controller';
import { Image } from '../src/images/entities/image.entity';
import { Communique } from '../src/communiques/entities/communique.entity';
import { Friend } from '../src/user/friend.entity';
import { Notification } from '../src/notifs/entities/notification.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AuthModule,
        JwtModule,
        UserModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            User,
            Action,
            UserAction,
            Image,
            Communique,
            Friend,
            Notification,
          ],
          synchronize: true,
        }),
      ],
      controllers: [AuthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
  });

  it('returns 401 for invalid login', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'baduser@test.com', password: 'password' })
      .expect(401);
  });

  it('registers a new user', () => {
    return request(app.getHttpServer())
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

    const response = await request(app.getHttpServer())
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
      return request(app.getHttpServer())
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

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'newusertest@test.com',
          password: 'password',
          mode: 'header',
        })
        .expect(200);

      const loginBody = loginResponse.body as AuthTokens;

      const refreshResponse = await request(app.getHttpServer())
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
    await userRepository.query('DELETE FROM user');
  });

  afterAll(async () => {
    await app.close();
  });
});

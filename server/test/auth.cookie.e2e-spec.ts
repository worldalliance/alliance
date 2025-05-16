import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { Repository, DataSource } from 'typeorm';

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { AuthController } from '../src/auth/auth.controller';

import { User } from '../src/user/user.entity';
import { Action } from '../src/actions/entities/action.entity';
import { UserAction } from '../src/actions/entities/user-action.entity';
import { Image } from '../src/images/entities/image.entity';
import { Communique } from '../src/communiques/entities/communique.entity';

describe('Auth via Http-Only cookies (e2e)', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;

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
          entities: [User, Action, UserAction, Image, Communique],
          synchronize: true,
        }),
      ],
      controllers: [AuthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser()); // tests don’t run main.ts bootstrap
    await app.init();

    const dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepo = dataSource.getRepository(User);
  });

  /** ------------------------------------------------------------------ *
   *  Helper: create an agent that persists the server-managed cookies   *
   * ------------------------------------------------------------------- */
  const agent = () => request.agent(app.getHttpServer());

  it('rejects invalid login', () => {
    return agent()
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'password' })
      .expect(401);
  });

  it('registers a new user', () => {
    return agent()
      .post('/auth/register')
      .send({
        email: 'newuser@test.com',
        password: 'password',
        name: 'Cookie Tester',
        mode: 'cookie',
      })
      .expect(201);
  });

  describe('refresh flow', () => {
    it('rejects refresh without a valid cookie', () => {
      return agent().post('/auth/refresh').expect(401);
    });
  });

  afterEach(async () => {
    await userRepo.query('DELETE FROM user');
  });

  afterAll(async () => {
    await app.close();
  });
});

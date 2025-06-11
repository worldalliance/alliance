import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { ActionsModule } from '../src/actions/actions.module';
import { UserModule } from '../src/user/user.module';
import { User } from '../src/user/user.entity';
import { Action } from '../src/actions/entities/action.entity';
import { UserAction } from '../src/actions/entities/user-action.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Communique } from '../src/communiques/entities/communique.entity';
import { Image } from '../src/images/entities/image.entity';
import { Post } from '../src/forum/entities/post.entity';
import { Reply } from '../src/forum/entities/reply.entity';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Friend } from '../src/user/friend.entity';
import { Notification } from '../src/notifs/entities/notification.entity';
import TestAgent from 'supertest/lib/agent';
import * as supertest from 'supertest';
import * as cookieParser from 'cookie-parser';
import { ActionEvent } from '../src/actions/entities/action-event.entity';
import { City } from 'src/geo/city.entity';
import { NotifsModule } from 'src/notifs/notifs.module';
import { PrefillUser } from 'src/user/prefill-user.entity';
import { Mail } from 'src/mail/mail.entity';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  accessToken: string;
  adminAccessToken: string;
  jwtService: JwtService;
  testUserId: number;
  agent: TestAgent;
}

export async function createTestApp(
  modules: Type<unknown>[],
): Promise<TestContext> {
  jest.setTimeout(15000);
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      EventEmitterModule.forRoot(),
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        dropSchema: true,
        entities: [
          User,
          Action,
          ActionEvent,
          UserAction,
          Image,
          Communique,
          Post,
          Reply,
          Friend,
          Notification,
          City,
          Mail,
          PrefillUser,
        ],
        synchronize: true,
      }),
      AuthModule,
      ActionsModule,
      NotifsModule,
      UserModule,
      ...modules,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());
  await app.init();

  const dataSource = moduleFixture.get(DataSource);

  // Initialize database
  await dataSource.synchronize(true);

  // Get repositories
  const userRepo = dataSource.getRepository(User);
  const jwtService = moduleFixture.get<JwtService>(JwtService);

  // Create test users
  const user = await userRepo.save(
    userRepo.create({
      email: 'user@example.com',
      password: 'pass',
      name: 'User',
    }),
  );

  const adminUser = await userRepo.save(
    userRepo.create({
      email: 'admin@example.com',
      password: 'pass',
      name: 'Admin',
      admin: true,
    }),
  );

  // Generate tokens
  const accessToken = jwtService.sign(
    { sub: user.id, email: user.email, name: user.name },
    { secret: process.env.JWT_SECRET },
  );

  const adminAccessToken = jwtService.sign(
    { sub: adminUser.id, email: adminUser.email, name: adminUser.name },
    { secret: process.env.JWT_SECRET },
  );

  const agent = supertest.agent(app.getHttpServer());

  // start agent as logged in user
  await agent.post('/auth/login').send({
    email: 'user@example.com',
    password: 'pass',
    mode: 'cookie',
  });

  return {
    app,
    dataSource,
    accessToken,
    adminAccessToken,
    jwtService,
    testUserId: user.id,
    agent,
  };
}

import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { ActionsModule } from '../src/actions/actions.module';
import { UserModule } from '../src/user/user.module';
import { User } from '../src/user/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import TestAgent from 'supertest/lib/agent';
import * as supertest from 'supertest';
import * as cookieParser from 'cookie-parser';
import { NotifsModule } from 'src/notifs/notifs.module';
import { MailerModule } from '@nestjs-modules/mailer';

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
  await startPostgres();
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      MailerModule.forRoot({
        transport: {
          jsonTransport: true,
        },
        template: {},
      }),
      EventEmitterModule.forRoot(),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: pg.getHost(),
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
        synchronize: true,
        dropSchema: true,
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
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedTestContainer } from 'testcontainers';

let pg: StartedTestContainer;

export const startPostgres = async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase(process.env.DB_NAME || 'testdb')
    .withUsername(process.env.DB_USERNAME || 'test')
    .withPassword(process.env.DB_PASSWORD || 'test')
    .withReuse()
    .start();
  return pg;
};

export const stopPostgres = async () => {
  if (pg) await pg.stop();
};

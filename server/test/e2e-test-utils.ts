import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthModule } from '../src/auth/auth.module';
import { ActionsModule } from '../src/actions/actions.module';
import { ContractModule } from '../src/contract/contract.module';
import { UserModule } from '../src/user/user.module';
import { User } from '../src/user/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import TestAgent from 'supertest/lib/agent';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';
import { NotifsModule } from 'src/notifs/notifs.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { testConnectionOptions } from 'src/datasources/dataSourceTest';
import { Tag } from 'src/user/entities/tag.entity';
import { ForumModule } from 'src/forum/forum.module';
import { Contract } from 'src/contract/entities/contract.entity';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  accessToken: string;
  adminAccessToken: string;
  jwtService: JwtService;
  testUserId: number;
  adminUserId: number;
  agent: TestAgent;
  defaultTag: Tag;
  defaultContractId: number;
}

export async function createTestApp(
  modules: Type<unknown>[],
): Promise<TestContext> {
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
      TypeOrmModule.forRoot(testConnectionOptions()),
      AuthModule,
      ForumModule,
      ActionsModule,
      ContractModule,
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

  const userRepo = dataSource.getRepository(User);
  const tagRepo = dataSource.getRepository(Tag);
  const jwtService = moduleFixture.get<JwtService>(JwtService);

  const defaultTag = await tagRepo.save(
    tagRepo.create({ name: 'Default Tag', description: 'Default Tag' }),
  );

  const contractRepo = dataSource.getRepository(Contract);
  const defaultContract = await contractRepo.save(
    contractRepo.create({
      markdown: '# Test Contract',
      startDate: new Date(0),
    }),
  );

  const user = await userRepo.save(
    userRepo.create({
      email: 'user@example.com',
      password: 'pass',
      name: 'Test User',
      tags: [defaultTag],
    }),
  );

  const adminUser = await userRepo.save(
    userRepo.create({
      email: 'admin@example.com',
      password: 'pass',
      name: 'Test Admin',
      admin: true,
      tags: [defaultTag],
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
    adminUserId: adminUser.id,
    agent,
    defaultTag,
    defaultContractId: defaultContract.id,
  };
}

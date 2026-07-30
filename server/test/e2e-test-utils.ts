import { FormSchema } from '@alliance/common/forms/form-schema';
import { MailerModule } from '@nestjs-modules/mailer';
import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { Contract } from 'src/contract/entities/contract.entity';
import { testConnectionOptions } from 'src/datasources/dataSourceTest';
import { VALIDATION_PIPE_OPTIONS } from 'src/utils/validation-pipe-options';
import { ForumModule } from 'src/forum/forum.module';
import { NotifsModule } from 'src/notifs/notifs.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { Form } from 'src/tasks/entities/form.entity';
import { FormSnapshot } from 'src/tasks/entities/formsnapshot.entity';
import { FormSnapshotService } from 'src/tasks/formsnapshot.service';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { Tag } from 'src/user/entities/tag.entity';
import { ALL_THROTTLERS } from 'src/utils/throttle';
import supertest from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { ActionsModule } from '../src/actions/actions.module';
import { AuthModule } from '../src/auth/auth.module';
import { ContractModule } from '../src/contract/contract.module';
import { ReferralSource, User } from '../src/user/entities/user.entity';
import { UserModule } from '../src/user/user.module';

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
  options: { enableThrottle?: boolean } = {},
): Promise<TestContext> {
  const builder = Test.createTestingModule({
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
      ThrottlerModule.forRoot(ALL_THROTTLERS),
      TypeOrmModule.forRoot(testConnectionOptions()),
      PosthogModule,
      AuthModule,
      ForumModule,
      ActionsModule,
      ContractModule,
      NotifsModule,
      UserModule,
      ...modules,
    ],
  });

  // Disable signup rate limiting by default. The burst limit is 5/min per IP and
  // the in-memory counter is shared across a whole spec (and never reset between
  // tests), so any spec that issues several registrations would hit 429. Tests
  // that specifically exercise the limit opt in with { enableThrottle: true }.
  if (!options.enableThrottle) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
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
      referralSource: ReferralSource.None,
      tags: [defaultTag],
    }),
  );

  const adminUser = await userRepo.save(
    userRepo.create({
      email: 'admin@example.com',
      password: 'pass',
      name: 'Test Admin',
      admin: true,
      referralSource: ReferralSource.None,
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

function snapshotService(dataSource: DataSource): FormSnapshotService {
  return new FormSnapshotService(dataSource.getRepository(FormSnapshot));
}

export async function createFormSnapshot(
  dataSource: DataSource,
  schema: Record<string, unknown> | FormSchema,
): Promise<FormSnapshot> {
  return snapshotService(dataSource).findOrCreate(
    schema as Record<string, unknown>,
  );
}

export async function attachFormSnapshot(
  dataSource: DataSource,
  formId: number,
  formSnapshotId: number,
): Promise<void> {
  await snapshotService(dataSource).recordHistorical(formId, formSnapshotId);
}

export async function createFormWithSnapshot(
  dataSource: DataSource,
  data: {
    title: string;
    schema: Record<string, unknown> | FormSchema;
  },
): Promise<{ form: Form; snapshot: FormSnapshot }> {
  const snapshot = await createFormSnapshot(dataSource, data.schema);
  const formRepo = dataSource.getRepository(Form);
  const form = await formRepo.save(
    formRepo.create({ title: data.title, formSnapshotId: snapshot.id }),
  );
  await attachFormSnapshot(dataSource, form.id, snapshot.id);
  return { form, snapshot };
}

/**
 * Give a fixture user an active contract. Anyone added to a group through
 * `addUsersToCommunityAndRefreshConversation` needs one — fixtures built by
 * saving a bare `User` have no contract events at all.
 */
export async function giveActiveContract(
  ctx: Pick<TestContext, 'dataSource' | 'defaultContractId'>,
  userId: number,
): Promise<void> {
  await ctx.dataSource.getRepository(ContractEvent).save({
    user: { id: userId },
    type: ContractEventType.SIGNED,
    date: new Date(),
    contract: { id: ctx.defaultContractId },
  });
}

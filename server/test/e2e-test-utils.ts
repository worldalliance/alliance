import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { ActionEvent } from '../src/actions/entities/action-event.entity';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  userRepo: Repository<User>;
  actionRepo: Repository<Action>;
  actionEventRepo: Repository<ActionEvent>;
  userActionRepo: Repository<UserAction>;
  imageRepo: Repository<Image>;
  postRepo: Repository<Post>;
  replyRepo: Repository<Reply>;
  accessToken: string;
  adminAccessToken: string;
  jwtService: JwtService;
  testUserId: number;
}

export async function createTestApp(
  modules: Type<unknown>[],
): Promise<TestContext> {
  // Increase Jest timeout
  jest.setTimeout(30000);

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
        entities: [
          User,
          Action,
          ActionEvent,
          UserAction,
          Image,
          Communique,
          Post,
          Reply,
        ],
        synchronize: true,
        dropSchema: true,
      }),
      // Register all entities in a single forFeature call
      // TypeOrmModule.forFeature([
      //   User,
      //   Action,
      //   ActionEvent,
      //   UserAction,
      //   Image,
      //   Communique,
      //   Post,
      //   Reply
      // ]),
      // AuthModule,
      // ActionsModule,
      // UserModule,
      // ...modules,
      AuthModule,
      ActionsModule,
      UserModule,
      ...modules,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Configure global pipes
  app.useGlobalPipes(new ValidationPipe());

  await app.init();

  const dataSource = moduleFixture.get(DataSource);

  // Initialize database
  await dataSource.synchronize(true);

  // Get repositories
  const userRepo = dataSource.getRepository(User);
  const actionRepo = dataSource.getRepository(Action);
  const actionEventRepo = dataSource.getRepository(ActionEvent);
  const userActionRepo = dataSource.getRepository(UserAction);
  const imageRepo = dataSource.getRepository(Image);
  const postRepo = dataSource.getRepository(Post);
  const replyRepo = dataSource.getRepository(Reply);
  const jwtService = moduleFixture.get<JwtService>(JwtService);

  // Clean database before tests
  await Promise.all([
    actionEventRepo.clear(),
    userActionRepo.clear(),
    actionRepo.clear(),
    replyRepo.clear(),
    postRepo.clear(),
    imageRepo.clear(),
    userRepo.clear(),
  ]);

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

  return {
    app,
    dataSource,
    userRepo,
    actionRepo,
    actionEventRepo,
    userActionRepo,
    imageRepo,
    postRepo,
    replyRepo,
    accessToken,
    adminAccessToken,
    jwtService,
    testUserId: user.id,
  };
}

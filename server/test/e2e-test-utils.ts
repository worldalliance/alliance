// test-utils.ts
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
import { Friend } from '../src/user/friend.entity';
export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  userRepo: Repository<User>;
  friendRepo: Repository<Friend>;
  actionRepo: Repository<Action>;
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
          UserAction,
          Image,
          Communique,
          Post,
          Reply,
          Friend,
        ],
        synchronize: true,
      }),
      AuthModule,
      ActionsModule,
      UserModule,
      ...modules,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  const dataSource = moduleFixture.get(DataSource);
  const userRepo = dataSource.getRepository(User);
  const actionRepo = dataSource.getRepository(Action);
  const userActionRepo = dataSource.getRepository(UserAction);
  const imageRepo = dataSource.getRepository(Image);
  const postRepo = dataSource.getRepository(Post);
  const replyRepo = dataSource.getRepository(Reply);
  const friendRepo = dataSource.getRepository(Friend);
  const jwtService = moduleFixture.get<JwtService>(JwtService);

  // Create test user
  const user = userRepo.create({
    email: 'user@example.com',
    password: 'pass',
    name: 'User',
  });

  await userRepo.save(user);

  const adminUser = userRepo.create({
    email: 'admin@example.com',
    password: 'pass',
    name: 'Admin',
    admin: true,
  });

  await userRepo.save(adminUser);

  // Create auth token
  const accessToken = jwtService.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    {
      secret: process.env.JWT_SECRET,
    },
  );

  const adminAccessToken = jwtService.sign(
    {
      sub: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
    },
    {
      secret: process.env.JWT_SECRET,
    },
  );

  return {
    app,
    dataSource,
    userRepo,
    friendRepo,
    actionRepo,
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

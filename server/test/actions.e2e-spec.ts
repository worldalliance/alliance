import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/user/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { UserAction } from '../src/actions/entities/user-action.entity';
import { Action, ActionStatus } from '../src/actions/entities/action.entity';
import { Image } from '../src/images/entities/image.entity';
import { Communique } from '../src/communiques/entities/communique.entity';
import { Post } from '../src/forum/entities/post.entity';
import { Reply } from '../src/forum/entities/reply.entity';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { ActionsModule } from '../src/actions/actions.module';
import { CreateActionDto } from 'src/actions/dto/action.dto';

describe('Forum (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let actionRepository: Repository<Action>;
  let userActionRepository: Repository<UserAction>;
  let jwtService: JwtService;
  let accessToken: string;
  let adminAccessToken: string;
  let testAction: Action;
  let testDraftAction: Action;
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forFeature([User, Action, UserAction, Post, Reply]),
        ActionsModule,
        AuthModule,
        JwtModule,
        UserModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Action, UserAction, Image, Communique, Post, Reply],
          synchronize: true,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    const dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
    actionRepository = dataSource.getRepository(Action);
    userActionRepository = dataSource.getRepository(UserAction);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test user
    const user = userRepository.create({
      email: 'user@example.com',
      password: 'pass',
      name: 'User',
    });

    await userRepository.save(user);

    const adminUser = userRepository.create({
      email: 'admin@example.com',
      password: 'pass',
      name: 'Admin',
      admin: true,
    });

    await userRepository.save(adminUser);

    // Create auth token
    accessToken = jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      {
        secret: process.env.JWT_SECRET,
      },
    );

    adminAccessToken = jwtService.sign(
      {
        sub: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
      },
      {
        secret: process.env.JWT_SECRET,
      },
    );

    await actionRepository.query('DELETE FROM action');

    // Create test action
    testAction = actionRepository.create({
      name: 'Test Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Active,
    });

    testDraftAction = actionRepository.create({
      name: 'Test Draft Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Draft,
    });

    await actionRepository.save(testAction);
    await actionRepository.save(testDraftAction);
  });

  describe('Actions', () => {
    it('admin can create a valid action', async () => {
      const newAction: CreateActionDto = {
        name: 'Test Action',
        description: 'Do something important',
        status: ActionStatus.Active,
        category: '',
        whyJoin: '',
        image: '',
        userRelations: [],
      };

      const res = await request(app.getHttpServer())
        .post('/actions/create')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(newAction);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Action');

      await actionRepository.query('DELETE FROM action WHERE id = ?', [
        res.body.id,
      ]);
    });
    it('action creation with missing data rejected', async () => {
      const res = await request(app.getHttpServer())
        .post('/actions/create')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Test Action',
          description: 'Do something important',
        });

      expect(res.status).toBe(400);
    });

    it('user can join an action', async () => {
      const action = await actionRepository.findOneBy({ name: 'Test Action' });

      const res = await request(app.getHttpServer())
        .post(`/actions/join/${action!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(201);
    });

    it('user can join an action', async () => {
      const action = await actionRepository.findOneBy({ name: 'Test Action' });

      const res = await request(app.getHttpServer())
        .post(`/actions/join/${action!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(201);
    });

    it('can fetch all actions with status', async () => {
      const res = await request(app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('status');
    });

    it('user cannot see draft actions', async () => {
      const res = await request(app.getHttpServer())
        .get('/actions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it('admin can see draft actions', async () => {
      const res = await request(app.getHttpServer())
        .get('/actions/all')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[1].status).toBe(ActionStatus.Draft);
    });
  });

  afterAll(async () => {
    await userActionRepository.query('DELETE FROM user_action');
    await actionRepository.query('DELETE FROM action');
    await userRepository.query('DELETE FROM user');
    await app.close();
  });
});

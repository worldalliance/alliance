import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
import { ForumModule } from '../src/forum/forum.module';
import { Post } from '../src/forum/entities/post.entity';
import { Reply } from '../src/forum/entities/reply.entity';
import { AuthModule } from '../src/auth/auth.module';
import { UserModule } from '../src/user/user.module';
import { CreatePostDto } from '../src/forum/dto/post.dto';

describe('Forum (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let postRepository: Repository<Post>;
  let replyRepository: Repository<Reply>;
  let actionRepository: Repository<Action>;
  let jwtService: JwtService;
  let accessToken: string;
  let userId: number;
  let testAction: Action;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forFeature([User, Action, UserAction, Post, Reply]),
        ForumModule,
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
    await app.init();

    const dataSource = moduleFixture.get<DataSource>(DataSource);
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);
    replyRepository = dataSource.getRepository(Reply);
    actionRepository = dataSource.getRepository(Action);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test user
    const user = userRepository.create({
      email: 'forumtest@test.com',
      password: 'password',
      name: 'Forum Test User',
    });

    await userRepository.save(user);
    userId = user.id;

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

    // Create test action
    testAction = actionRepository.create({
      name: 'Test Action',
      category: 'Test',
      whyJoin: 'For testing',
      description: 'Test action for forum tests',
      status: ActionStatus.Active,
    });
    await actionRepository.save(testAction);
  });

  describe('Posts', () => {
    it('should create a post', async () => {
      const response = await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post',
        })
        .expect(201);

      expect(response.body.title).toBe('Test Post');
      expect(response.body.content).toBe('This is a test post');
      expect(response.body.authorId).toBe(userId);
    });

    it('should create a post with action association', async () => {
      const response = await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Action Post',
          content: 'This is a test post for an action',
          actionId: testAction.id,
        })
        .expect(201);

      expect(response.body.title).toBe('Test Action Post');
      expect(response.body.actionId).toBe(testAction.id);
    });

    const addTestPost = async () => {
      await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post',
        })
        .expect(201);
    };

    it('should get all posts', async () => {
      await addTestPost();
      await addTestPost();

      const response = await request(app.getHttpServer())
        .get('/forum/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get posts by action', async () => {
      await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post',
          actionId: testAction.id,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/forum/posts/action/${testAction.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].actionId).toBe(testAction.id);
    });

    it('should get a post by id', async () => {
      await addTestPost();

      const postsResponse = await request(app.getHttpServer())
        .get('/forum/posts')
        .expect(200);

      expect(postsResponse.body.length).toBeGreaterThanOrEqual(1);

      const postId = postsResponse.body[0].id;

      // Then get specific post
      const response = await request(app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBeDefined();
      expect(response.body.content).toBeDefined();
      expect(response.body.replies).toBeDefined();
    });

    it('should update a post', async () => {
      // Create a post to update
      const createResponse = await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Post to Update',
          content: 'This post will be updated',
        })
        .expect(201);

      const postId = createResponse.body.id;

      // Update the post
      const response = await request(app.getHttpServer())
        .patch(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated Post',
          content: 'This post has been updated',
        })
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBe('Updated Post');
      expect(response.body.content).toBe('This post has been updated');
    });

    it('should delete a post', async () => {
      // Create a post to delete
      const createResponse = await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Post to Delete',
          content: 'This post will be deleted',
        })
        .expect(201);

      const postId = createResponse.body.id;

      // Delete the post
      await request(app.getHttpServer())
        .delete(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify the post is deleted
      await request(app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .expect(404);
    });
  });

  describe('Replies', () => {
    let testPostId: number;

    beforeEach(async () => {
      const testPost: CreatePostDto = {
        title: 'Test Post for Replies',
        content: 'This post will have replies',
        actionId: testAction.id,
      };

      // Create a post for reply tests
      const createResponse = await request(app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testPost)
        .expect(201);

      testPostId = createResponse.body.id;
    });

    it('should create a reply', async () => {
      const response = await request(app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'This is a test reply',
          postId: testPostId,
        })
        .expect(201);

      expect(response.body.content).toBe('This is a test reply');
      expect(response.body.postId).toBe(testPostId);
      expect(response.body.authorId).toBe(userId);
    });

    it('should update a reply', async () => {
      // Create a reply to update
      const createResponse = await request(app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Reply to update',
          postId: testPostId,
        })
        .expect(201);

      const replyId = createResponse.body.id;

      // Update the reply
      const response = await request(app.getHttpServer())
        .patch(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Updated reply',
        })
        .expect(200);

      expect(response.body.id).toBe(replyId);
      expect(response.body.content).toBe('Updated reply');
    });

    it('should delete a reply', async () => {
      // Create a reply to delete
      const createResponse = await request(app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Reply to delete',
          postId: testPostId,
        })
        .expect(201);

      const replyId = createResponse.body.id;

      // Delete the reply
      await request(app.getHttpServer())
        .delete(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify reply is deleted by trying to update it (should fail)
      await request(app.getHttpServer())
        .patch(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'This should fail',
        })
        .expect(404);
    });

    it("should not allow updating another user's reply", async () => {
      // Create a second user
      const anotherUser = userRepository.create({
        email: 'anotheruser@test.com',
        password: 'password',
        name: 'Another Test User',
      });
      await userRepository.save(anotherUser);

      // Create token for another user
      const anotherToken = jwtService.sign(
        {
          sub: anotherUser.id,
          email: anotherUser.email,
          name: anotherUser.name,
        },
        {
          secret: process.env.JWT_SECRET,
        },
      );

      // Create a reply as the first user
      const createResponse = await request(app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Original user reply',
          postId: testPostId,
        })
        .expect(201);

      const replyId = createResponse.body.id;

      // Try to update the reply as another user
      await request(app.getHttpServer())
        .patch(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({
          content: 'This should fail',
        })
        .expect(404);
    });
  });

  afterEach(async () => {
    await replyRepository.query('DELETE FROM reply');
    await postRepository.query('DELETE FROM post');
  });

  afterAll(async () => {
    await replyRepository.query('DELETE FROM reply');
    await postRepository.query('DELETE FROM post');
    await actionRepository.query('DELETE FROM action');
    await userRepository.query('DELETE FROM user');
    await app.close();
  });
});

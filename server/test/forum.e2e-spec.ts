import * as request from 'supertest';
import { Action, ActionStatus } from '../src/actions/entities/action.entity';
import { CreatePostDto } from '../src/forum/dto/post.dto';
import { createTestApp, TestContext } from './e2e-test-utils';
import { ForumModule } from '../src/forum/forum.module';
import { Repository } from 'typeorm';
import { User } from 'src/user/user.entity';

describe('Forum (e2e)', () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let testAction: Action;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await createTestApp([ForumModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    userRepo = ctx.dataSource.getRepository(User);
    // Create test action
    testAction = actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      body: 'Test action for forum tests',
      status: ActionStatus.GatheringCommitments,
    });
    await actionRepo.save(testAction);
  }, 50000);

  describe('Posts', () => {
    it('should create a post', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post',
        })
        .expect(201);

      expect(response.body.title).toBe('Test Post');
      expect(response.body.content).toBe('This is a test post');
      expect(response.body.authorId).toBe(ctx.testUserId);
    });

    it('should create a post with action association', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
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
      await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post',
        })
        .expect(201);
    };

    it('should get all posts', async () => {
      await addTestPost();
      await addTestPost();

      const response = await request(ctx.app.getHttpServer())
        .get('/forum/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get posts by action', async () => {
      await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Test Post',
          content: 'This is a test post',
          actionId: testAction.id,
        })
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/action/${testAction.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].actionId).toBe(testAction.id);
    });

    it('should get a post by id', async () => {
      await addTestPost();

      const postsResponse = await request(ctx.app.getHttpServer())
        .get('/forum/posts')
        .expect(200);

      expect(postsResponse.body.length).toBeGreaterThanOrEqual(1);

      const postId = postsResponse.body[0].id;

      // Then get specific post
      const response = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBeDefined();
      expect(response.body.content).toBeDefined();
      expect(response.body.replies).toBeDefined();
    });

    it('should update a post', async () => {
      // Create a post to update
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Post to Update',
          content: 'This post will be updated',
        })
        .expect(201);

      const postId = createResponse.body.id;

      // Update the post
      const response = await request(ctx.app.getHttpServer())
        .patch(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
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
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Post to Delete',
          content: 'This post will be deleted',
        })
        .expect(201);

      const postId = createResponse.body.id;

      // Delete the post
      await request(ctx.app.getHttpServer())
        .delete(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      // Verify the post is deleted
      await request(ctx.app.getHttpServer())
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
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send(testPost)
        .expect(201);

      testPostId = createResponse.body.id;
    });

    it('should create a reply', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'This is a test reply',
          postId: testPostId,
        })
        .expect(201);

      expect(response.body.content).toBe('This is a test reply');
      expect(response.body.postId).toBe(testPostId);
      expect(response.body.authorId).toBe(ctx.testUserId);
    });

    it('should update a reply', async () => {
      // Create a reply to update
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'Reply to update',
          postId: testPostId,
        })
        .expect(201);

      const replyId = createResponse.body.id;

      // Update the reply
      const response = await request(ctx.app.getHttpServer())
        .patch(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'Updated reply',
        })
        .expect(200);

      expect(response.body.id).toBe(replyId);
      expect(response.body.content).toBe('Updated reply');
    });

    it('should delete a reply', async () => {
      // Create a reply to delete
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'Reply to delete',
          postId: testPostId,
        })
        .expect(201);

      const replyId = createResponse.body.id;

      // Delete the reply
      await request(ctx.app.getHttpServer())
        .delete(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      // Verify reply is deleted by trying to update it (should fail)
      await request(ctx.app.getHttpServer())
        .patch(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'This should fail',
        })
        .expect(404);
    });

    it("should not allow updating another user's reply", async () => {
      // Create a second user
      const anotherUser = userRepo.create({
        email: 'anotheruser@test.com',
        password: 'password',
        name: 'Another Test User',
      });
      await userRepo.save(anotherUser);

      // Create token for another user
      const anotherToken = ctx.jwtService.sign(
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
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/replies')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'Original user reply',
          postId: testPostId,
        })
        .expect(201);

      const replyId = createResponse.body.id;

      // Try to update the reply as another user
      await request(ctx.app.getHttpServer())
        .patch(`/forum/replies/${replyId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({
          content: 'This should fail',
        })
        .expect(404);
    });
  });
});

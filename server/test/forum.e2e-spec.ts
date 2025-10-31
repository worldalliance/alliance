import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { CreateCommentDto, UpdateCommentDto } from 'src/forum/dto/comment.dto';
import { CommentParentObject } from 'src/forum/entities/comment.entity';
import { User } from 'src/user/entities/user.entity';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { Action } from '../src/actions/entities/action.entity';
import { CreatePostDto } from '../src/forum/dto/post.dto';
import { ForumModule } from '../src/forum/forum.module';
import { createTestApp, TestContext } from './e2e-test-utils';
import { NotificationCategory } from 'src/notifs/entities/notification.entity';
import { Notification } from 'src/notifs/entities/notification.entity';

describe('Forum (e2e)', () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let testAction: Action;
  let userRepo: Repository<User>;
  let notifRepo: Repository<Notification>;
  let eventRepo: Repository<ActionEvent>;

  beforeAll(async () => {
    ctx = await createTestApp([ForumModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    userRepo = ctx.dataSource.getRepository(User);
    notifRepo = ctx.dataSource.getRepository(Notification);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    // Create test action
    testAction = actionRepo.create({
      name: 'Test Action',
      category: 'Test',
      body: 'Test action for forum tests',
      status: ActionStatus.GatheringCommitments,
      participatingGroups: [ctx.defaultGroup],
    });
    await actionRepo.save(testAction);

    const event = eventRepo.create({
      title: 'Action Started',
      description: 'Action is now in gathering commitments phase',
      newStatus: ActionStatus.GatheringCommitments,
      date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      showInTimeline: true,
      action: testAction,
    });
    await eventRepo.save(event);
  }, 50000);

  describe('Posts', () => {
    it('should create a post', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Test Post',
          editableContent: {
            body: 'This is a test post',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      expect(response.body.title).toBe('Test Post');
      expect(response.body.editableContent.body).toBe('This is a test post');
      expect(response.body.authorId).toBe(ctx.testUserId);
    });

    it('should create a post with action association', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Test Action Post',
          editableContent: {
            body: 'This is a test post for an action',
            attachments: [],
          },
          actionId: testAction.id,
          visibleAt: new Date(),
        } satisfies CreatePostDto)
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
          editableContent: {
            body: 'This is a test post',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);
    };

    it('should get all posts', async () => {
      await addTestPost();
      await addTestPost();

      const response = await request(ctx.app.getHttpServer())
        .get('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
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
          editableContent: {
            body: 'This is a test post',
            attachments: [],
          },
          actionId: testAction.id,
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/action/${testAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].actionId).toBe(testAction.id);
    });

    it('should get a post by id', async () => {
      await addTestPost();

      const postsResponse = await request(ctx.app.getHttpServer())
        .get('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(postsResponse.body.length).toBeGreaterThanOrEqual(1);

      const postId = postsResponse.body[0].id;

      // Then get specific post
      const response = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBeDefined();
      expect(response.body.editableContent).toBeDefined();
      expect(response.body.commentCount).toBeDefined();
    });

    it('should hide future-scheduled posts created by other users', async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: 'Future Post From Another User',
          editableContent: {
            body: 'Scheduled in the future',
            attachments: [],
          },
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);

      const postsResponse = await request(ctx.app.getHttpServer())
        .get('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const visiblePost = postsResponse.body.find(
        (post) => post.id === createResponse.body.id,
      );
      expect(visiblePost).toBeUndefined();

      await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(404);
    });

    it('should allow authors to see their own future-scheduled posts', async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Future Post From Author',
          editableContent: {
            body: 'Author scheduled in the future',
            attachments: [],
          },
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);

      const postsResponse = await request(ctx.app.getHttpServer())
        .get('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const futurePost = postsResponse.body.find(
        (post) => post.id === createResponse.body.id,
      );

      expect(futurePost).toBeDefined();
      expect(futurePost.title).toBe('Future Post From Author');

      await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);
    });

    it('should update a post', async () => {
      // Create a post to update
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Post to Update',
          editableContent: {
            body: 'This post will be updated',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = createResponse.body.id;

      // Update the post
      const response = await request(ctx.app.getHttpServer())
        .patch(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Updated Post',
          editableContent: {
            body: 'This post has been updated',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBe('Updated Post');
      expect(response.body.editableContent.body).toBe(
        'This post has been updated',
      );
    });

    it('should delete a post', async () => {
      // Create a post to delete
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Post to Delete',
          editableContent: {
            body: 'This post will be deleted',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
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
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(404);
    });
  });

  describe('Replies', () => {
    let testPostId: number;

    beforeEach(async () => {
      const testPost: CreatePostDto = {
        title: 'Test Post for Replies',
        editableContent: {
          body: 'This post will have replies',
          attachments: [],
        },
        actionId: testAction.id,
        visibleAt: new Date(),
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
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'This is a test reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body.editableContent.body).toBe('This is a test reply');
      expect(response.body.parentObjectId).toBe(testPostId);
      expect(response.body.authorId).toBe(ctx.testUserId);
    });

    it('should update a reply', async () => {
      // Create a reply to update
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Reply to update',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const replyId = createResponse.body.id;

      // Update the reply
      const response = await request(ctx.app.getHttpServer())
        .patch(`/forum/comments/${replyId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Updated reply',
            attachments: [],
          },
        } satisfies UpdateCommentDto)
        .expect(200);

      expect(response.body.id).toBe(replyId);
      expect(response.body.editableContent.body).toBe('Updated reply');
    });

    it('should delete a reply', async () => {
      // Create a reply to delete
      const createResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Reply to delete',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const replyId = createResponse.body.id;

      // Delete the reply
      await request(ctx.app.getHttpServer())
        .delete(`/forum/comments/${replyId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      // Verify reply is deleted by trying to update it (should fail)
      const reply = await request(ctx.app.getHttpServer())
        .patch(`/forum/comments/${replyId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          content: 'This should fail',
        });

      expect(reply.body.deleted).toBe(true);
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
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Original user reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const replyId = createResponse.body.id;

      // Try to update the reply as another user
      await request(ctx.app.getHttpServer())
        .patch(`/forum/comments/${replyId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({
          content: 'This should fail',
        })
        .expect(404);
    });

    it('should create a nested reply', async () => {
      // Create a parent reply
      const parentResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'This is a parent reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const parentReplyId = parentResponse.body.id;

      // Create a nested reply
      const childResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'This is a nested reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentReplyId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(childResponse.body.editableContent.body).toBe(
        'This is a nested reply',
      );
      expect(childResponse.body.parentObjectId).toBe(testPostId);
      expect(childResponse.body.parentId).toBe(parentReplyId);
      expect(childResponse.body.authorId).toBe(ctx.testUserId);
    });

    it('should organize replies hierarchically when fetching post', async () => {
      // Create parent reply
      const parentResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Parent reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const parentReplyId = parentResponse.body.id;

      // Create child replies
      const child1Response = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'First child reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentReplyId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const child2Response = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Second child reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentReplyId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      // Create another top-level reply
      await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Another top-level reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const postResponse = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${testPostId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(postResponse.body.commentCount).toBeDefined();
      expect(postResponse.body.commentCount).toBeGreaterThan(0);

      const commentsResponse = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${testPostId}/comments`)
        .expect(200);

      const topLevelReplies = commentsResponse.body;

      // Find the parent reply
      const parentReply = topLevelReplies.find(
        (reply) => reply.id === parentReplyId,
      );
      expect(parentReply).toBeDefined();
      expect(parentReply.editableContent.body).toBe('Parent reply');
      expect(parentReply.children).toBeDefined();
      expect(Array.isArray(parentReply.children)).toBe(true);
      expect(parentReply.children.length).toBe(2);

      // Check child replies are properly nested
      const childIds = parentReply.children.map((child) => child.id);
      expect(childIds).toContain(child1Response.body.id);
      expect(childIds).toContain(child2Response.body.id);

      // Check that children have correct parentId
      parentReply.children.forEach((child) => {
        expect(child.parentId).toBe(parentReplyId);
      });
    });

    it('notifies post comment parent authors when they receive a reply', async () => {
      const parentResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Parent action comment',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const childResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          editableContent: {
            body: 'Child post reply',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentResponse.body.id,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifications = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.ForumReply,
        },
        relations: ['associatedUser', 'user'],
      });

      expect(
        notifications.some(
          (notif) =>
            notif.webAppLocation ===
              `/forum/post/${testPostId}?replyId=${childResponse.body.id}` &&
            notif.associatedUser?.id === ctx.adminUserId,
        ),
      ).toBe(true);
    });

    it('notifies action comment parent authors when they receive a reply', async () => {
      const parentResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Parent action comment',
            attachments: [],
          },
          parentObjectId: testAction.id,
          parentObjectType: CommentParentObject.Action,
        } satisfies CreateCommentDto)
        .expect(201);

      const childResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          editableContent: {
            body: 'Child action reply',
            attachments: [],
          },
          parentObjectId: testAction.id,
          parentId: parentResponse.body.id,
          parentObjectType: CommentParentObject.Action,
        } satisfies CreateCommentDto)
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifications = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.ForumReply,
        },
        relations: ['associatedUser', 'user'],
      });

      expect(
        notifications.some(
          (notif) =>
            notif.webAppLocation ===
              `/actions/${testAction.id}?replyId=${childResponse.body.id}` &&
            notif.associatedUser?.id === ctx.adminUserId,
        ),
      ).toBe(true);
    });

    it('does not notify parent author when they reply to their own post', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Reply to own post', attachments: [] },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const replyId = response.body.id;

      const allNotifs = await notifRepo
        .find({})
        .then((notifs) => notifs.map((notif) => notif.webAppLocation));

      expect(
        allNotifs.some((notif) => notif.includes(`replyId=${replyId}`)),
      ).toBe(false);
    });

    it('should fail to create nested reply with invalid parentId', async () => {
      await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'This should fail',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: 99999, // Non-existent parent
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(404);
    });

    it('should fail to create nested reply with parentId from different post', async () => {
      // Create another post
      const anotherPostResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Another Test Post',
          editableContent: {
            body: 'This is another test post',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const anotherPostId = anotherPostResponse.body.id;

      // Create a reply on the other post
      const otherPostReplyResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'Reply on other post',
            attachments: [],
          },
          parentObjectId: anotherPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const otherPostReplyId = otherPostReplyResponse.body.id;

      // Try to create a nested reply using parentId from different post
      await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: 'This should fail',
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: otherPostReplyId, // Parent from different post
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(404);
    });
  });

  describe('Additional endpoints', () => {
    it('returns the last comment for a post', async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Post With Last Comment',
          editableContent: {
            body: 'Initial body',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'First', attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const secondComment = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Second', attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const lastCommentResponse = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(lastCommentResponse.body.lastComment?.id).toBe(
        secondComment.body.id,
      );
      expect(lastCommentResponse.body.lastComment?.parentObjectId).toBe(postId);
    });

    it('lists posts and comments authored by a user', async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'User Authored Post',
          editableContent: {
            body: 'Body content',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const commentResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'User comment', attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const postsByUser = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}`)
        .expect(200);

      expect(postsByUser.body.some((post) => post.id === postId)).toBe(true);

      const commentsByUser = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}/comments`)
        .expect(200);

      expect(
        commentsByUser.body.some(
          (comment) => comment.id === commentResponse.body.id,
        ),
      ).toBe(true);

      const forumComments = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}/forumComments`)
        .expect(200);

      expect(
        forumComments.body.some(
          (comment) => comment.id === commentResponse.body.id,
        ),
      ).toBe(true);
    });

    it('provides activity and action level comment listings', async () => {
      const actionJoin = await request(ctx.app.getHttpServer())
        .post(`/actions/join/${testAction.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = actionJoin.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/actions/addActivityComment/${activityId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Activity comment', attachments: [] },
          parentObjectId: activityId,
          parentObjectType: CommentParentObject.Activity,
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Action level comment', attachments: [] },
          parentObjectId: testAction.id,
          parentObjectType: CommentParentObject.Action,
        } satisfies CreateCommentDto)
        .expect(201);

      const activityComments = await request(ctx.app.getHttpServer())
        .get(`/forum/activity/${activityId}/comments`)
        .expect(200);

      expect(activityComments.body.length).toBeGreaterThan(0);

      const actionComments = await request(ctx.app.getHttpServer())
        .get(`/forum/actions/${testAction.id}/comments`)
        .expect(200);

      expect(actionComments.body.length).toBeGreaterThan(0);
    });

    it('supports liking and unliking posts and comments', async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post('/forum/posts')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          title: 'Post To Like',
          editableContent: {
            body: 'Body',
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const commentResponse = await request(ctx.app.getHttpServer())
        .post('/forum/comments')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: 'Likeable comment', attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/unlike`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentResponse.body.id}/like`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentResponse.body.id}/unlike`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(201);
    });
  });
});

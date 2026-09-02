import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { CreateCommentDto, UpdateCommentDto } from "src/forum/dto/comment.dto";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import { In, type Repository } from "typeorm";
import { Action } from "../src/actions/entities/action.entity";
import {
  CreatePostDto,
  UpdatePostDto,
  UpdatePostSettingsDto,
} from "../src/forum/dto/post.dto";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Forum (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let testAction: Action;
  let userRepo: Repository<User>;
  let notifRepo: Repository<Notification>;
  let unreadContentRepo: Repository<UnreadContent>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let likerCounter = 0;

  const createExtraUserAndToken = async () => {
    likerCounter += 1;
    const extraUser = userRepo.create({
      email: `liker${likerCounter}@example.com`,
      password: "pass",
      name: `Extra Liker ${likerCounter}`,
      tags: [ctx.defaultTag],
    });
    await userRepo.save(extraUser);
    const token = ctx.jwtService.sign(
      {
        sub: extraUser.id,
        email: extraUser.email,
        name: extraUser.name,
      },
      {
        secret: process.env.JWT_SECRET,
      },
    );
    return { user: extraUser, token };
  };

  const saveSettings = (
    postId: number,
    settings: Partial<UpdatePostSettingsDto>,
  ) =>
    request(ctx.app.getHttpServer())
      .patch(`/forum/admin/posts/${postId}/settings`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        expertIds: [],
        authorIds: [],
        qaMode: false,
        ...settings,
      } satisfies UpdatePostSettingsDto);

  /** A backend waiting on a lock has finished every read it made before
   * reaching it, so this is the signal that a save sits on a stale snapshot. */
  const waitForBlockedBackends = async (
    count: number,
    orSettled: () => boolean = () => false,
  ) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (orSettled()) return;
      const [{ blocked }] = await ctx.dataSource.query<[{ blocked: number }]>(
        `select count(*)::int as blocked from pg_stat_activity
         where datname = current_database() and wait_event_type = 'Lock'`,
      );
      if (blocked >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`fewer than ${count} backends ever blocked`);
  };

  /** Holds `lock` in an open transaction while `body` runs, then commits. The
   * commit sits in a finally, so a body that throws still frees the lock
   * instead of parking every later test on it. Requests left in flight come
   * back in a tuple: returned bare, the async body awaits one, and what it is
   * waiting on is this lock. */
  const withLockHeld = async <T>(
    lock: { query: string; params?: unknown[] },
    body: () => Promise<T>,
  ): Promise<T> => {
    const gate = ctx.dataSource.createQueryRunner();
    await gate.connect();
    await gate.startTransaction();
    try {
      await gate.query(lock.query, lock.params);
      return await body();
    } finally {
      await gate.commitTransaction();
      await gate.release();
    }
  };

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    userRepo = ctx.dataSource.getRepository(User);
    notifRepo = ctx.dataSource.getRepository(Notification);
    unreadContentRepo = ctx.dataSource.getRepository(UnreadContent);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    // Create test action
    testAction = actionRepo.create({
      name: "Test Action",
      category: "Test",
      body: "Test action for forum tests",
      status: ActionStatus.MemberAction,
      cohortExpression: {
        type: "Tag",
        tagId: ctx.defaultTag.id,
      },
    });
    await actionRepo.save(testAction);

    const event = eventRepo.create({
      title: "Action Started",
      description: "Action is now in member action phase",
      newStatus: ActionStatus.MemberAction,
      date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      action: testAction,
    });
    await eventRepo.save(event);
  }, 50000);

  describe("Posts", () => {
    it("should create a post", async () => {
      const response = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Test Post",
          editableContent: {
            body: "This is a test post",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      expect(response.body.title).toBe("Test Post");
      expect(response.body.editableContent.body).toBe("This is a test post");
      expect(response.body.authorId).toBe(ctx.testUserId);
    });

    it("should create a post with action association", async () => {
      const response = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Test Action Post",
          editableContent: {
            body: "This is a test post for an action",
            attachments: [],
          },
          actionId: testAction.id,
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      expect(response.body.title).toBe("Test Action Post");
      expect(response.body.actionId).toBe(testAction.id);
    });

    const addTestPost = async () => {
      await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Test Post",
          editableContent: {
            body: "This is a test post",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);
    };

    it("should get all posts", async () => {
      await addTestPost();
      await addTestPost();

      const response = await request(ctx.app.getHttpServer())
        .get("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it("should get posts by action", async () => {
      await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Test Post",
          editableContent: {
            body: "This is a test post",
            attachments: [],
          },
          actionId: testAction.id,
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/action/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].actionId).toBe(testAction.id);
    });

    it("should show authors their own scheduled posts on an action", async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60);
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Future Action Post",
          editableContent: {
            body: "Scheduled in the future",
            attachments: [],
          },
          actionId: testAction.id,
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);
      const postId = createResponse.body.id;

      const { token: visitorToken } = await createExtraUserAndToken();

      const authorPosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/action/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(authorPosts.body.some((post) => post.id === postId)).toBe(true);

      const visitorPosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/action/${testAction.id}`)
        .set("Authorization", `Bearer ${visitorToken}`)
        .expect(200);
      expect(visitorPosts.body.some((post) => post.id === postId)).toBe(false);
    });

    it("should get a post by id", async () => {
      await addTestPost();

      const postsResponse = await request(ctx.app.getHttpServer())
        .get("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(postsResponse.body.length).toBeGreaterThanOrEqual(1);

      const postId = postsResponse.body[0].id;

      // Then get specific post
      const response = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBeDefined();
      expect(response.body.editableContent).toBeDefined();
    });

    it("should hide future-scheduled posts created by other users", async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Future Post From Another User",
          editableContent: {
            body: "Scheduled in the future",
            attachments: [],
          },
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);

      const postsResponse = await request(ctx.app.getHttpServer())
        .get("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const visiblePost = postsResponse.body.find(
        (post) => post.id === createResponse.body.id,
      );
      expect(visiblePost).toBeUndefined();

      await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${createResponse.body.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(404);
    });

    it("should let admins see future-scheduled posts by other users", async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60);
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Future Post Seen By Admin",
          editableContent: {
            body: "Scheduled in the future",
            attachments: [],
          },
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);

      const postsResponse = await request(ctx.app.getHttpServer())
        .get("/forum/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const futurePost = postsResponse.body.find(
        (post) => post.id === createResponse.body.id,
      );
      expect(futurePost).toBeDefined();

      await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${createResponse.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const profilePosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(
        profilePosts.body.some((post) => post.id === createResponse.body.id),
      ).toBe(true);

      await request(ctx.app.getHttpServer())
        .patch(`/forum/posts/${createResponse.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: "Edited By Admin",
          editableContent: {
            body: "Edited by an admin",
            attachments: [],
          },
        } satisfies UpdatePostDto)
        .expect(404);

      await request(ctx.app.getHttpServer())
        .delete(`/forum/posts/${createResponse.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(404);
    });

    it("should hide a member's future-scheduled posts from profile visitors", async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60);
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Future Post On Profile",
          editableContent: {
            body: "Scheduled in the future",
            attachments: [],
          },
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);
      const postId = createResponse.body.id;

      const { token: visitorToken } = await createExtraUserAndToken();

      const visitorPosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${visitorToken}`)
        .expect(200);
      expect(visitorPosts.body.some((post) => post.id === postId)).toBe(false);

      const anonymousPosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}`)
        .expect(200);
      expect(anonymousPosts.body.some((post) => post.id === postId)).toBe(
        false,
      );

      const ownPosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(ownPosts.body.some((post) => post.id === postId)).toBe(true);
    });

    it("should allow authors to see their own future-scheduled posts", async () => {
      const futureVisibleAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Future Post From Author",
          editableContent: {
            body: "Author scheduled in the future",
            attachments: [],
          },
          visibleAt: futureVisibleAt,
        } satisfies CreatePostDto)
        .expect(201);

      const postsResponse = await request(ctx.app.getHttpServer())
        .get("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const futurePost = postsResponse.body.find(
        (post) => post.id === createResponse.body.id,
      );

      expect(futurePost).toBeDefined();
      expect(futurePost.title).toBe("Future Post From Author");

      await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${createResponse.body.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
    });

    it("should update a post", async () => {
      // Create a post to update
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post to Update",
          editableContent: {
            body: "This post will be updated",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = createResponse.body.id;

      // Update the post
      const response = await request(ctx.app.getHttpServer())
        .patch(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Updated Post",
          editableContent: {
            body: "This post has been updated",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(200);

      expect(response.body.id).toBe(postId);
      expect(response.body.title).toBe("Updated Post");
      expect(response.body.editableContent.body).toBe(
        "This post has been updated",
      );
    });

    it("should delete a post", async () => {
      // Create a post to delete
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post to Delete",
          editableContent: {
            body: "This post will be deleted",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = createResponse.body.id;

      // Delete the post
      await request(ctx.app.getHttpServer())
        .delete(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      // Verify the post is deleted
      await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(404);
    });
  });

  describe("Replies", () => {
    let testPostId: number;

    beforeEach(async () => {
      const testPost: CreatePostDto = {
        title: "Test Post for Replies",
        editableContent: {
          body: "This post will have replies",
          attachments: [],
        },
        actionId: testAction.id,
        visibleAt: new Date(),
      };

      // Create a post for reply tests
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send(testPost)
        .expect(201);

      testPostId = createResponse.body.id;
    });

    it("should create a reply", async () => {
      const response = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "This is a test reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(response.body.editableContent.body).toBe("This is a test reply");
      expect(response.body.parentObjectId).toBe(testPostId);
      expect(response.body.author.id).toBe(ctx.testUserId);
    });

    it("should update a reply", async () => {
      // Create a reply to update
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Reply to update",
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
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Updated reply",
            attachments: [],
          },
        } satisfies UpdateCommentDto)
        .expect(200);

      expect(response.body.id).toBe(replyId);
      expect(response.body.editableContent.body).toBe("Updated reply");
    });

    it("should say a missing reply is gone when editing it", async () => {
      const response = await request(ctx.app.getHttpServer())
        .patch("/forum/comments/999999")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Edit of a reply that is not there",
            attachments: [],
          },
        } satisfies UpdateCommentDto)
        .expect(404);

      expect(response.body.message).toBe("That reply is no longer here");
    });

    it("should delete a reply", async () => {
      // Create a reply to delete
      const createResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Reply to delete",
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
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      // Verify reply is deleted by trying to update it (should fail)
      const reply = await request(ctx.app.getHttpServer())
        .patch(`/forum/comments/${replyId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          content: "This should fail",
        });

      expect(reply.body.deleted).toBe(true);
    });

    it("should say a missing reply is gone", async () => {
      const response = await request(ctx.app.getHttpServer())
        .delete("/forum/comments/999999")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(404);

      expect(response.body.message).toBe("That reply is no longer here");
    });

    it("should not allow updating another user's reply", async () => {
      // Create a second user
      const anotherUser = userRepo.create({
        email: "anotheruser@test.com",
        password: "password",
        name: "Another Test User",
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
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Original user reply",
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
        .set("Authorization", `Bearer ${anotherToken}`)
        .send({
          content: "This should fail",
        })
        .expect(404);
    });

    it("should create a nested reply", async () => {
      // Create a parent reply
      const parentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "This is a parent reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const parentReplyId = parentResponse.body.id;

      // Create a nested reply
      const childResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "This is a nested reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentReplyId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      expect(childResponse.body.editableContent.body).toBe(
        "This is a nested reply",
      );
      expect(childResponse.body.parentObjectId).toBe(testPostId);
      expect(childResponse.body.parentId).toBe(parentReplyId);
      expect(childResponse.body.author.id).toBe(ctx.testUserId);
    });

    it("should organize replies hierarchically when fetching post", async () => {
      // Create parent reply
      const parentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Parent reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const parentReplyId = parentResponse.body.id;

      // Create child replies
      const child1Response = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "First child reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentReplyId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const child2Response = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Second child reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: parentReplyId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      // Create another top-level reply
      await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Another top-level reply",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const commentsResponse = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${testPostId}/comments`)
        .expect(200);

      const topLevelReplies = commentsResponse.body;

      // Find the parent reply
      const parentReply = topLevelReplies.find(
        (reply) => reply.id === parentReplyId,
      );
      expect(parentReply).toBeDefined();
      expect(parentReply.editableContent.body).toBe("Parent reply");
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

    it("does not notify parent author when they reply to their own post", async () => {
      const response = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Reply to own post", attachments: [] },
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

    it("should fail to create nested reply with invalid parentId", async () => {
      await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "This should fail",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: 99999, // Non-existent parent
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(404);
    });

    it("should fail to create nested reply with parentId from different post", async () => {
      // Create another post
      const anotherPostResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Another Test Post",
          editableContent: {
            body: "This is another test post",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const anotherPostId = anotherPostResponse.body.id;

      // Create a reply on the other post
      const otherPostReplyResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "Reply on other post",
            attachments: [],
          },
          parentObjectId: anotherPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const otherPostReplyId = otherPostReplyResponse.body.id;

      // Try to create a nested reply using parentId from different post
      await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: {
            body: "This should fail",
            attachments: [],
          },
          parentObjectId: testPostId,
          parentId: otherPostReplyId, // Parent from different post
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(404);
    });

    it("lands both halves of two pins racing each other", async () => {
      const replyResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Pinned From Both Sides", attachments: [] },
          parentObjectId: testPostId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const replyId = replyResponse.body.id;

      const pins = await withLockHeld(
        {
          query: "select id from comment where id = $1 for update",
          params: [replyId],
        },
        async () => {
          const inFlight = [1, 2].map(() =>
            request(ctx.app.getHttpServer())
              .patch(`/forum/admin/comments/${replyId}/pin`)
              .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
              .then((res) => res),
          );
          await waitForBlockedBackends(2);
          return inFlight;
        },
      );

      for (const pin of await Promise.all(pins)) {
        expect(pin.status).toBe(200);
      }

      const [stored] = await ctx.dataSource.query<[{ pinned: boolean }]>(
        `select pinned from comment where id = $1`,
        [replyId],
      );
      expect(stored.pinned).toBe(false);
    });
  });

  describe("Additional endpoints", () => {
    it("lists posts and comments authored by a user", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "User Authored Post",
          editableContent: {
            body: "Body content",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "User comment", attachments: [] },
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

    it("includes liker facepiles on user feed forum comments", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Liked Feed Comment",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Feed facepile comment", attachments: [] },
          parentObjectId: postResponse.body.id,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);
      expect(commentResponse.body.likesCount).toBe(0);

      const commentId = commentResponse.body.id;
      const firstLiker = await createExtraUserAndToken();
      const secondLiker = await createExtraUserAndToken();
      for (const liker of [firstLiker, secondLiker]) {
        await request(ctx.app.getHttpServer())
          .post(`/forum/comments/${commentId}/like`)
          .set("Authorization", `Bearer ${liker.token}`)
          .expect(201);
      }

      const feed = await request(ctx.app.getHttpServer())
        .get(`/actions/userFeed/${ctx.testUserId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const item = feed.body.find(
        (feedItem) => feedItem.forumComment?.comment.id === commentId,
      );
      expect(item).toBeDefined();
      expect(item.forumComment.likesCount).toBe(2);
      const byId = (a: number, b: number) => a - b;
      expect(
        item.forumComment.comment.likes.map((liker) => liker.id).sort(byId),
      ).toEqual([firstLiker.user.id, secondLiker.user.id].sort(byId));
    });

    it("provides activity and action level comment listings", async () => {
      const actionComplete = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = actionComplete.body.id;

      await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Activity comment", attachments: [] },
          parentObjectId: activityId,
          parentObjectType: CommentParentObject.Activity,
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Action level comment", attachments: [] },
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

    it("supports liking and unliking posts and comments", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post To Like",
          editableContent: {
            body: "Body",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Likeable comment", attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/unlike`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentResponse.body.id}/like`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentResponse.body.id}/unlike`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);
    });

    it("keeps a settings write that lands while a like is open", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();
      const { token: likerToken } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Liked Mid-Save",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      // The like reads the expert join rows after the post itself, so holding
      // that table parks it on the post it has already read.
      const [likeInFlight] = await withLockHeld(
        { query: 'lock table "post_experts_user" in access exclusive mode' },
        async () => {
          const inFlight = request(ctx.app.getHttpServer())
            .post(`/forum/posts/${postId}/like`)
            .set("Authorization", `Bearer ${likerToken}`)
            .then((res) => res);
          await waitForBlockedBackends(1);

          await ctx.dataSource.query(
            `update post set "qaMode" = true, "expertLabel" = $2 where id = $1`,
            [postId, "AMA Guest"],
          );
          await ctx.dataSource.query(
            `insert into post_authors_user ("postId", "userId") values ($1, $2)`,
            [postId, coAuthor.id],
          );
          return [inFlight] as const;
        },
      );

      expect((await likeInFlight).status).toBe(201);

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const stored = adminPosts.body.find((p) => p.id === postId);
      expect(stored.qaMode).toBe(true);
      expect(stored.expertLabel).toBe("AMA Guest");
      expect(stored.authorIds).toEqual([coAuthor.id]);

      const likeRows = await ctx.dataSource.query(
        `select "userId" from post_likes_user where "postId" = $1`,
        [postId],
      );
      expect(likeRows).toHaveLength(1);
    });

    it("rejects a like that the same user already landed elsewhere", async () => {
      const { user: liker, token: likerToken } =
        await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Liked Twice At Once",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const [likeInFlight] = await withLockHeld(
        { query: 'lock table "post_experts_user" in access exclusive mode' },
        async () => {
          const inFlight = request(ctx.app.getHttpServer())
            .post(`/forum/posts/${postId}/like`)
            .set("Authorization", `Bearer ${likerToken}`)
            .then((res) => res);
          await waitForBlockedBackends(1);

          await ctx.dataSource.query(
            `insert into post_likes_user ("postId", "userId") values ($1, $2)`,
            [postId, liker.id],
          );
          return [inFlight] as const;
        },
      );

      expect((await likeInFlight).status).toBe(404);

      const likeRows = await ctx.dataSource.query(
        `select "userId" from post_likes_user where "postId" = $1`,
        [postId],
      );
      expect(likeRows).toHaveLength(1);
    });

    it("keeps a comment edit that lands while a like is open", async () => {
      const { token: likerToken } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Holding A Comment Liked Mid-Save",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "original body", attachments: [] },
          parentObjectId: postResponse.body.id,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const commentId = commentResponse.body.id;
      const contentId = commentResponse.body.editableContent.id;

      // A comment loads its relations in one query, so what parks the like is
      // the liker read after it: User.leaderOf is a RelationId, and its query
      // hits community_leaders_user.
      const [likeInFlight] = await withLockHeld(
        {
          query: 'lock table "community_leaders_user" in access exclusive mode',
        },
        async () => {
          const inFlight = request(ctx.app.getHttpServer())
            .post(`/forum/comments/${commentId}/like`)
            .set("Authorization", `Bearer ${likerToken}`)
            .then((res) => res);
          await waitForBlockedBackends(1);

          await ctx.dataSource.query(
            `update editable_content set body = $2 where id = $1`,
            [contentId, "edited body"],
          );
          await ctx.dataSource.query(
            `update comment set pinned = true where id = $1`,
            [commentId],
          );
          return [inFlight] as const;
        },
      );

      expect((await likeInFlight).status).toBe(201);

      const [stored] = await ctx.dataSource.query(
        `select c.pinned, c."likesCount", ec.body from comment c
         join editable_content ec on ec.id = c."editableContentId"
         where c.id = $1`,
        [commentId],
      );
      expect(stored.body).toBe("edited body");
      expect(stored.pinned).toBe(true);
      expect(stored.likesCount).toBe(1);
    });

    it("groups unread post likes and migrates legacy grouping keys", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post To Get Likes",
          editableContent: {
            body: "Body",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;
      const groupingKey = `like:post:${postId}`;

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      let likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
      });

      expect(likeNotifs).toHaveLength(1);
      expect(likeNotifs[0].message).toBe(
        "Test Admin liked your post: Post To Get Likes",
      );
      expect(likeNotifs[0].groupingCount).toBe(1);
      expect(likeNotifs[0].groupingKey).toBe(groupingKey);
      expect(likeNotifs[0].webAppLocation).toBe(`/forum/post/${postId}`);

      const legacyGroupingKey = `forum_like:post:${postId}:user:${ctx.testUserId}`;
      await notifRepo.update(likeNotifs[0].id, {
        groupingKey: legacyGroupingKey,
      });

      const { token: likerToken } = await createExtraUserAndToken();

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${likerToken}`)
        .expect(201);

      likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
      });

      expect(likeNotifs).toHaveLength(1);
      expect(likeNotifs[0].message).toBe(
        "2 people liked your post: Post To Get Likes",
      );
      expect(likeNotifs[0].groupingCount).toBe(2);
      expect(await notifRepo.countBy({ groupingKey: legacyGroupingKey })).toBe(
        0,
      );
    });

    it("creates a new post like notification after the previous one is read", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Read Like Notification",
          editableContent: {
            body: "Body",
            attachments: [],
          },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;
      const groupingKey = `like:post:${postId}`;

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      let likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
        order: { createdAt: "ASC" },
      });

      expect(likeNotifs).toHaveLength(1);

      await request(ctx.app.getHttpServer())
        .post(`/notifs/read/${likeNotifs[0].id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const { token: secondLikerToken, user: secondLiker } =
        await createExtraUserAndToken();

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${secondLikerToken}`)
        .expect(201);

      likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
        order: { createdAt: "ASC" },
      });

      expect(likeNotifs).toHaveLength(2);
      expect(likeNotifs[1].groupingCount).toBe(1);
      expect(likeNotifs[1].message).toBe(
        `${secondLiker.name} liked your post: Post With Read Like Notification`,
      );
      expect(likeNotifs[1].readAt).toBeNull();
    });

    // it('creates a new comment like notification after the previous one is read', async () => {
    //   const postResponse = await request(ctx.app.getHttpServer())
    //     .post('/forum/posts')
    //     .set('Authorization', `Bearer ${ctx.accessToken}`)
    //     .send({
    //       title: 'Post With Comment Likes',
    //       editableContent: {
    //         body: 'Body',
    //         attachments: [],
    //       },
    //       visibleAt: new Date(),
    //     } satisfies CreatePostDto)
    //     .expect(201);

    //   const commentResponse = await request(ctx.app.getHttpServer())
    //     .post('/forum/comments')
    //     .set('Authorization', `Bearer ${ctx.accessToken}`)
    //     .send({
    //       editableContent: { body: 'Comment to Like', attachments: [] },
    //       parentObjectId: postResponse.body.id,
    //       parentObjectType: CommentParentObject.Post,
    //     } satisfies CreateCommentDto)
    //     .expect(201);

    //   const commentId = commentResponse.body.id;
    //   const groupingKey = `like:comment:${commentId}`;

    //   await request(ctx.app.getHttpServer())
    //     .post(`/forum/comments/${commentId}/like`)
    //     .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
    //     .expect(201);

    //   const { token: secondLikerToken } = await createExtraUserAndToken();

    //   await request(ctx.app.getHttpServer())
    //     .post(`/forum/comments/${commentId}/like`)
    //     .set('Authorization', `Bearer ${secondLikerToken}`)
    //     .expect(201);

    //   let commentLikeNotifs = await notifRepo.find({
    //     where: {
    //       user: { id: ctx.testUserId },
    //       category: NotificationCategory.Likes,
    //       groupingKey,
    //     },
    //     order: { createdAt: 'ASC' },
    //   });

    //   expect(commentLikeNotifs).toHaveLength(1);
    //   expect(commentLikeNotifs[0].message).toBe('2 people liked your comment');
    //   expect(commentLikeNotifs[0].groupingCount).toBe(2);

    //   await request(ctx.app.getHttpServer())
    //     .post(`/notifs/read/${commentLikeNotifs[0].id}`)
    //     .set('Authorization', `Bearer ${ctx.accessToken}`)
    //     .expect(201);

    //   const { token: thirdLikerToken, user: thirdUser } =
    //     await createExtraUserAndToken();

    //   await request(ctx.app.getHttpServer())
    //     .post(`/forum/comments/${commentId}/like`)
    //     .set('Authorization', `Bearer ${thirdLikerToken}`)
    //     .expect(201);

    //   commentLikeNotifs = await notifRepo.find({
    //     where: {
    //       user: { id: ctx.testUserId },
    //       category: NotificationCategory.Likes,
    //       groupingKey,
    //     },
    //     order: { createdAt: 'ASC' },
    //   });

    //   expect(commentLikeNotifs).toHaveLength(2);
    //   const latestNotif = commentLikeNotifs[1];
    //   expect(latestNotif.groupingCount).toBe(1);
    //   expect(latestNotif.message).toBe(`${thirdUser.name} liked your comment`);
    //   expect(latestNotif.read).toBe(false);
    // });

    it("admin can assign multiple authors to a post", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Multi Author Post",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;
      const { user: coAuthor } = await createExtraUserAndToken();

      const updateResponse = await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      expect(updateResponse.body.authorIds).toEqual(
        expect.arrayContaining([ctx.testUserId, coAuthor.id]),
      );
      expect(updateResponse.body.authorIds).toHaveLength(2);
    });

    it("notifies all authors when a comment is posted", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Co-Authors For Comment",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      // Admin comments on the post
      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          editableContent: { body: "A comment for authors", attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const replyId = commentResponse.body.id;

      // Original author should get notified
      const originalAuthorNotifs = await unreadContentRepo.find({
        where: {
          user: { id: ctx.testUserId },
          contentType: UnreadContentType.ForumReply,
          contentId: replyId,
        },
      });
      expect(originalAuthorNotifs.length).toBeGreaterThan(0);

      // Co-author should also get notified
      const coAuthorNotifs = await unreadContentRepo.find({
        where: {
          user: { id: coAuthor.id },
          contentType: UnreadContentType.ForumReply,
          contentId: replyId,
        },
      });
      expect(coAuthorNotifs.length).toBeGreaterThan(0);
    });

    it("sends like notifications to all authors", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Co-Authors For Likes",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      // Admin likes the post
      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const originalAuthorLikeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `like:post:${postId}`,
        },
      });
      expect(originalAuthorLikeNotifs).toHaveLength(1);

      const coAuthorLikeNotifs = await notifRepo.find({
        where: {
          user: { id: coAuthor.id },
          category: NotificationCategory.Likes,
          groupingKey: `like:post:${postId}`,
        },
      });
      expect(coAuthorLikeNotifs).toHaveLength(1);
    });

    it("removes the comment like notification when the sole liker unlikes", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Comment For Sole Unlike",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Sole-unlike comment", attachments: [] },
          parentObjectId: postResponse.body.id,
          parentObjectType: CommentParentObject.Post,
        } satisfies CreateCommentDto)
        .expect(201);

      const commentId = commentResponse.body.id;
      const groupingKey = `like:comment:${commentId}`;

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      let likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
      });
      expect(likeNotifs).toHaveLength(1);

      const legacyGroupingKey = `forum_like:comment:${commentId}`;
      await notifRepo.update(likeNotifs[0].id, {
        groupingKey: legacyGroupingKey,
      });

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentId}/unlike`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      likeNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: In([groupingKey, legacyGroupingKey]),
        },
      });
      expect(likeNotifs).toHaveLength(0);
    });

    it("leaves a read like notification untouched when the liker unlikes", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Read Like Notif",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;
      const groupingKey = `like:post:${postId}`;

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const readAt = new Date();
      await notifRepo.update(
        {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
        { readAt },
      );

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/unlike`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const notifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey,
        },
        relations: { associatedUsers: true },
      });
      expect(notifs).toHaveLength(1);
      expect(notifs[0].readAt).not.toBeNull();
      expect(notifs[0].associatedUsers).toHaveLength(1);
      expect(notifs[0].associatedUsers?.[0].id).toBe(ctx.adminUserId);
    });

    it("decrements each author's like notification on a multi-author post when one of two likers unlikes", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Multi-Author Post For Partial Unlike",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      const { token: secondLikerToken } = await createExtraUserAndToken();

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/like`)
        .set("Authorization", `Bearer ${secondLikerToken}`)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/forum/posts/${postId}/unlike`)
        .set("Authorization", `Bearer ${secondLikerToken}`)
        .expect(201);

      for (const ownerId of [ctx.testUserId, coAuthor.id]) {
        const notifs = await notifRepo.find({
          where: {
            user: { id: ownerId },
            category: NotificationCategory.Likes,
            groupingKey: `like:post:${postId}`,
          },
          relations: { associatedUsers: true },
        });
        expect(notifs).toHaveLength(1);
        expect(notifs[0].groupingCount).toBe(1);
        expect(notifs[0].associatedUsers).toHaveLength(1);
        expect(notifs[0].associatedUsers?.[0].id).toBe(ctx.adminUserId);
        expect(notifs[0].message).toBe(
          "Test Admin liked your post: Multi-Author Post For Partial Unlike",
        );
      }
    });

    it("includes co-authored posts in findPostsByUser", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Co-Authored Post For User List",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      const coAuthorPosts = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/user/${coAuthor.id}`)
        .expect(200);

      expect(coAuthorPosts.body.some((p) => p.id === postId)).toBe(true);
    });

    it("returns authors in admin posts listing", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Admin Listing Authors Post",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const targetPost = adminPosts.body.find((p) => p.id === postId);
      expect(targetPost).toBeDefined();
      expect(targetPost.authorIds).toEqual(
        expect.arrayContaining([ctx.testUserId, coAuthor.id]),
      );
      expect(targetPost.authors).toHaveLength(2);
    });

    it("returns authors from public post endpoints", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Authors For Public Endpoints",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        authorIds: [ctx.testUserId, coAuthor.id],
      }).expect(200);

      // GET /forum/posts/:id should include authors
      const singlePost = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(singlePost.body.authorIds).toEqual(
        expect.arrayContaining([ctx.testUserId, coAuthor.id]),
      );
      expect(singlePost.body.authors).toHaveLength(2);

      // GET /forum/posts should include authors on each post
      const allPosts = await request(ctx.app.getHttpServer())
        .get("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      const matchedPost = allPosts.body.find((p) => p.id === postId);
      expect(matchedPost).toBeDefined();
      expect(matchedPost.authorIds).toEqual(
        expect.arrayContaining([ctx.testUserId, coAuthor.id]),
      );
      expect(matchedPost.authors).toHaveLength(2);
    });

    it("drops the experts and authors a later save leaves out", async () => {
      const { user: firstExpert } = await createExtraUserAndToken();
      const { user: secondExpert } = await createExtraUserAndToken();
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With Shrinking Lists",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const save = (expertIds: number[], authorIds: number[]) =>
        saveSettings(postId, { expertIds, authorIds, qaMode: true }).expect(
          200,
        );

      await save(
        [firstExpert.id, secondExpert.id],
        [ctx.testUserId, coAuthor.id],
      );

      const shrunk = await save([secondExpert.id], [coAuthor.id]);
      expect(shrunk.body.expertIds).toEqual([secondExpert.id]);
      expect(shrunk.body.authorIds).toEqual([coAuthor.id]);

      const emptied = await save([], [coAuthor.id]);
      expect(emptied.body.expertIds).toEqual([]);

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const stored = adminPosts.body.find((p) => p.id === postId);
      expect(stored.expertIds).toEqual([]);
      expect(stored.authorIds).toEqual([coAuthor.id]);
    });

    it("refuses a save naming a user that does not exist", async () => {
      const { user: expert } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Saved With A Ghost",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await saveSettings(postId, {
        expertIds: [expert.id],
        qaMode: true,
      }).expect(200);

      const rejected = await saveSettings(postId, {
        expertIds: [expert.id, 999999],
      }).expect(400);
      expect(rejected.body.message).toContain("experts");

      await saveSettings(postId, { authorIds: [999999] }).expect(400);

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const stored = adminPosts.body.find((p) => p.id === postId);
      expect(stored.expertIds).toEqual([expert.id]);
      expect(stored.qaMode).toBe(true);
    });

    it("refuses a save whose ids are not user ids", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Saved With A Word For An Id",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const badSave = (body: object) =>
        request(ctx.app.getHttpServer())
          .patch(`/forum/admin/posts/${postId}/settings`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ expertIds: [], authorIds: [], qaMode: false, ...body });

      await badSave({ expertIds: ["nobody"] }).expect(400);
      await badSave({ authorIds: [1.5] }).expect(400);
      await badSave({ authorIds: [null] }).expect(400);
    });

    it("trims an expert label and clears one the save blanks out", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post With An Expert Label",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const patchLabel = (body: Partial<UpdatePostSettingsDto>) =>
        saveSettings(postId, { qaMode: true, ...body }).expect(200);

      const labelled = await patchLabel({ expertLabel: "AMA Guest" });
      expect(labelled.body.expertLabel).toBe("AMA Guest");

      const untouched = await patchLabel({});
      expect(untouched.body.expertLabel).toBe("AMA Guest");

      const padded = await patchLabel({ expertLabel: "  AMA Guest  " });
      expect(padded.body.expertLabel).toBe("AMA Guest");

      const cleared = await patchLabel({ expertLabel: null });
      expect(cleared.body.expertLabel).toBeNull();

      await patchLabel({ expertLabel: "AMA Guest" });
      const blanked = await patchLabel({ expertLabel: "   " });
      expect(blanked.body.expertLabel).toBeNull();
    });

    it("moves a post up the feed when its authors change", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Whose Authors Change",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const updated = await saveSettings(postId, {
        authorIds: [coAuthor.id],
      }).expect(200);

      expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(postResponse.body.updatedAt).getTime(),
      );
    });

    it("saves experts, authors, settings and tags in one call", async () => {
      const { user: expert } = await createExtraUserAndToken();
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Saved In One Call",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const saved = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [expert.id],
          authorIds: [coAuthor.id],
          qaMode: true,
          expertLabel: "AMA Guest",
          notifyForReplies: true,
          showClusterTags: true,
          tags: { tags: [{ name: "Logistics" }], knownTagIds: [] },
        } satisfies UpdatePostSettingsDto)
        .expect(200);

      expect(saved.body.expertIds).toEqual([expert.id]);
      expect(saved.body.authorIds).toEqual([coAuthor.id]);
      expect(saved.body.qaMode).toBe(true);
      expect(saved.body.expertLabel).toBe("AMA Guest");
      expect(saved.body.notifyForReplies).toBe(true);
      expect(saved.body.showClusterTags).toBe(true);
      expect(saved.body.tags.map((tag) => tag.name)).toEqual(["Logistics"]);

      const untagged = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [coAuthor.id],
          qaMode: false,
        } satisfies UpdatePostSettingsDto)
        .expect(200);

      expect(untagged.body.expertIds).toEqual([]);
      expect(untagged.body.qaMode).toBe(false);
      expect(untagged.body.expertLabel).toBe("AMA Guest");
      expect(untagged.body.tags.map((tag) => tag.name)).toEqual(["Logistics"]);
    });

    it("keeps the experts a rejected tag save came with", async () => {
      const { user: expert } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Saved Against Stale Tags",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;
      const settings = {
        expertIds: [expert.id],
        authorIds: [],
        qaMode: true,
      };

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          ...settings,
          tags: { tags: [{ name: "Logistics" }], knownTagIds: [] },
        } satisfies UpdatePostSettingsDto)
        .expect(200);

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [],
          qaMode: false,
          tags: { tags: [{ name: "Timeline" }], knownTagIds: [] },
        } satisfies UpdatePostSettingsDto)
        .expect(409);

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const stored = adminPosts.body.find((p) => p.id === postId);
      expect(stored.expertIds).toEqual([expert.id]);
      expect(stored.qaMode).toBe(true);
    });

    it("adds an expert and an author once when two saves race to add them", async () => {
      const { user: expert } = await createExtraUserAndToken();
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Gaining The Same Expert Twice",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;
      const addBoth = () =>
        saveSettings(postId, {
          expertIds: [expert.id],
          authorIds: [coAuthor.id],
        }).then((res) => res);

      const inFlight = await withLockHeld(
        {
          query: "select id from post where id = $1 for update",
          params: [postId],
        },
        async () => {
          const first = addBoth();
          await waitForBlockedBackends(1);
          const second = addBoth();
          await waitForBlockedBackends(2);
          return [first, second] as const;
        },
      );

      for (const save of await Promise.all(inFlight)) {
        expect(save.status).toBe(200);
      }

      expect(
        await ctx.dataSource.query(
          `select "userId" from post_experts_user where "postId" = $1`,
          [postId],
        ),
      ).toEqual([{ userId: expert.id }]);
      expect(
        await ctx.dataSource.query(
          `select "userId" from post_authors_user where "postId" = $1`,
          [postId],
        ),
      ).toEqual([{ userId: coAuthor.id }]);
    });

    it("keeps only the experts the later save named", async () => {
      const { user: firstExpert } = await createExtraUserAndToken();
      const { user: secondExpert } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Gaining Two Different Experts",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      const inFlight = await withLockHeld(
        {
          query: "select id from post where id = $1 for update",
          params: [postId],
        },
        async () => {
          const first = saveSettings(postId, {
            expertIds: [firstExpert.id],
          }).then((res) => res);
          await waitForBlockedBackends(1);
          const second = saveSettings(postId, {
            expertIds: [secondExpert.id],
          }).then((res) => res);
          await waitForBlockedBackends(2);
          return [first, second] as const;
        },
      );

      for (const save of await Promise.all(inFlight)) {
        expect(save.status).toBe(200);
      }

      expect(
        await ctx.dataSource.query(
          `select "userId" from post_experts_user where "postId" = $1`,
          [postId],
        ),
      ).toEqual([{ userId: secondExpert.id }]);
    });

    it("refuses a save whose settings are the wrong type", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Saved With A Word For A Flag",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [],
          qaMode: true,
          showClusterTags: true,
          expertLabel: "AMA Guest",
        } satisfies UpdatePostSettingsDto)
        .expect(200);

      const rejected = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ expertIds: [], authorIds: [], qaMode: "nope" })
        .expect(400);
      expect(rejected.body.message).toContain("qaMode must be a boolean value");

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [],
          qaMode: true,
          showClusterTags: "nope",
        })
        .expect(400);

      const labelled = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [],
          qaMode: true,
          expertLabel: { deeply: "nested" },
        })
        .expect(400);
      expect(labelled.body.message).toContain("expertLabel must be a string");

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [],
          qaMode: true,
          expertLabel: "A".repeat(65),
        } satisfies UpdatePostSettingsDto)
        .expect(400);

      const listedTags = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ expertIds: [], authorIds: [], qaMode: true, tags: [] })
        .expect(400);
      expect(listedTags.body.message).toContain("tags must be an object");

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const unchanged = adminPosts.body.find((p) => p.id === postId);
      expect(unchanged.qaMode).toBe(true);
      expect(unchanged.showClusterTags).toBe(true);
      expect(unchanged.expertLabel).toBe("AMA Guest");
    });

    it("rejects non-admin from updating post settings", async () => {
      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post For Auth Check",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postResponse.body.id}/settings`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          expertIds: [],
          authorIds: [ctx.testUserId],
          qaMode: false,
        } satisfies UpdatePostSettingsDto)
        .expect(401);
    });

    it("creates notifications when activity comments receive likes", async () => {
      await activityRepo.delete({
        user: { id: ctx.testUserId },
        actionId: testAction.id,
      });

      const completeResponse = await request(ctx.app.getHttpServer())
        .post(`/actions/complete/${testAction.id}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(201);

      const activityId = completeResponse.body.id;

      const commentResponse = await request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Activity thread comment", attachments: [] },
          parentObjectId: activityId,
          parentObjectType: CommentParentObject.Activity,
        } satisfies CreateCommentDto)
        .expect(201);

      const commentId = commentResponse.body.id;

      await request(ctx.app.getHttpServer())
        .post(`/forum/comments/${commentId}/like`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(201);

      const activityCommentNotifs = await notifRepo.find({
        where: {
          user: { id: ctx.testUserId },
          category: NotificationCategory.Likes,
          groupingKey: `like:comment:${commentId}`,
        },
      });

      expect(activityCommentNotifs).toHaveLength(1);
      expect(activityCommentNotifs[0].message).toBe(
        "Test Admin liked your comment: Activity thread comment",
      );
      expect(activityCommentNotifs[0].webAppLocation).toBe(
        `/actions/${testAction.id}/activity/${activityId}?replyId=${commentId}`,
      );
    });
  });

  describe("Post tags", () => {
    const saveTags = ({
      postId,
      tags,
      knownTagIds,
    }: {
      postId: number;
      tags: { id?: number; name: string }[];
      knownTagIds: number[];
    }) => saveSettings(postId, { tags: { tags, knownTagIds } });

    const createTaggedPost = async (names: string[]) => {
      const post = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Tagged Post",
          editableContent: { body: "Body content", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const tagged = await saveTags({
        postId: post.body.id,
        tags: names.map((name) => ({ name })),
        knownTagIds: [],
      }).expect(200);

      return { postId: post.body.id as number, tags: tagged.body.tags };
    };

    const postComment = (postId: number, body: Partial<CreateCommentDto>) =>
      request(ctx.app.getHttpServer())
        .post("/forum/comments")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          editableContent: { body: "Tagged comment", attachments: [] },
          parentObjectId: postId,
          parentObjectType: CommentParentObject.Post,
          ...body,
        } satisfies CreateCommentDto);

    const commentWithTag = async (postId: number, tagId: number) => {
      const created = await postComment(postId, { tagId }).expect(201);
      return created.body.id;
    };

    const commentTagId = async (postId: number, commentId: number) => {
      const comments = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      return comments.body.find((comment) => comment.id === commentId).tagId;
    };

    const tagIds = (tags: { id: number }[]) => tags.map((tag) => tag.id);

    it("swaps two tag names in one save", async () => {
      const { postId, tags } = await createTaggedPost(["A", "B"]);
      const commentId = await commentWithTag(postId, tags[0].id);

      const swapped = await saveTags({
        postId,
        tags: [
          { id: tags[0].id, name: "B" },
          { id: tags[1].id, name: "A" },
        ],
        knownTagIds: tagIds(tags),
      }).expect(200);

      expect(swapped.body.tags).toEqual([
        { id: tags[0].id, name: "B", sortOrder: 0 },
        { id: tags[1].id, name: "A", sortOrder: 1 },
      ]);
      expect(await commentTagId(postId, commentId)).toBe(tags[0].id);
    });

    it("drops a tag and renames the others in one save", async () => {
      const { postId, tags } = await createTaggedPost(["A", "B", "C"]);
      const keptCommentId = await commentWithTag(postId, tags[0].id);
      const droppedCommentId = await commentWithTag(postId, tags[2].id);

      const saved = await saveTags({
        postId,
        tags: [
          { id: tags[0].id, name: "B" },
          { id: tags[1].id, name: "A" },
        ],
        knownTagIds: tagIds(tags),
      }).expect(200);

      expect(saved.body.tags).toEqual([
        { id: tags[0].id, name: "B", sortOrder: 0 },
        { id: tags[1].id, name: "A", sortOrder: 1 },
      ]);
      expect(await commentTagId(postId, keptCommentId)).toBe(tags[0].id);
      expect(await commentTagId(postId, droppedCommentId)).toBeNull();
    });

    it("keeps every tag when a save fails partway", async () => {
      const { postId, tags } = await createTaggedPost(["A", "B", "C"]);
      const commentId = await commentWithTag(postId, tags[2].id);

      await saveTags({
        postId,
        tags: [
          { id: tags[0].id, name: "B" },
          { id: tags[1].id, name: "A" },
          { id: tags[2].id + 1000, name: "D" },
        ],
        knownTagIds: tagIds(tags),
      }).expect(400);

      const post = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(post.body.tags).toEqual([
        { id: tags[0].id, name: "A", sortOrder: 0 },
        { id: tags[1].id, name: "B", sortOrder: 1 },
        { id: tags[2].id, name: "C", sortOrder: 2 },
      ]);
      expect(await commentTagId(postId, commentId)).toBe(tags[2].id);
    });

    it("refuses to save over a tag added from another session", async () => {
      const { postId, tags } = await createTaggedPost(["A"]);
      const other = await saveTags({
        postId,
        tags: [{ id: tags[0].id, name: "A" }, { name: "B" }],
        knownTagIds: tagIds(tags),
      }).expect(200);

      const stale = await saveTags({
        postId,
        tags: [{ id: tags[0].id, name: "A renamed" }],
        knownTagIds: tagIds(tags),
      }).expect(409);
      expect(stale.body.message).toContain("Another admin");

      const post = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(post.body.tags).toEqual(other.body.tags);
    });

    it("refuses to save over tags a save in flight has not committed", async () => {
      const { postId, tags } = await createTaggedPost(["A"]);

      const inFlight = await withLockHeld(
        {
          query: "select id from post where id = $1 for update",
          params: [postId],
        },
        async () => {
          const first = saveTags({
            postId,
            tags: [{ name: "First" }],
            knownTagIds: tagIds(tags),
          }).then((res) => res);
          await waitForBlockedBackends(1);
          const second = saveTags({
            postId,
            tags: [{ name: "Second" }],
            knownTagIds: tagIds(tags),
          }).then((res) => res);
          await waitForBlockedBackends(2);
          return [first, second] as const;
        },
      );

      const [first, second] = await Promise.all(inFlight);
      expect(first.status).toBe(200);
      expect(second.status).toBe(409);

      const post = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(post.body.tags.map((tag) => tag.name)).toEqual(["First"]);
    });

    it("refuses a save that names one tag twice, rather than dropping the rest", async () => {
      const { postId, tags } = await createTaggedPost(["A", "B"]);

      await saveTags({
        postId,
        tags: [
          { id: tags[0].id, name: "X" },
          { id: tags[0].id, name: "Y" },
        ],
        knownTagIds: tagIds(tags),
      }).expect(400);

      const post = await request(ctx.app.getHttpServer())
        .get(`/forum/posts/${postId}`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200);
      expect(post.body.tags.map((tag) => tag.name)).toEqual(["A", "B"]);
    });

    it("rejects a tag name that is only whitespace", async () => {
      const { postId, tags } = await createTaggedPost(["A"]);

      await saveTags({
        postId,
        tags: [{ name: "   " }],
        knownTagIds: tagIds(tags),
      }).expect(400);
    });

    it("trims a tag name, and catches names that collide once trimmed", async () => {
      const { postId, tags } = await createTaggedPost(["A"]);

      const saved = await saveTags({
        postId,
        tags: [{ name: "  Praise  " }],
        knownTagIds: tagIds(tags),
      }).expect(200);
      expect(saved.body.tags[0].name).toBe("Praise");

      await saveTags({
        postId,
        tags: [{ name: "Praise" }, { name: " Praise " }],
        knownTagIds: tagIds(saved.body.tags),
      }).expect(400);
    });

    it("requires a tag once the post defines them", async () => {
      const { postId } = await createTaggedPost(["A"]);

      const rejected = await postComment(postId, {}).expect(400);
      expect(rejected.body.message).toBe("Pick a tag for this comment");
    });

    it("rejects a tag that belongs to another post", async () => {
      const other = await createTaggedPost(["A"]);
      const { postId } = await createTaggedPost(["B"]);

      await postComment(postId, { tagId: other.tags[0].id }).expect(400);
    });

    it("keeps the picked tag on a top-level comment", async () => {
      const { postId, tags } = await createTaggedPost(["A", "B"]);

      const commentId = await commentWithTag(postId, tags[1].id);

      expect(await commentTagId(postId, commentId)).toBe(tags[1].id);
    });

    it("ignores a tag sent on a reply", async () => {
      const { postId, tags } = await createTaggedPost(["A"]);
      const parentId = await commentWithTag(postId, tags[0].id);

      const reply = await postComment(postId, {
        parentId,
        tagId: tags[0].id,
      }).expect(201);

      expect(reply.body.tagId).toBeNull();
    });

    it("takes no tag on a post that defines none", async () => {
      const post = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Untagged Post",
          editableContent: { body: "Body content", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const created = await postComment(post.body.id, {}).expect(201);
      expect(created.body.tagId).toBeNull();
    });
  });
});

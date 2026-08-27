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
import { CreatePostDto } from "../src/forum/dto/post.dto";
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

      const updateResponse = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

      await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .expect(200);

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

    it("keeps a settings write that lands while an authors save is open", async () => {
      const { user: coAuthor } = await createExtraUserAndToken();

      const postResponse = await request(ctx.app.getHttpServer())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "Post Saved From Both Halves",
          editableContent: { body: "Body", attachments: [] },
          visibleAt: new Date(),
        } satisfies CreatePostDto)
        .expect(201);

      const postId = postResponse.body.id;

      // The authors save reads the post's join rows last, so holding that
      // table parks it on the columns it has already read, which is the window
      // a settings write used to land in and lose.
      const gate = ctx.dataSource.createQueryRunner();
      await gate.connect();
      await gate.startTransaction();
      await gate.query(
        'lock table "post_authors_user" in access exclusive mode',
      );

      const authorsInFlight = request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [ctx.testUserId, coAuthor.id] })
        .then((res) => res);
      await waitForBlockedBackends(1);

      let settingsWritten = false;
      const settingsInFlight = ctx.dataSource
        .query(
          `update post set "qaMode" = true, "expertLabel" = $2,
             "notifyForReplies" = true, "showClusterTags" = true where id = $1`,
          [postId, "AMA Guest"],
        )
        .then(() => {
          settingsWritten = true;
        });
      await waitForBlockedBackends(2, () => settingsWritten);

      await gate.commitTransaction();
      await gate.release();

      const [authorsResponse] = await Promise.all([
        authorsInFlight,
        settingsInFlight,
      ]);

      expect(authorsResponse.status).toBe(200);
      expect(authorsResponse.body.authorIds).toEqual(
        expect.arrayContaining([ctx.testUserId, coAuthor.id]),
      );

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const stored = adminPosts.body.find((p) => p.id === postId);
      expect(stored.authorIds).toEqual(
        expect.arrayContaining([ctx.testUserId, coAuthor.id]),
      );
      expect(stored.qaMode).toBe(true);
      expect(stored.expertLabel).toBe("AMA Guest");
      expect(stored.notifyForReplies).toBe(true);
      expect(stored.showClusterTags).toBe(true);
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

      const patchExperts = (expertIds: number[]) =>
        request(ctx.app.getHttpServer())
          .patch(`/forum/admin/posts/${postId}/experts`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ expertIds, qaMode: true })
          .expect(200);

      const patchAuthors = (authorIds: number[]) =>
        request(ctx.app.getHttpServer())
          .patch(`/forum/admin/posts/${postId}/authors`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ authorIds })
          .expect(200);

      await patchExperts([firstExpert.id, secondExpert.id]);
      await patchAuthors([ctx.testUserId, coAuthor.id]);

      const shrunkExperts = await patchExperts([secondExpert.id]);
      const shrunkAuthors = await patchAuthors([coAuthor.id]);

      expect(shrunkExperts.body.expertIds).toEqual([secondExpert.id]);
      expect(shrunkAuthors.body.authorIds).toEqual([coAuthor.id]);

      const emptied = await patchExperts([]);
      expect(emptied.body.expertIds).toEqual([]);

      const adminPosts = await request(ctx.app.getHttpServer())
        .get("/forum/admin/posts")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const stored = adminPosts.body.find((p) => p.id === postId);
      expect(stored.expertIds).toEqual([]);
      expect(stored.authorIds).toEqual([coAuthor.id]);
    });

    it("clears the expert label only when the save sends null", async () => {
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

      const patchExperts = (body: object) =>
        request(ctx.app.getHttpServer())
          .patch(`/forum/admin/posts/${postId}/experts`)
          .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
          .send({ expertIds: [], qaMode: true, ...body })
          .expect(200);

      const labelled = await patchExperts({ expertLabel: "AMA Guest" });
      expect(labelled.body.expertLabel).toBe("AMA Guest");

      const untouched = await patchExperts({});
      expect(untouched.body.expertLabel).toBe("AMA Guest");

      const cleared = await patchExperts({ expertLabel: null });
      expect(cleared.body.expertLabel).toBeNull();
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

      const updated = await request(ctx.app.getHttpServer())
        .patch(`/forum/admin/posts/${postId}/authors`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ authorIds: [coAuthor.id] })
        .expect(200);

      expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThan(
        new Date(postResponse.body.updatedAt).getTime(),
      );
    });

    it("rejects non-admin from updating post authors", async () => {
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
        .patch(`/forum/admin/posts/${postResponse.body.id}/authors`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({ authorIds: [ctx.testUserId] })
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
});

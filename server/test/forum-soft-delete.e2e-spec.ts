import { NotFoundException } from "@nestjs/common";
import {
  GlobalFeedItemDto,
  GlobalFeedItemType,
} from "src/actions/dto/action.dto";
import { ActionStatus } from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { Cluster } from "src/cluster/entities/cluster.entity";
import { softDeleteCascade } from "src/datasources/soft-delete";
import { CommentDto } from "src/forum/dto/comment.dto";
import type { PostDto, UpdatePostSettingsDto } from "src/forum/dto/post.dto";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { ForumService } from "src/forum/forum.service";
import { UnreadContent } from "src/notifs/entities/unread-content.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import {
  createTestApp,
  signAccessToken,
  TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

describe("Forum soft deletion (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let emails = 0;

  const server = () => ctx.app.getHttpServer();

  const member = async (): Promise<{ user: User; token: string }> => {
    const user = await userRepo.save(
      userRepo.create({
        name: `Forum Member ${emails}`,
        email: `forum-soft-delete-${emails++}@example.com`,
        password: "password",
      }),
    );
    return { user, token: signAccessToken(ctx.jwtService, user) };
  };

  const createPost = async (token: string): Promise<number> =>
    (
      await request(server())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Discussion",
          editableContent: { body: "Post body", attachments: [] },
        })
        .expect(201)
    ).body.id;

  const comment = (params: {
    token: string;
    postId: number;
    parentId?: number;
    body?: string;
  }) =>
    request(server())
      .post("/forum/comments")
      .set("Authorization", `Bearer ${params.token}`)
      .send({
        parentObjectType: CommentParentObject.Post,
        parentObjectId: params.postId,
        parentId: params.parentId,
        editableContent: {
          body: params.body ?? "A comment",
          attachments: ["attachment-key.webp"],
        },
      });

  const deleteComment = (token: string, id: number) =>
    request(server())
      .delete(`/forum/comments/${id}`)
      .set("Authorization", `Bearer ${token}`);

  const thread = async (postId: number): Promise<CommentDto[]> =>
    (
      await request(server())
        .get(`/forum/posts/${postId}/comments`)
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .expect(200)
    ).body;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("keeps a deleted comment in its thread without its content", async () => {
    const author = await member();
    const replier = await member();
    const postId = await createPost(ctx.accessToken);
    const parent = (await comment({ ...author, postId }).expect(201)).body;
    const reply = (
      await comment({ ...replier, postId, parentId: parent.id }).expect(201)
    ).body;

    await deleteComment(author.token, parent.id).expect(200);

    const [placeholder] = await thread(postId);
    expect(placeholder).toMatchObject({
      id: parent.id,
      deleted: true,
      author: { id: author.user.id },
      editableContent: { body: "", attachments: [] },
      children: [expect.objectContaining({ id: reply.id, deleted: false })],
    });
  });

  it("leaves a soft-deleted liker out of a deleted comment's placeholder", async () => {
    const author = await member();
    const liker = await member();
    const postId = await createPost(ctx.accessToken);
    const deleted = (await comment({ ...author, postId }).expect(201)).body;
    await request(server())
      .post(`/forum/comments/${deleted.id}/like`)
      .set("Authorization", `Bearer ${liker.token}`)
      .expect(201);

    await userRepo.softDelete(liker.user.id);
    await deleteComment(author.token, deleted.id).expect(200);

    const [placeholder] = await thread(postId);
    expect(placeholder).toMatchObject({ id: deleted.id, likes: [] });
  });

  it("answers a repeated delete of a comment as it did the first", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const deleted = (await comment({ ...author, postId }).expect(201)).body;

    await deleteComment(author.token, deleted.id).expect(200);
    await deleteComment(author.token, deleted.id).expect(200);
  });

  it("unpins a comment when it is deleted", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const pinned = (await comment({ ...author, postId }).expect(201)).body;
    await request(server())
      .patch(`/forum/admin/comments/${pinned.id}/pin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    await deleteComment(author.token, pinned.id).expect(200);

    const [placeholder] = await thread(postId);
    expect(placeholder).toMatchObject({ id: pinned.id, pinned: false });
  });

  it("refuses to edit, like, or pin a deleted comment", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const deleted = (await comment({ ...author, postId }).expect(201)).body;
    await deleteComment(author.token, deleted.id).expect(200);

    await request(server())
      .patch(`/forum/comments/${deleted.id}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ editableContent: { body: "Edited", attachments: [] } })
      .expect(404);
    await request(server())
      .post(`/forum/comments/${deleted.id}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(404);
    await request(server())
      .patch(`/forum/admin/comments/${deleted.id}/pin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it("leaves comments on a deleted post out of a member's comment list", async () => {
    const author = await member();
    const kept = await createPost(ctx.accessToken);
    const removed = await createPost(author.token);
    await comment({ ...author, postId: kept }).expect(201);
    await comment({ ...author, postId: removed }).expect(201);
    await request(server())
      .delete(`/forum/posts/${removed}`)
      .set("Authorization", `Bearer ${author.token}`)
      .expect(200);

    const listed = await request(server())
      .get(`/forum/posts/user/${author.user.id}/comments`)
      .expect(200);

    expect(
      listed.body.map((entry: CommentDto) => entry.parentObjectId),
    ).toEqual([kept]);
  });

  it("leaves comments on a deleted action out of a member's comment list", async () => {
    const author = await member();
    const actionRepo = ctx.dataSource.getRepository(Action);
    const commentRepo = ctx.dataSource.getRepository(Comment);
    const kept = await actionRepo.save({
      name: "Kept",
      category: [],
      body: "",
    });
    const removed = await actionRepo.save({
      name: "Removed",
      category: [],
      body: "",
    });
    for (const action of [kept, removed]) {
      await commentRepo.save({
        authorId: author.user.id,
        parentObjectType: CommentParentObject.Action,
        parentObjectId: action.id,
        editableContent: { body: "Hello", attachments: [] },
      });
    }
    await actionRepo.softDelete(removed.id);

    const listed = await request(server())
      .get(`/forum/posts/user/${author.user.id}/comments`)
      .expect(200);

    expect(
      listed.body.map((entry: CommentDto) => entry.parentObjectId),
    ).toEqual([kept.id]);
  });

  it("refuses to like a deleted post", async () => {
    const author = await member();
    const postId = await createPost(author.token);
    await request(server())
      .delete(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${author.token}`)
      .expect(200);

    await request(server())
      .post(`/forum/posts/${postId}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(404);
  });

  it("takes a reply to a deleted comment without telling its author", async () => {
    const postAuthor = await member();
    const author = await member();
    const replier = await member();
    const postId = await createPost(postAuthor.token);
    const parent = (await comment({ ...author, postId }).expect(201)).body;
    await deleteComment(author.token, parent.id).expect(200);

    const reply = (
      await comment({ ...replier, postId, parentId: parent.id }).expect(201)
    ).body;

    expect(
      await ctx.dataSource.getRepository(UnreadContent).findOneBy({
        user: { id: author.user.id },
        contentId: reply.id,
      }),
    ).toBeNull();
    expect(
      await ctx.dataSource.getRepository(UnreadContent).findOneBy({
        user: { id: postAuthor.user.id },
        contentId: reply.id,
      }),
    ).not.toBeNull();
    const [placeholder] = await thread(postId);
    expect(placeholder.children).toEqual([
      expect.objectContaining({ id: reply.id }),
    ]);
  });

  it("drops a soft-deleted account's comments and the replies under them", async () => {
    const departing = await member();
    const replier = await member();
    const postId = await createPost(ctx.accessToken);
    const kept = (await comment({ ...replier, postId }).expect(201)).body;
    const parent = (await comment({ ...departing, postId }).expect(201)).body;
    const reply = (
      await comment({ ...replier, postId, parentId: parent.id }).expect(201)
    ).body;

    await userRepo.softDelete(departing.user.id);

    expect((await thread(postId)).map((entry) => entry.id)).toEqual([kept.id]);
    expect(
      (await ctx.app.get(ForumService).findCommentsForPostRaw(postId)).map(
        (entry) => entry.id,
      ),
    ).toEqual([kept.id]);
    const posts = await request(server())
      .get("/forum/posts")
      .set("Authorization", `Bearer ${replier.token}`)
      .expect(200);
    expect(
      posts.body.find((post: PostDto) => post.id === postId)?.commentCount,
    ).toBe(1);
    for (const list of ["comments", "forumComments"]) {
      const listed = await request(server())
        .get(`/forum/posts/user/${replier.user.id}/${list}`)
        .expect(200);
      expect(listed.body.map((entry: CommentDto) => entry.id)).toEqual([
        kept.id,
      ]);
    }
    await comment({ ...replier, postId, parentId: parent.id }).expect(404);
    await comment({ ...replier, postId, parentId: reply.id }).expect(404);
  });

  it("leaves replies under a soft-deleted account's comment out of the global feed", async () => {
    const departing = await member();
    const replier = await member();
    const postId = await createPost(ctx.accessToken);
    const parent = (await comment({ ...departing, postId }).expect(201)).body;
    await comment({ ...replier, postId, parentId: parent.id }).expect(201);

    await userRepo.softDelete(departing.user.id);

    const feed = await request(server())
      .get("/actions/globalFeed?limit=100")
      .set("Authorization", `Bearer ${replier.token}`)
      .expect(200);
    expect(
      feed.body.filter(
        (item: GlobalFeedItemDto) =>
          item.type === GlobalFeedItemType.ForumComments &&
          item.forumComments?.postId === postId,
      ),
    ).toEqual([]);
    const members = await request(server())
      .get(`/actions/globalFeed/forumCommentMembers?postId=${postId}`)
      .set("Authorization", `Bearer ${replier.token}`)
      .expect(200);
    expect(members.body).toEqual([]);
  });

  it("drops a soft-deleted account's activity and action comments and the replies under them", async () => {
    const departing = await member();
    const replier = await member();
    const commentRepo = ctx.dataSource.getRepository(Comment);
    const forum = ctx.app.get(ForumService);
    const threadUnder = async (parentObjectType: CommentParentObject) => {
      const parentObjectId = 900000 + emails++;
      const save = (authorId: number, parentId: number | null = null) =>
        commentRepo.save({
          authorId,
          parentObjectType,
          parentObjectId,
          parentId,
          editableContent: { body: "Hello", attachments: [] },
        });
      const kept = await save(replier.user.id);
      const hidden = await save(departing.user.id);
      await save(replier.user.id, hidden.id);
      return { parentObjectId, kept };
    };
    const activity = await threadUnder(CommentParentObject.Activity);
    const action = await threadUnder(CommentParentObject.Action);

    await userRepo.softDelete(departing.user.id);

    expect(
      (await forum.findCommentsForActivity(activity.parentObjectId)).map(
        (entry) => entry.id,
      ),
    ).toEqual([activity.kept.id]);
    expect(
      (await forum.findCommentsForActivities([activity.parentObjectId]))
        .get(activity.parentObjectId)
        ?.map((entry) => entry.id),
    ).toEqual([activity.kept.id]);
    expect(
      (await forum.findCommentsForAction(action.parentObjectId)).map(
        (entry) => entry.id,
      ),
    ).toEqual([action.kept.id]);
  });

  it("drops a deleted account's comments and the replies under them", async () => {
    const departing = await member();
    const replier = await member();
    const postId = await createPost(ctx.accessToken);
    const kept = (await comment({ ...replier, postId }).expect(201)).body;
    const parent = (await comment({ ...departing, postId }).expect(201)).body;
    const hidden = (
      await comment({ ...replier, postId, parentId: parent.id }).expect(201)
    ).body;

    await request(server())
      .delete(`/user/userdetail/${departing.user.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ reason: "Requested", confirmationEmail: departing.user.email })
      .expect(200);

    expect((await thread(postId)).map((entry) => entry.id)).toEqual([kept.id]);
    expect(
      (await ctx.app.get(ForumService).findCommentsForPostRaw(postId)).map(
        (entry) => entry.id,
      ),
    ).toEqual([kept.id]);
    await comment({ ...replier, postId, parentId: parent.id }).expect(404);
    await comment({ ...replier, postId, parentId: hidden.id }).expect(404);
  });

  it("leaves a deleted account out of a comment's likes", async () => {
    const author = await member();
    const [staying, departing] = await Promise.all([member(), member()]);
    const postId = await createPost(ctx.accessToken);
    const liked = (await comment({ ...author, postId }).expect(201)).body;
    await ctx.dataSource
      .createQueryBuilder()
      .relation(Comment, "likes")
      .of(liked.id)
      .add([staying.user.id, departing.user.id]);

    await userRepo.softDelete(departing.user.id);

    const [entry] = await thread(postId);
    expect(entry.likes.map((liker) => liker.id)).toEqual([staying.user.id]);
  });

  it("shows a comment author's cluster in the thread", async () => {
    const author = await member();
    const cluster = await ctx.dataSource
      .getRepository(Cluster)
      .save({ displayName: "Thread cluster" });
    await userRepo.update(author.user.id, { cluster: { id: cluster.id } });
    const postId = await createPost(ctx.accessToken);
    await comment({ ...author, postId }).expect(201);

    const [entry] = await thread(postId);
    expect(entry.author?.cluster).toEqual(
      expect.objectContaining({ id: cluster.id }),
    );
  });

  it("previews a post's newest comment by a live account", async () => {
    const departing = await member();
    const staying = await member();
    const postId = await createPost(ctx.accessToken);
    const kept = (await comment({ ...staying, postId }).expect(201)).body;
    const hidden = (await comment({ ...departing, postId }).expect(201)).body;
    await comment({ ...staying, postId, parentId: hidden.id }).expect(201);

    await userRepo.softDelete(departing.user.id);

    const posts = await request(server())
      .get("/forum/posts")
      .set("Authorization", `Bearer ${staying.token}`)
      .expect(200);
    expect(
      posts.body.find((post: PostDto) => post.id === postId)?.lastComment?.id,
    ).toBe(kept.id);
    expect(
      (
        await ctx.app.get(ForumService).findForumCommentsByUserForFeed({
          authorId: staying.user.id,
          limit: 10,
        })
      ).map((entry) => entry.comment.id),
    ).toEqual([kept.id]);
  });

  it("counts the undeleted comments a thread shows", async () => {
    const departing = await member();
    const staying = await member();
    const postId = await createPost(ctx.accessToken);
    const root = (await comment({ ...staying, postId }).expect(201)).body;
    const hidden = (
      await comment({ ...departing, postId, parentId: root.id }).expect(201)
    ).body;
    await comment({ ...staying, postId, parentId: hidden.id }).expect(201);
    const deleted = (await comment({ ...staying, postId }).expect(201)).body;
    await comment({ ...staying, postId, parentId: deleted.id }).expect(201);
    await deleteComment(staying.token, deleted.id).expect(200);

    await userRepo.softDelete(departing.user.id);

    const posts = await request(server())
      .get("/forum/posts")
      .set("Authorization", `Bearer ${staying.token}`)
      .expect(200);
    expect(
      posts.body.find((post: PostDto) => post.id === postId)?.commentCount,
    ).toBe(2);
  });

  it("refuses a post naming a deleted action", async () => {
    const actions = ctx.dataSource.getRepository(Action);
    const action = await actions.save(
      actions.create({
        name: "Deleted action",
        category: [],
        body: "Deleted",
        status: ActionStatus.MemberAction,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );
    await actions.softDelete(action.id);
    const postId = await createPost(ctx.accessToken);

    await request(server())
      .post("/forum/posts")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        title: "About a deleted action",
        editableContent: { body: "Post body", attachments: [] },
        actionId: action.id,
      })
      .expect(404);
    await request(server())
      .patch(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ actionId: action.id })
      .expect(404);
  });

  it("edits a post whose action was deleted when the edit keeps that action", async () => {
    const actions = ctx.dataSource.getRepository(Action);
    const action = await actions.save(
      actions.create({
        name: "Action deleted after posting",
        category: [],
        body: "Deleted",
        status: ActionStatus.MemberAction,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      }),
    );
    const postId = (
      await request(server())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          title: "About an action",
          editableContent: { body: "Post body", attachments: [] },
          actionId: action.id,
        })
        .expect(201)
    ).body.id;
    await actions.softDelete(action.id);

    await request(server())
      .patch(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ title: "Retitled", actionId: action.id })
      .expect(200);
  });

  it("takes concurrent comments on one post", async () => {
    const postId = await createPost(ctx.accessToken);
    const commenters = await Promise.all([1, 2, 3, 4, 5].map(() => member()));

    const responses = await Promise.all(
      commenters.map((commenter) => comment({ ...commenter, postId })),
    );

    expect(responses.map((response) => response.status)).toEqual(
      commenters.map(() => 201),
    );
  });

  it("takes comments on a scheduled post only from those who can see it", async () => {
    const author = await member();
    const outsider = await member();
    const postId = (
      await request(server())
        .post("/forum/posts")
        .set("Authorization", `Bearer ${author.token}`)
        .send({
          title: "Scheduled",
          editableContent: { body: "Post body", attachments: [] },
          visibleAt: new Date(Date.now() + 86_400_000),
        })
        .expect(201)
    ).body.id;

    await comment({ ...outsider, postId }).expect(404);
    await comment({ ...author, postId }).expect(201);
    await comment({ token: ctx.adminAccessToken, postId }).expect(201);
  });

  it("refuses a comment on a deleted post", async () => {
    const author = await member();
    const postId = await createPost(author.token);
    await request(server())
      .delete(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${author.token}`)
      .expect(200);

    await comment({ ...author, postId }).expect(404);
  });

  it("still flags a deleted post and comment for the previous release", async () => {
    const author = await member();
    const postId = await createPost(author.token);
    const commentId = (await comment({ ...author, postId }).expect(201)).body
      .id;

    await deleteComment(author.token, commentId).expect(200);
    await request(server())
      .delete(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${author.token}`)
      .expect(200);

    for (const [table, id] of [
      ["post", postId],
      ["comment", commentId],
    ] as const) {
      expect(
        await ctx.dataSource.query(
          `SELECT "deleted", "deletedAt" IS NOT NULL AS "hidden" FROM "${table}" WHERE "id" = $1`,
          [id],
        ),
      ).toEqual([{ deleted: true, hidden: true }]);
    }
  });

  it.each(["expertIds", "authorIds"] as const)(
    "refuses a deleted account in a post's %s",
    async (key) => {
      const author = await member();
      const postId = await createPost(author.token);
      const departed = await member();
      await userRepo.softDelete(departed.user.id);

      await request(server())
        .patch(`/forum/admin/posts/${postId}/settings`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          expertIds: [],
          authorIds: [author.user.id],
          qaMode: false,
          [key]: [author.user.id, departed.user.id],
        } satisfies UpdatePostSettingsDto)
        .expect(400);
    },
  );

  it("refuses a post or comment by an account deleted while it waits", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const forum = ctx.app.get(ForumService);
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: User,
        ids: [author.user.id],
      });
      const settle = (write: Promise<unknown>) =>
        write.then(
          () => "written",
          (error: unknown) => error,
        );
      const posted = settle(
        forum.createPost(
          {
            title: "Raced",
            editableContent: { body: "Raced", attachments: [] },
          },
          author.user.id,
        ),
      );
      const commented = settle(
        forum.createComment(
          {
            parentObjectType: CommentParentObject.Post,
            parentObjectId: postId,
            editableContent: { body: "Raced", attachments: [] },
          },
          author.user.id,
        ),
      );
      await waitForLockWait(ctx.dataSource, 2);
      await deletion.commitTransaction();
      expect(await posted).toBeInstanceOf(NotFoundException);
      expect(await commented).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await ctx.dataSource
        .getRepository(Post)
        .countBy({ authorId: author.user.id }),
    ).toBe(0);
  });
});

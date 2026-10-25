import { ActionStatus } from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { CommentDto } from "src/forum/dto/comment.dto";
import type { PostDto, UpdatePostSettingsDto } from "src/forum/dto/post.dto";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { ForumCommentQueryService } from "src/forum/forum-comment-query.service";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, TestContext } from "./e2e-test-utils";
import { createForumSoftDeleteFixtures } from "./forum-soft-delete-fixtures";

describe("Forum deletion lifecycle (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  const { server, member, createPost, comment, deleteComment, thread } =
    createForumSoftDeleteFixtures(() => ctx);

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
    await request(server())
      .post(`/forum/comments/${parent.id}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(201);

    await deleteComment(author.token, parent.id).expect(200);

    const [placeholder] = await thread(postId);
    expect(placeholder).toMatchObject({
      id: parent.id,
      deleted: true,
      author: { id: author.user.id },
      editableContent: { body: "", attachments: [] },
      likes: [],
      likesCount: 0,
      children: [expect.objectContaining({ id: reply.id, deleted: false })],
    });
    expect(placeholder.likedByMe).toBeUndefined();
    expect(
      await ctx.dataSource.getRepository(Comment).findOneOrFail({
        where: { id: parent.id },
        relations: { editableContent: true },
        withDeleted: true,
      }),
    ).toMatchObject({
      editableContent: {
        body: "A comment",
        attachments: ["attachment-key.webp"],
      },
    });
  });

  it("leaves a soft-deleted liker out of a deleted comment's loaded likes", async () => {
    const author = await member();
    const liker = await member();
    const deletedLiker = await member();
    const postId = await createPost(ctx.accessToken);
    const deleted = (await comment({ ...author, postId }).expect(201)).body;
    for (const { token } of [liker, deletedLiker]) {
      await request(server())
        .post(`/forum/comments/${deleted.id}/like`)
        .set("Authorization", `Bearer ${token}`)
        .expect(201);
    }

    await userRepo.softDelete(deletedLiker.user.id);
    await deleteComment(author.token, deleted.id).expect(200);

    const [loaded] = await ctx.app
      .get(ForumCommentQueryService)
      .findCommentsForPost(postId);
    expect(loaded.likes!.map((user) => user.id)).toEqual([liker.user.id]);
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

  it("refuses to edit, like, unlike, or pin a deleted comment", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const deleted = (await comment({ ...author, postId }).expect(201)).body;
    await request(server())
      .post(`/forum/comments/${deleted.id}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(201);
    await deleteComment(author.token, deleted.id).expect(200);

    await request(server())
      .patch(`/forum/comments/${deleted.id}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ editableContent: { body: "Edited", attachments: [] } })
      .expect(404);
    await request(server())
      .post(`/forum/comments/${deleted.id}/like`)
      .set("Authorization", `Bearer ${author.token}`)
      .expect(404);
    await request(server())
      .post(`/forum/comments/${deleted.id}/unlike`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(404);
    await request(server())
      .patch(`/forum/admin/comments/${deleted.id}/pin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
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

  it("leaves a comment its author deleted out of previews and comment lists", async () => {
    const author = await member();
    const postId = await createPost(ctx.accessToken);
    const kept = (await comment({ ...author, postId }).expect(201)).body;
    const deleted = (await comment({ ...author, postId }).expect(201)).body;
    await deleteComment(author.token, deleted.id).expect(200);

    const posts = await request(server())
      .get("/forum/posts")
      .set("Authorization", `Bearer ${author.token}`)
      .expect(200);
    expect(
      posts.body.find((post: PostDto) => post.id === postId)?.lastComment?.id,
    ).toBe(kept.id);
    const listed = await request(server())
      .get(`/forum/posts/user/${author.user.id}/comments`)
      .expect(200);
    expect(listed.body.map((entry: CommentDto) => entry.id)).toEqual([kept.id]);
    expect(
      (
        await ctx.app
          .get(ForumCommentQueryService)
          .findForumCommentsByUserForFeed({
            authorId: author.user.id,
            limit: 10,
          })
      ).map((entry) => entry.comment.id),
    ).toEqual([kept.id]);
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
});

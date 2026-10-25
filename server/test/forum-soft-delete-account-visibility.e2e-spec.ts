import {
  GlobalFeedItemDto,
  GlobalFeedItemType,
} from "src/actions/dto/action-feed.dto";
import { Cluster } from "src/cluster/entities/cluster.entity";
import { CommentDto } from "src/forum/dto/comment.dto";
import type { PostDto } from "src/forum/dto/post.dto";
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

describe("Forum account visibility (e2e)", () => {
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
      (
        await ctx.app
          .get(ForumCommentQueryService)
          .findCommentsForPostRaw(postId)
      ).map((entry) => entry.id),
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

  it("refuses likes and edits on a reply under a soft-deleted account's comment", async () => {
    const departing = await member();
    const replier = await member();
    const liker = await member();
    const postId = await createPost(ctx.accessToken);
    const parent = (await comment({ ...departing, postId }).expect(201)).body;
    const reply = (
      await comment({ ...replier, postId, parentId: parent.id }).expect(201)
    ).body;
    await request(server())
      .post(`/forum/comments/${reply.id}/like`)
      .set("Authorization", `Bearer ${liker.token}`)
      .expect(201);

    await userRepo.softDelete(departing.user.id);

    for (const action of ["like", "unlike"]) {
      await request(server())
        .post(`/forum/comments/${reply.id}/${action}`)
        .set("Authorization", `Bearer ${liker.token}`)
        .expect(404);
    }
    await request(server())
      .get(`/likes/comment/${reply.id}/users`)
      .set("Authorization", `Bearer ${liker.token}`)
      .expect(404);
    await request(server())
      .patch(`/forum/comments/${reply.id}`)
      .set("Authorization", `Bearer ${replier.token}`)
      .send({ editableContent: { body: "Edited", attachments: [] } })
      .expect(404);
    await request(server())
      .patch(`/forum/admin/comments/${reply.id}/pin`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
    expect(
      await ctx.dataSource
        .getRepository(Comment)
        .findOneByOrFail({ id: reply.id }),
    ).toMatchObject({ pinned: false });
  });

  it("leaves a soft-deleted account's reply out of its parent author's notifications", async () => {
    const author = await member();
    const departing = await member();
    const postId = await createPost(ctx.accessToken);
    const parent = (await comment({ ...author, postId }).expect(201)).body;
    await comment({
      ...departing,
      postId,
      parentId: parent.id,
      body: "words of the departed",
    }).expect(201);
    const inbox = async () =>
      JSON.stringify(
        (
          await request(server())
            .get("/notifs")
            .set("Authorization", `Bearer ${author.token}`)
            .expect(200)
        ).body,
      );
    expect(await inbox()).toContain("words of the departed");

    await userRepo.softDelete(departing.user.id);

    expect(await inbox()).not.toContain("words of the departed");
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
    const forum = ctx.app.get(ForumCommentQueryService);
    let parentObjects = 0;
    const threadUnder = async (parentObjectType: CommentParentObject) => {
      const parentObjectId = 900000 + parentObjects++;
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
      (
        await ctx.app
          .get(ForumCommentQueryService)
          .findCommentsForPostRaw(postId)
      ).map((entry) => entry.id),
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
    const reply = (
      await comment({ ...staying, postId, parentId: hidden.id }).expect(201)
    ).body;
    await comment({ ...staying, postId, parentId: reply.id }).expect(201);

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
        await ctx.app
          .get(ForumCommentQueryService)
          .findForumCommentsByUserForFeed({
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
});

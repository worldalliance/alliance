import { CommentParentObject } from "src/forum/entities/comment.entity";
import { LegacyDeletedFlagService } from "src/forum/legacy-deleted-flag.service";
import request from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Legacy forum deleted flag (e2e)", () => {
  let ctx: TestContext;

  const server = () => ctx.app.getHttpServer();
  const auth = () => `Bearer ${ctx.accessToken}`;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    // createTestApp rebuilds the schema after boot, which drops the trigger.
    await ctx.app.get(LegacyDeletedFlagService).onApplicationBootstrap();
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const createPost = async (): Promise<number> =>
    (
      await request(server())
        .post("/forum/posts")
        .set("Authorization", auth())
        .send({
          title: "Discussion",
          editableContent: { body: "Post body", attachments: [] },
        })
        .expect(201)
    ).body.id;

  it("hides a post the previous release deletes by its flag alone", async () => {
    const postId = await createPost();

    await ctx.dataSource.query(
      `UPDATE "post" SET "deleted" = true WHERE id = $1`,
      [postId],
    );

    await request(server())
      .get(`/forum/posts/${postId}`)
      .set("Authorization", auth())
      .expect(404);
  });

  it("hides a comment the previous release deletes by its flag alone", async () => {
    const postId = await createPost();
    const commentId = (
      await request(server())
        .post("/forum/comments")
        .set("Authorization", auth())
        .send({
          parentObjectType: CommentParentObject.Post,
          parentObjectId: postId,
          editableContent: { body: "Legacy-deleted comment", attachments: [] },
        })
        .expect(201)
    ).body.id;

    await ctx.dataSource.query(
      `UPDATE "comment" SET "deleted" = true WHERE id = $1`,
      [commentId],
    );

    const [{ deletedAt }] = await ctx.dataSource.query(
      `SELECT "deletedAt" FROM "comment" WHERE id = $1`,
      [commentId],
    );
    expect(deletedAt).not.toBeNull();
    const thread = (
      await request(server())
        .get(`/forum/posts/${postId}/comments`)
        .set("Authorization", auth())
        .expect(200)
    ).body;
    expect(JSON.stringify(thread)).not.toContain("Legacy-deleted comment");
  });

  it("stamps a post the previous release deleted before this build booted", async () => {
    const postId = await createPost();
    await ctx.dataSource.query(
      `DROP TRIGGER "post_stamp_legacy_deleted" ON "post"`,
    );
    await ctx.dataSource.query(
      `UPDATE "post" SET "deleted" = true WHERE id = $1`,
      [postId],
    );

    await ctx.app.get(LegacyDeletedFlagService).onApplicationBootstrap();

    await request(server())
      .get(`/forum/posts/${postId}`)
      .set("Authorization", auth())
      .expect(404);
  });

  it("keeps the time a row was already deleted at", async () => {
    const postId = await createPost();
    const deletedAt = new Date("2026-01-01T00:00:00Z");
    await ctx.dataSource.query(
      `UPDATE "post" SET "deletedAt" = $2 WHERE id = $1`,
      [postId, deletedAt],
    );

    await ctx.dataSource.query(
      `UPDATE "post" SET "deleted" = true WHERE id = $1`,
      [postId],
    );

    const [row] = await ctx.dataSource.query(
      `SELECT "deletedAt" FROM "post" WHERE id = $1`,
      [postId],
    );
    expect(row.deletedAt).toEqual(deletedAt);
  });
});

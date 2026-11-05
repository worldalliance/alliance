import { PostTag } from "src/forum/entities/post-tag.entity";
import request from "supertest";
import { createTestApp, type TestContext } from "./e2e-test-utils";

describe("Forum post records across endpoints (e2e)", () => {
  let ctx: TestContext;
  let postId: number;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    const created = await request(ctx.app.getHttpServer())
      .post("/forum/posts")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        title: "Post records",
        editableContent: { body: "Body", attachments: [] },
      })
      .expect(201);
    postId = created.body.id;
    await ctx.dataSource
      .getRepository(PostTag)
      .save({ postId, name: "Records tag" });
    await request(ctx.app.getHttpServer())
      .post(`/forum/posts/${postId}/like`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(201);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const get = (path: string) =>
    request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

  it("sends the post's likes and tags from every endpoint clients load it from", async () => {
    const index = await get("/forum/posts");
    const profile = await get(`/forum/posts/user/${ctx.testUserId}`);
    const detail = await get(`/forum/posts/${postId}`);
    const updated = await request(ctx.app.getHttpServer())
      .patch(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ title: "Post records" })
      .expect(200);

    const record = {
      likedByMe: true,
      likeCount: 1,
      likes: [{ id: ctx.testUserId }],
      tags: [{ name: "Records tag" }],
    };
    expect({
      index: index.body.find(({ id }: { id: number }) => id === postId),
      profile: profile.body.find(({ id }: { id: number }) => id === postId),
      detail: detail.body,
      updated: updated.body,
    }).toMatchObject({
      index: record,
      profile: record,
      detail: record,
      updated: record,
    });
  });
});

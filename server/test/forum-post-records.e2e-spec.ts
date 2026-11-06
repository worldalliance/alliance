import { LIKE_FACEPILE_LIMIT } from "@alliance/common/likeOrder";
import { Cluster } from "src/cluster/entities/cluster.entity";
import { PostTag } from "src/forum/entities/post-tag.entity";
import { Post } from "src/forum/entities/post.entity";
import { LikesModule } from "src/likes/likes.module";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import {
  createTestApp,
  giveActiveContract,
  type TestContext,
} from "./e2e-test-utils";

describe("Forum post records across endpoints (e2e)", () => {
  let ctx: TestContext;
  let postId: number;

  beforeAll(async () => {
    ctx = await createTestApp([LikesModule]);
    const created = await request(ctx.app.getHttpServer())
      .post("/forum/posts")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        title: "Post records",
        editableContent: { body: "Body", attachments: [] },
      })
      .expect(201);
    postId = created.body.id;
    const cluster = await ctx.dataSource
      .getRepository(Cluster)
      .save({ displayName: "Records cluster" });
    const users = ctx.dataSource.getRepository(User);
    await users.update(ctx.testUserId, { cluster: { id: cluster.id } });
    const otherLikers = await users.save(
      Array.from({ length: LIKE_FACEPILE_LIMIT }, (_, i) =>
        users.create({
          email: `records-liker-${i}@example.com`,
          password: "pass",
          name: `Records Liker ${i}`,
          tags: [ctx.defaultTag],
          cluster: { id: cluster.id },
        }),
      ),
    );
    for (const { id } of [{ id: ctx.testUserId }, ...otherLikers]) {
      await giveActiveContract(ctx, id);
    }
    await ctx.dataSource
      .createQueryBuilder()
      .relation(Post, "likes")
      .of(postId)
      .add(otherLikers.map(({ id }) => id));
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
    const likers = await get(
      `/likes/post/${postId}/users?limit=${LIKE_FACEPILE_LIMIT}`,
    );
    const updated = await request(ctx.app.getHttpServer())
      .patch(`/forum/posts/${postId}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({ title: "Post records" })
      .expect(200);

    expect(likers.body).toMatchObject(
      Array.from({ length: LIKE_FACEPILE_LIMIT }, () => ({
        cluster: { displayName: "Records cluster" },
        lastContractEvent: { type: ContractEventType.SIGNED },
      })),
    );
    const record = {
      likedByMe: true,
      likeCount: LIKE_FACEPILE_LIMIT + 1,
      likes: likers.body,
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

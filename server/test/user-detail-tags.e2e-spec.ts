import request from "supertest";
import { Tag } from "../src/user/entities/tag.entity";
import { User } from "../src/user/entities/user.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin user detail tags (e2e)", () => {
  let ctx: TestContext;
  let tagged: User;
  let untagged: User;
  let taggedTagIds: string[];

  beforeAll(async () => {
    ctx = await createTestApp([]);
    const otherTag = await ctx.dataSource
      .getRepository(Tag)
      .save({ name: "Other Tag", description: "Other Tag" });
    const userRepo = ctx.dataSource.getRepository(User);
    tagged = await userRepo.save(
      userRepo.create({
        name: "Tagged",
        email: "tagged@example.com",
        password: "pass",
        tags: [ctx.defaultTag, otherTag],
      }),
    );
    taggedTagIds = [ctx.defaultTag.id, otherTag.id].sort();
    untagged = await userRepo.save(
      userRepo.create({
        name: "Untagged",
        email: "untagged@example.com",
        password: "pass",
        tags: [],
      }),
    );
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const tagIdsOf = (body: { tags: { id: string }[] }) =>
    body.tags.map((tag) => tag.id).sort();

  const getDetail = (id: number) =>
    request(ctx.app.getHttpServer())
      .get(`/user/userdetail/${id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

  it("returns a member's tags", async () => {
    expect(tagIdsOf((await getDetail(tagged.id)).body)).toEqual(taggedTagIds);
    expect((await getDetail(untagged.id)).body.tags).toEqual([]);
  });

  it("returns a member's tags after an admin changes their roles", async () => {
    const res = await request(ctx.app.getHttpServer())
      .patch(`/user/userdetail/${tagged.id}/roles`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ staff: true })
      .expect(200);

    expect(tagIdsOf(res.body)).toEqual(taggedTagIds);
  });
});

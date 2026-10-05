import request from "supertest";
import { Tag } from "../src/user/entities/tag.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin tags (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource
      .getRepository(Tag)
      .delete({ description: "tags-admin e2e" });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const post = (path: string, body: object) =>
    request(ctx.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const createBody = (publicDisplayName: unknown) => ({
    name: "Volunteers",
    description: "tags-admin e2e",
    publicDisplayName,
  });

  it("clears a public display name updated to null", async () => {
    const created = await post("/user/createTag", createBody("Helpers"));
    expect(created.status).toBe(201);
    expect(created.body.publicDisplayName).toBe("Helpers");

    const updated = await post(
      `/user/tags/${created.body.id}/update`,
      createBody(null),
    );

    expect(updated.status).toBe(201);
    expect(updated.body.publicDisplayName).toBeNull();
    const saved = await ctx.dataSource
      .getRepository(Tag)
      .findOneByOrFail({ id: created.body.id });
    expect(saved.publicDisplayName).toBeNull();
  });

  it("returns a tag's users after adding and removing one", async () => {
    const created = await post("/user/createTag", createBody("Helpers"));
    const userIds = (response: request.Response) =>
      response.body.users.map((user: { id: number }) => user.id);

    const added = await post(`/user/tags/${created.body.id}/addUser`, {
      userId: ctx.testUserId,
    });
    expect(added.status).toBe(201);
    expect(userIds(added)).toEqual([ctx.testUserId]);

    const removed = await post(`/user/tags/${created.body.id}/removeUser`, {
      userId: ctx.testUserId,
    });
    expect(removed.status).toBe(201);
    expect(userIds(removed)).toEqual([]);
  });

  it.each([
    ["missing", undefined],
    ["not a string", 42],
  ])("rejects a public display name that is %s", async (_, value) => {
    const response = await post("/user/createTag", createBody(value));

    expect(response.status).toBe(400);
  });
});

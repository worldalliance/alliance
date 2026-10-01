import request from "supertest";
import { Tag } from "../src/user/entities/tag.entity";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Admin tag public display name (e2e)", () => {
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

  it("rejects a public display name that is not a string", async () => {
    const response = await post("/user/createTag", createBody(42));

    expect(response.status).toBe(400);
  });
});

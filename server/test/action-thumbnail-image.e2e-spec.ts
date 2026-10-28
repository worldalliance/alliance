import request from "supertest";
import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import { createActionAsAdmin, patchActionAsAdmin } from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-thumbnail-image e2e";
const thumbnail = "https://example.com/promo.png";

describe("Action thumbnail image (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterEach(async () => {
    await ctx.dataSource
      .getRepository(Action)
      .delete({ name: Like(`${NAME_PREFIX}%`) });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const create = (body: Partial<CreateActionDto>) =>
    createActionAsAdmin(ctx, { name: NAME_PREFIX, ...body });

  const patch = (id: number, body: Record<string, unknown>) =>
    patchActionAsAdmin(ctx, id, body);

  const storedThumbnail = async (id: number) =>
    (await ctx.dataSource.getRepository(Action).findOneByOrFail({ id }))
      .squareThumbnailImage;

  it("stores a typed thumbnail trimmed", async () => {
    const created = await create({
      squareThumbnailImage: `  ${thumbnail} `,
    }).expect(201);
    expect(created.body.squareThumbnailImage).toBe(thumbnail);
    expect(await storedThumbnail(created.body.id)).toBe(thumbnail);
  });

  it.each(["", "   "])("stores a thumbnail of %p as null", async (blank) => {
    const created = await create({ squareThumbnailImage: thumbnail }).expect(
      201,
    );
    await patch(created.body.id, { squareThumbnailImage: blank }).expect(200);
    expect(await storedThumbnail(created.body.id)).toBeNull();
  });

  it.each(["", "   "])(
    "stores a thumbnail of %p on a new action as null",
    async (blank) => {
      const created = await create({ squareThumbnailImage: blank }).expect(201);
      expect(await storedThumbnail(created.body.id)).toBeNull();
    },
  );

  it.each(["", "   "])(
    "stores a pasted thumbnail of %p as null",
    async (blank) => {
      const created = await create({}).expect(201);
      const exported = await request(ctx.app.getHttpServer())
        .get(`/actions/export/${created.body.id}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const imported = await request(ctx.app.getHttpServer())
        .post("/actions/pasteJson")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          body: JSON.stringify({
            ...exported.body,
            name: NAME_PREFIX,
            squareThumbnailImage: blank,
          }),
        })
        .expect(201);
      expect(await storedThumbnail(imported.body.id)).toBeNull();
    },
  );

  it("rejects a thumbnail that isn't a string", async () => {
    const created = await create({}).expect(201);
    await patch(created.body.id, { squareThumbnailImage: 5 }).expect(400);
  });
});

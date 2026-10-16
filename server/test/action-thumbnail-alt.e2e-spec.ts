import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-thumbnail-alt e2e";

describe("Action thumbnail alt (e2e)", () => {
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

  const storedAlt = async (id: number) =>
    (await ctx.dataSource.getRepository(Action).findOneByOrFail({ id }))
      .squareThumbnailImageAlt;

  it("returns null for the alt on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.squareThumbnailImageAlt).toBeNull();

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.squareThumbnailImageAlt).toBeNull();
  });

  it("keeps the alt when a patch leaves it out and clears it with null", async () => {
    const created = await create({
      squareThumbnailImageAlt: "A cup of coffee",
    }).expect(201);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.squareThumbnailImageAlt).toBe("A cup of coffee");

    const cleared = await patch(created.body.id, {
      squareThumbnailImageAlt: null,
    }).expect(200);
    expect(cleared.body.squareThumbnailImageAlt).toBeNull();
    expect(await storedAlt(created.body.id)).toBeNull();
  });

  it("stores a typed alt trimmed", async () => {
    const created = await create({
      squareThumbnailImageAlt: "  A cup of coffee ",
    }).expect(201);
    expect(created.body.squareThumbnailImageAlt).toBe("A cup of coffee");
    expect(await storedAlt(created.body.id)).toBe("A cup of coffee");
  });

  it.each(["", "   "])("stores an alt of %p as null", async (blank) => {
    const created = await create({
      squareThumbnailImageAlt: "A cup of coffee",
    }).expect(201);
    const blanked = await patch(created.body.id, {
      squareThumbnailImageAlt: blank,
    }).expect(200);
    expect(blanked.body.squareThumbnailImageAlt).toBeNull();
    expect(await storedAlt(created.body.id)).toBeNull();
  });

  it("rejects an alt that isn't a string", async () => {
    const created = await create({}).expect(201);
    await patch(created.body.id, { squareThumbnailImageAlt: 5 }).expect(400);
  });
});

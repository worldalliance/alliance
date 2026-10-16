import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import { createActionAsAdmin, patchActionAsAdmin } from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-short-description e2e";

describe("Action short description (e2e)", () => {
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

  const storedShortDescription = async (id: number) =>
    (await ctx.dataSource.getRepository(Action).findOneByOrFail({ id }))
      .shortDescription;

  it("rejects a create without a short description", async () => {
    await create({ shortDescription: undefined }).expect(400);
    expect(
      await ctx.dataSource
        .getRepository(Action)
        .countBy({ name: Like(`${NAME_PREFIX}%`) }),
    ).toBe(0);
  });

  it.each([null, 5])(
    "rejects a short description of %p",
    async (shortDescription) => {
      const created = await create({ shortDescription: "Short" }).expect(201);
      await patchActionAsAdmin(ctx, created.body.id, {
        shortDescription,
      }).expect(400);
      expect(await storedShortDescription(created.body.id)).toBe("Short");
    },
  );

  it("keeps the short description when a patch leaves it out and stores a blank one", async () => {
    const created = await create({ shortDescription: "Short" }).expect(201);

    const renamed = await patchActionAsAdmin(ctx, created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.shortDescription).toBe("Short");

    const blanked = await patchActionAsAdmin(ctx, created.body.id, {
      shortDescription: "",
    }).expect(200);
    expect(blanked.body.shortDescription).toBe("");
    expect(await storedShortDescription(created.body.id)).toBe("");
  });
});

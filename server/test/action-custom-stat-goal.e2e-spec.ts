import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-custom-stat-goal e2e";

describe("Action custom stat goal (e2e)", () => {
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

  it("returns null for the goal on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.customStatGoal).toBeNull();

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.customStatGoal).toBeNull();
  });

  it("sets the goal, keeps it when a patch leaves it out, and clears it with null", async () => {
    const created = await create({ customStatGoal: 50 }).expect(201);
    expect(created.body.customStatGoal).toBe(50);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.customStatGoal).toBe(50);

    const cleared = await patch(created.body.id, {
      customStatGoal: null,
    }).expect(200);
    expect(cleared.body.customStatGoal).toBeNull();

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.customStatGoal).toBeNull();
  });

  it.each(["", "50", 1.5, -1, 2_147_483_648, true])(
    "rejects a goal of %p",
    async (customStatGoal) => {
      const created = await create({}).expect(201);
      await patch(created.body.id, { customStatGoal }).expect(400);
    },
  );
});

import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-time-estimate e2e";

describe("Action time estimate (e2e)", () => {
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

  it("returns null for the time estimate on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body.timeEstimate).toBeNull();

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.timeEstimate).toBeNull();
  });

  it("sets the time estimate, keeps it when a patch leaves it out, and clears it with null", async () => {
    const created = await create({ timeEstimate: 15 }).expect(201);
    expect(created.body.timeEstimate).toBe(15);

    const renamed = await patch(created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.timeEstimate).toBe(15);

    const cleared = await patch(created.body.id, {
      timeEstimate: null,
    }).expect(200);
    expect(cleared.body.timeEstimate).toBeNull();

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: created.body.id });
    expect(stored.timeEstimate).toBeNull();
  });

  it("accepts a zero time estimate", async () => {
    const created = await create({}).expect(201);
    const zeroed = await patch(created.body.id, { timeEstimate: 0 }).expect(
      200,
    );
    expect(zeroed.body.timeEstimate).toBe(0);
  });

  it.each(["", "15", 1.5, -1, 2_147_483_648, true])(
    "rejects a time estimate of %p",
    async (timeEstimate) => {
      const created = await create({}).expect(201);
      await patch(created.body.id, { timeEstimate }).expect(400);
    },
  );
});

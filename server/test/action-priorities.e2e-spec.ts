import request from "supertest";
import { Like } from "typeorm";
import { Action } from "../src/actions/entities/action.entity";
import { GeneralUpdate } from "../src/actions/entities/general-update.entity";
import { GeneralUpdatesService } from "../src/actions/general-updates.service";
import { createActionAsAdmin } from "./action-requests";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-priorities e2e";

describe("Action priorities (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await ctx.dataSource
      .getRepository(Action)
      .delete({ name: Like(`${NAME_PREFIX}%`) });
    await ctx.dataSource
      .getRepository(GeneralUpdate)
      .delete({ name: Like(`${NAME_PREFIX}%`) });
    await closeTestApp(ctx.app);
  });

  it("sets the priority of each listed action and general update", async () => {
    const action = await createActionAsAdmin(ctx, {
      name: NAME_PREFIX,
    }).expect(201);
    const update = await ctx.app
      .get(GeneralUpdatesService)
      .createGeneralUpdate({
        name: `${NAME_PREFIX} update`,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86_400_000),
        useManualCohort: false,
        manualCohortUserIds: [],
        tagIds: [],
      });

    await request(ctx.app.getHttpServer())
      .post("/actions/priorities")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        actionPriorities: [{ id: action.body.id, priority: 41 }],
        generalUpdatePriorities: [{ id: update.id, priority: 42 }],
      })
      .expect(201);

    const stored = await ctx.dataSource
      .getRepository(Action)
      .findOneByOrFail({ id: action.body.id });
    expect(stored.priority).toBe(41);
    const storedUpdate = await ctx.dataSource
      .getRepository(GeneralUpdate)
      .findOneByOrFail({ id: update.id });
    expect(storedUpdate.priority).toBe(42);
  });
});

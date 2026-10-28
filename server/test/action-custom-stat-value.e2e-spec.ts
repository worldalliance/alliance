import request from "supertest";
import { Like } from "typeorm";
import { Action } from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  createActionDefaults,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-custom-stat-value e2e";

describe("Action custom stat value (e2e)", () => {
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

  const stored = (id: number) =>
    ctx.dataSource.getRepository(Action).findOneByOrFail({ id });

  it("ignores a value sent on create", async () => {
    const created = await request(ctx.app.getHttpServer())
      .post("/actions/create")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ ...createActionDefaults, name: NAME_PREFIX, customStatValue: 7 })
      .expect(201);

    expect((await stored(created.body.id)).customStatValue).toBeNull();
  });

  it("keeps the computed value when a patch sends another", async () => {
    const created = await createActionAsAdmin(ctx, {
      name: NAME_PREFIX,
    }).expect(201);
    await ctx.dataSource
      .getRepository(Action)
      .update(created.body.id, { customStatValue: 3 });

    await patchActionAsAdmin(ctx, created.body.id, {
      customStatValue: 7,
    }).expect(200);

    expect((await stored(created.body.id)).customStatValue).toBe(3);
  });
});

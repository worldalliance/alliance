import request from "supertest";
import { Like } from "typeorm";
import {
  Action,
  CustomActionStat,
} from "../src/actions/entities/action.entity";
import {
  createActionAsAdmin,
  createActionDefaults,
  getActionAsAdmin,
  patchActionAsAdmin,
} from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-custom-stat-type e2e";

describe("Action custom stat type (e2e)", () => {
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

  it("stores none for an action created without a stat type", async () => {
    const created = await createActionAsAdmin(ctx, {
      name: NAME_PREFIX,
    }).expect(201);
    expect(created.body.customStatType).toBe(CustomActionStat.NONE);

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body.customStatType).toBe(CustomActionStat.NONE);
  });

  it("keeps the stat type when a patch leaves it out", async () => {
    const created = await createActionAsAdmin(ctx, {
      name: NAME_PREFIX,
      customStatType: CustomActionStat.USERS_INVITED,
    }).expect(201);

    const renamed = await patchActionAsAdmin(ctx, created.body.id, {
      name: `${NAME_PREFIX} renamed`,
    }).expect(200);
    expect(renamed.body.customStatType).toBe(CustomActionStat.USERS_INVITED);
  });

  it("imports an export taken while the stat type could be null as none", async () => {
    const created = await createActionAsAdmin(ctx, {
      name: NAME_PREFIX,
    }).expect(201);
    const exported = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${created.body.id}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    const imported = await request(ctx.app.getHttpServer())
      .post("/actions/pasteJson")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        body: JSON.stringify({ ...exported.body, customStatType: null }),
      })
      .expect(201);
    expect(
      (
        await ctx.dataSource
          .getRepository(Action)
          .findOneByOrFail({ id: imported.body.id })
      ).customStatType,
    ).toBe(CustomActionStat.NONE);
  });

  it.each([null, "page_views"])(
    "rejects %p as a stat type on create and on patch",
    async (customStatType) => {
      await request(ctx.app.getHttpServer())
        .post("/actions/create")
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({ ...createActionDefaults, name: NAME_PREFIX, customStatType })
        .expect(400);

      const created = await createActionAsAdmin(ctx, {
        name: NAME_PREFIX,
      }).expect(201);
      await patchActionAsAdmin(ctx, created.body.id, {
        customStatType,
      }).expect(400);
    },
  );
});

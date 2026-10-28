import request from "supertest";
import { Like } from "typeorm";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { Action } from "../src/actions/entities/action.entity";
import { createActionAsAdmin, getActionAsAdmin } from "./action-requests";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAME_PREFIX = "action-cohort-expression e2e";

describe("Action cohort expression (e2e)", () => {
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

  const asAdmin = (path: string) =>
    request(ctx.app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  it("returns null for the expression on an action created without it", async () => {
    const created = await create({}).expect(201);
    expect(created.body).toHaveProperty("cohortExpression", null);

    const fetched = await getActionAsAdmin(ctx, created.body.id).expect(200);
    expect(fetched.body).toHaveProperty("cohortExpression", null);

    const listed = await asAdmin("/actions/all").expect(200);
    const listItem = listed.body.find(
      (action: { id: number }) => action.id === created.body.id,
    );
    expect(listItem).toHaveProperty("cohortExpression", null);

    const exported = await asAdmin(`/actions/export/${created.body.id}`).expect(
      200,
    );
    expect(exported.body).toHaveProperty("cohortExpression", null);
  });
});

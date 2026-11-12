import request from "supertest";
import { TasksModule } from "../src/tasks/tasks.module";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("Running a stored validator of a removed type (e2e)", () => {
  let ctx: TestContext;
  let validatorId: number;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    const [row] = await ctx.dataSource.query(
      `INSERT INTO "custom_validator" ("type", "expression") VALUES ('CustomExpression', '(u) => true') RETURNING "id"`,
    );
    validatorId = row.id;
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("fails instead of passing", async () => {
    const response = await request(ctx.app.getHttpServer())
      .post(`/tasks/runValidator/${validatorId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({});

    expect(response.status).toBe(500);
    expect(response.body.isValid).toBeUndefined();
  });
});

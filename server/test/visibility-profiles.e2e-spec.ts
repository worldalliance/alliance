import request from "supertest";
import {
  CustomValidator,
  CustomValidatorType,
} from "../src/tasks/entities/customvalidator.entity";
import { FormResponse } from "../src/tasks/entities/formresponse.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import { Tag } from "../src/user/entities/tag.entity";
import { User } from "../src/user/entities/user.entity";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";

describe("Grouping members by what a form shows them (e2e)", () => {
  let ctx: TestContext;
  let validatorId: number;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    const tag = await ctx.dataSource
      .getRepository(Tag)
      .save({ name: "Profiled", description: "Profiled" });
    const users = ctx.dataSource.getRepository(User);
    const member = await users.findOneOrFail({
      where: { id: ctx.testUserId },
      relations: { tags: true },
    });
    await users.save({ ...member, tags: [...(member.tags ?? []), tag] });
    ({ id: validatorId } = await ctx.dataSource
      .getRepository(CustomValidator)
      .save({
        type: CustomValidatorType.MemberTag,
        idArgument: tag.id,
        expression: null,
      }));
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const showingIf = (conditions: Record<string, unknown>[]) => ({
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "q",
            type: "input",
            kind: "text",
            label: "Gated",
            visibleIfFormula: {
              formula: conditions
                .map((_, i) => `condition${i + 1}`)
                .join(" AND "),
              conditions: Object.fromEntries(
                conditions.map((condition, i) => [
                  `condition${i + 1}`,
                  condition,
                ]),
              ),
            },
          },
        ],
      },
    ],
    outputViews: [],
  });

  const validator = () => ({ kind: "validator", validatorId });

  const profile = (params: {
    schema: Record<string, unknown>;
    userIds?: number[];
    token?: string;
  }) =>
    request(ctx.app.getHttpServer())
      .post("/tasks/visibilityProfiles")
      .set("Authorization", `Bearer ${params.token ?? ctx.adminAccessToken}`)
      .send({
        schema: params.schema,
        userIds: params.userIds ?? [ctx.testUserId, ctx.adminUserId],
      });

  it("puts members whose conditions come out differently in different groups", async () => {
    const response = await profile({ schema: showingIf([validator()]) });

    expect(response.status).toBe(201);
    expect(response.body.profiles).toEqual(
      expect.arrayContaining([
        { results: [true], userIds: [ctx.testUserId] },
        { results: [false], userIds: [ctx.adminUserId] },
      ]),
    );
  });

  it("counts a member listed twice once", async () => {
    const response = await profile({
      schema: showingIf([validator()]),
      userIds: [ctx.testUserId, ctx.testUserId],
    });

    expect(response.body.profiles).toEqual([
      { results: [true], userIds: [ctx.testUserId] },
    ]);
  });

  it("puts everyone in one group when nothing depends on the member", async () => {
    const response = await profile({
      schema: showingIf([{ kind: "deviceType", deviceType: ["mobile"] }]),
    });

    expect(response.body.profiles).toEqual([
      { results: [], userIds: [ctx.testUserId, ctx.adminUserId] },
    ]);
  });

  it("reads each member's own answer to an earlier form", async () => {
    const { form, snapshot } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Earlier",
      schema: { pages: [], outputViews: [] },
    });
    await ctx.dataSource.getRepository(FormResponse).save({
      formId: form.id,
      formSnapshotId: snapshot.id,
      answers: { pet: "dog" },
      user: { id: ctx.adminUserId },
    });

    const response = await profile({
      schema: showingIf([
        { kind: "equals", when: "pet", equals: "dog", sourceFormId: form.id },
      ]),
    });

    expect(response.body.profiles).toEqual(
      expect.arrayContaining([
        { results: [false], userIds: [ctx.testUserId] },
        { results: [true], userIds: [ctx.adminUserId] },
      ]),
    );
  });

  it("reads each member's account, one verdict per condition", async () => {
    const users = ctx.dataSource.getRepository(User);
    await users.update(ctx.testUserId, { customCityString: "Springfield" });
    await users.update(ctx.adminUserId, { customCityString: null });

    const response = await profile({
      schema: showingIf([
        validator(),
        { kind: "userHasCity", userHasCity: true },
      ]),
    });

    expect(response.body.profiles).toEqual(
      expect.arrayContaining([
        { results: [true, true], userIds: [ctx.testUserId] },
        { results: [false, false], userIds: [ctx.adminUserId] },
      ]),
    );
  });

  it("names what is wrong with a schema it can't read", async () => {
    const response = await profile({ schema: { pages: [] } });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("outputViews");
  });

  it("refuses a member", async () => {
    const response = await profile({
      schema: showingIf([validator()]),
      token: ctx.accessToken,
    });

    expect(response.status).toBe(401);
  });

  it("lets an admin read a member's visibility context, and no one else", async () => {
    await ctx.dataSource
      .getRepository(User)
      .update(ctx.testUserId, { customCityString: "Springfield" });
    const read = (token: string) =>
      request(ctx.app.getHttpServer())
        .get(`/user/${ctx.testUserId}/visibilitycontext`)
        .set("Authorization", `Bearer ${token}`);

    const asAdmin = await read(ctx.adminAccessToken);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.userHasCity).toBe(true);
    expect((await read(ctx.accessToken)).status).toBe(401);
  });
});

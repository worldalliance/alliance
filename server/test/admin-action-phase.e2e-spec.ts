import request from "supertest";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { FollowUpForm } from "../src/actions/entities/follow-up-form.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";

describe("Admin action member-action phase (e2e)", () => {
  let ctx: TestContext;
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    ({ createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const fetchAdmin = (actionId: number) =>
    request(ctx.app.getHttpServer())
      .get(`/actions/adminslug/${actionId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  it("returns the member-action start and deadline", async () => {
    const start = addDays(now, -1);
    const deadline = addDays(now, 3);
    const action = await createAction({ start, deadline });

    const response = await fetchAdmin(action.id);

    expect(response.body).toMatchObject({
      memberActionStart: start.toISOString(),
      memberActionDeadline: deadline.toISOString(),
    });
  });

  it("returns the member-action start from archive, unarchive, and import", async () => {
    const start = addDays(now, -1);
    const action = await createAction({ start, deadline: null });
    const post = (path: string) =>
      request(ctx.app.getHttpServer())
        .post(path)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    const archived = await post(`/actions/archive/${action.id}`).expect(201);
    const unarchived = await post(`/actions/unarchive/${action.id}`).expect(
      201,
    );
    const exported = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${action.id}?events=true`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    const imported = await post("/actions/pasteJson")
      .send({ body: JSON.stringify(exported.body) })
      .expect(201);

    for (const response of [archived, unarchived, imported]) {
      expect(response.body.memberActionStart).toBe(start.toISOString());
    }
  });

  it("lists each action's variant forms", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Variant form",
      schema: { title: "Variant form", pages: [], outputViews: [] },
    });
    await ctx.dataSource.getRepository(ActionFormVariant).save({
      actionId: action.id,
      formId: form.id,
      name: "Variant A",
      splitValue: 0.5,
    });

    const response = await request(ctx.app.getHttpServer())
      .get("/actions/all")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(
      response.body.find((listed: { id: number }) => listed.id === action.id),
    ).toMatchObject({ variantFormIds: [form.id] });
  });

  it("lists each action's follow-up forms", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Follow-up form",
      schema: { title: "Follow-up form", pages: [], outputViews: [] },
    });
    const cohortExpression = { type: "Tag", tagId: ctx.defaultTag.id };
    const followUp = await ctx.dataSource.getRepository(FollowUpForm).save({
      actionId: action.id,
      formId: form.id,
      cohortExpression,
    });

    const response = await request(ctx.app.getHttpServer())
      .get("/actions/all")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(
      response.body.find((listed: { id: number }) => listed.id === action.id),
    ).toMatchObject({
      followUpForms: [{ id: followUp.id, cohortExpression }],
    });
  });

  it("returns no deadline for a phase nothing closes", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });

    const response = await fetchAdmin(action.id);

    expect(response.body.memberActionDeadline).toBeNull();
  });
});

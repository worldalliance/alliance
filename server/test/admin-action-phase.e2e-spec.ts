import { ActionActivityType } from "@alliance/common/actionActivity";
import request from "supertest";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { Action } from "../src/actions/entities/action.entity";
import { FollowUpForm } from "../src/actions/entities/follow-up-form.entity";
import { Project } from "../src/actions/entities/project.entity";
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
  let createUser: CohortDecisionFixtures["createUser"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    ({ createAction, createUser, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const fetchAdmin = (actionId: number) =>
    request(ctx.app.getHttpServer())
      .get(`/actions/adminslug/${actionId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const postAdmin = (path: string) =>
    request(ctx.app.getHttpServer())
      .post(path)
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

    const archived = await postAdmin(`/actions/archive/${action.id}`).expect(
      201,
    );
    const unarchived = await postAdmin(
      `/actions/unarchive/${action.id}`,
    ).expect(201);
    const exported = await request(ctx.app.getHttpServer())
      .get(`/actions/export/${action.id}?events=true`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .expect(200);
    const imported = await postAdmin("/actions/pasteJson")
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

  it("lists each action's project", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });
    const project = await ctx.dataSource
      .getRepository(Project)
      .save({ name: "Listed project" });
    await ctx.dataSource
      .getRepository(Action)
      .update(action.id, { project: { id: project.id } });

    const response = await request(ctx.app.getHttpServer())
      .get("/actions/all")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    expect(
      response.body.find((listed: { id: number }) => listed.id === action.id),
    ).toMatchObject({ project: { id: project.id, name: "Listed project" } });
  });

  it("lists each action's latest withdrawals and unanswered dismissals", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });
    const respond = async (types: ActionActivityType[]) => {
      const user = await createUser();
      for (const [index, type] of types.entries()) {
        await ctx.dataSource.getRepository(ActionActivity).save({
          userId: user.id,
          actionId: action.id,
          type,
          createdAt: addDays(now, index - types.length),
        });
      }
    };
    await respond([ActionActivityType.USER_WONT_COMPLETE]);
    await respond([
      ActionActivityType.USER_WONT_COMPLETE,
      ActionActivityType.USER_COMPLETED,
    ]);
    await respond([ActionActivityType.USER_DISMISSED]);
    await respond([
      ActionActivityType.USER_DISMISSED,
      ActionActivityType.USER_COMPLETED,
    ]);
    const untouched = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });

    const response = await request(ctx.app.getHttpServer())
      .get("/actions/all")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

    const listed = (id: number) =>
      response.body.find((item: { id: number }) => item.id === id);
    expect(listed(action.id)).toMatchObject({
      usersWontComplete: 1,
      usersDismissed: 1,
    });
    expect(listed(untouched.id)).toMatchObject({
      usersWontComplete: 0,
      usersDismissed: 0,
    });
  });

  it("returns the action's follow-up forms from archive and unarchive", async () => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: null,
    });
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Follow-up form",
      schema: { title: "Follow-up form", pages: [], outputViews: [] },
    });
    const followUp = await ctx.dataSource.getRepository(FollowUpForm).save({
      actionId: action.id,
      formId: form.id,
      cohortExpression: null,
    });

    const archived = await postAdmin(`/actions/archive/${action.id}`).expect(
      201,
    );
    const unarchived = await postAdmin(
      `/actions/unarchive/${action.id}`,
    ).expect(201);

    expect(archived.body).toMatchObject({
      archived: true,
      followUpForms: [{ id: followUp.id }],
    });
    expect(unarchived.body).toMatchObject({
      archived: false,
      followUpForms: [{ id: followUp.id }],
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

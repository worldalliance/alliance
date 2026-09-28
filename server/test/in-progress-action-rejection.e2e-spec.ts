import type { CohortExpression } from "@alliance/common/cohort-expression";
import request from "supertest";
import type { Repository } from "typeorm";
import { Action } from "../src/actions/entities/action.entity";
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

describe("InProgressAction rejection (e2e)", () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let followUpFormRepo: Repository<FollowUpForm>;
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionRepo = ctx.dataSource.getRepository(Action);
    followUpFormRepo = ctx.dataSource.getRepository(FollowUpForm);
    ({ createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(async () => {
    await followUpFormRepo.query("DELETE FROM follow_up_form");
    await cleanUp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const patchAction = (actionId: number, body: object) =>
    request(ctx.app.getHttpServer())
      .patch(`/actions/${actionId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send(body);

  const createUpstream = () =>
    createAction({ start: addDays(now, -3), deadline: addDays(now, 1) });

  it("rejects adding an InProgressAction leaf", async () => {
    const upstream = await createUpstream();
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    const response = await patchAction(action.id, {
      cohortExpression: { type: "InProgressAction", actionId: upstream.id },
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("prerequisite");
  });

  it("keeps an existing InProgressAction leaf through other edits", async () => {
    const upstream = await createUpstream();
    const cohortExpression: CohortExpression = {
      type: "OR",
      children: [
        { type: "CompletedAction", actionId: upstream.id },
        { type: "InProgressAction", actionId: upstream.id },
      ],
    };
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      cohortExpression,
    });

    const response = await patchAction(action.id, {
      name: "Renamed",
      cohortExpression,
    });

    expect(response.status).toBe(200);
    expect(
      (await actionRepo.findOneByOrFail({ id: action.id })).cohortExpression,
    ).toEqual(cohortExpression);
  });

  it("rejects creating an action with an InProgressAction leaf", async () => {
    const upstream = await createUpstream();

    const response = await request(ctx.app.getHttpServer())
      .post("/actions/create")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        name: "Downstream",
        category: [],
        body: "Body",
        shortDescription: "Short",
        visibilityMode: "public",
        isContractSigningAction: false,
        priority: 0,
        cohortExpression: { type: "InProgressAction", actionId: upstream.id },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("prerequisite");
  });

  it("rejects importing an action with an InProgressAction leaf, without pointing at prerequisites", async () => {
    const upstream = await createUpstream();

    const response = await request(ctx.app.getHttpServer())
      .post("/actions/pasteJson")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({
        body: JSON.stringify({
          cohortExpression: { type: "InProgressAction", actionId: upstream.id },
        }),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      `In-Progress Action conditions can't be added anymore (action ids: ${upstream.id}).`,
    );
  });

  describe("follow-up forms", () => {
    const createActionAndForm = async () => {
      const action = await createUpstream();
      const { form } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Debrief",
        schema: { title: "Debrief", pages: [], outputViews: [] },
      });
      return { action, form };
    };

    const createFollowUpForm = async (
      cohortExpression: CohortExpression | null,
    ) => {
      const { action, form } = await createActionAndForm();
      return followUpFormRepo.save({
        actionId: action.id,
        formId: form.id,
        cohortExpression,
      });
    };

    const patchFollowUpForm = (followUpFormId: number, body: object) =>
      request(ctx.app.getHttpServer())
        .patch(`/actions/follow-up-forms/${followUpFormId}`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send(body);

    it("rejects creating one with an InProgressAction leaf, without pointing at prerequisites", async () => {
      const { action, form } = await createActionAndForm();

      const response = await request(ctx.app.getHttpServer())
        .post(`/actions/${action.id}/follow-up-forms`)
        .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
        .send({
          actionId: action.id,
          formId: form.id,
          cohortExpression: { type: "InProgressAction", actionId: action.id },
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        `In-Progress Action conditions can't be added anymore (action ids: ${action.id}).`,
      );
    });

    it("rejects adding an InProgressAction leaf", async () => {
      const upstream = await createUpstream();
      const followUpForm = await createFollowUpForm(null);

      const response = await patchFollowUpForm(followUpForm.id, {
        cohortExpression: { type: "InProgressAction", actionId: upstream.id },
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        `In-Progress Action conditions can't be added anymore (action ids: ${upstream.id}).`,
      );
    });

    it("keeps an existing InProgressAction leaf through other edits", async () => {
      const upstream = await createUpstream();
      const cohortExpression: CohortExpression = {
        type: "InProgressAction",
        actionId: upstream.id,
      };
      const followUpForm = await createFollowUpForm(cohortExpression);

      const response = await patchFollowUpForm(followUpForm.id, {
        name: "Renamed",
        cohortExpression,
      });

      expect(response.status).toBe(200);
      expect(
        (await followUpFormRepo.findOneByOrFail({ id: followUpForm.id }))
          .cohortExpression,
      ).toEqual(cohortExpression);
    });
  });
});

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

describe("Deleting an action a cohort names (e2e)", () => {
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

  const deleteAction = (actionId: number) =>
    request(ctx.app.getHttpServer())
      .delete(`/actions/${actionId}`)
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`);

  const createNamed = async (name: string) => {
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });
    return actionRepo.save({ ...action, name });
  };

  const addFollowUpForm = async (
    actionId: number,
    cohortExpression: FollowUpForm["cohortExpression"],
  ) => {
    const { form } = await createFormWithSnapshot(ctx.dataSource, {
      title: "Debrief",
      schema: { title: "Debrief", pages: [], outputViews: [] },
    });
    await followUpFormRepo.save({
      actionId,
      formId: form.id,
      cohortExpression,
    });
  };

  it("rejects deleting an action another action's cohort names", async () => {
    const named = await createNamed("Named");
    const referrer = await createNamed("Referrer");
    await actionRepo.update(referrer.id, {
      cohortExpression: {
        type: "NOT",
        child: { type: "MissedActionDeadline", actionId: named.id },
      },
    });

    const response = await deleteAction(named.id);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'This action is named in the cohort of "Referrer". Remove it from there first.',
    );
    expect(await actionRepo.existsBy({ id: named.id })).toBe(true);
  });

  it("rejects deleting an action a follow-up form's cohort names", async () => {
    const named = await createNamed("Named");
    const referrer = await createNamed("Referrer");
    await addFollowUpForm(referrer.id, {
      type: "CompletedAction",
      actionId: named.id,
    });

    const response = await deleteAction(named.id);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'This action is named in the cohort of a follow-up form of "Referrer". Remove it from there first.',
    );
    expect(await actionRepo.existsBy({ id: named.id })).toBe(true);
  });

  it("deletes an action only its own cohorts name", async () => {
    const action = await createNamed("Self");
    await actionRepo.update(action.id, {
      cohortExpression: { type: "InProgressAction", actionId: action.id },
    });
    await addFollowUpForm(action.id, {
      type: "CompletedAction",
      actionId: action.id,
    });

    const response = await deleteAction(action.id);

    expect(response.status).toBe(200);
    expect(await actionRepo.existsBy({ id: action.id })).toBe(false);
  });
});

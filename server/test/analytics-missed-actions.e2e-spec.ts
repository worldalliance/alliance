import { ActionActivityType } from "@alliance/common/actionActivity";
import { CohortDecisionService } from "../src/actions/cohort-decision.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { AnalyticsModule } from "../src/analytics/analytics.module";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("AnalyticsService.getMissedActions (e2e)", () => {
  let ctx: TestContext;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule, AnalyticsModule]);
    ({ createUser, createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const missedLastActionUserIds = async () => {
    await ctx.app.get(CohortDecisionService).resolveAll(now);
    const { missedLastAction } = await ctx.app
      .get(AnalyticsService)
      .getMissedActions();
    return missedLastAction.map((member) => member.userId);
  };

  const recordActivity = (params: {
    userId: number;
    actionId: number;
    type: ActionActivityType;
  }) => ctx.dataSource.getRepository(ActionActivity).save(params);

  it("reports a member with no activity on the last closed action", async () => {
    const member = await createUser({ signedAt: addDays(now, -30) });
    await createAction({
      start: addDays(now, -10),
      deadline: addDays(now, -3),
    });

    expect(await missedLastActionUserIds()).toContain(member.id);
  });

  it("does not report a member who withdrew from the last closed action", async () => {
    const member = await createUser({ signedAt: addDays(now, -30) });
    const action = await createAction({
      start: addDays(now, -10),
      deadline: addDays(now, -3),
    });
    await recordActivity({
      userId: member.id,
      actionId: action.id,
      type: ActionActivityType.USER_WONT_COMPLETE,
    });

    expect(await missedLastActionUserIds()).not.toContain(member.id);
  });
});

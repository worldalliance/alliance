import { ActionActivityType } from "@alliance/common/actionActivity";
import {
  ActionActivityService,
  ActivityAlreadyExistsException,
} from "../src/actions/action-activity.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { holdUserLookups } from "./hold-user-lookups";

describe("createActionActivity duplicates (e2e)", () => {
  let ctx: TestContext;
  let fixtures: CohortDecisionFixtures;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    fixtures = cohortDecisionFixtures(ctx);
  }, 50000);

  afterEach(() => fixtures.cleanUp());

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const completion = async () => {
    const now = new Date();
    const member = await fixtures.createUser({ signedAt: addDays(now, -30) });
    const action = await fixtures.createAction({
      start: addDays(now, -10),
      deadline: addDays(now, 3),
    });
    return {
      member,
      action,
      create: () =>
        ctx.app.get(ActionActivityService).createActionActivity({
          actionId: action.id,
          userId: member.id,
          type: ActionActivityType.USER_COMPLETED,
          adminCreated: true,
        }),
    };
  };

  it("rejects a second creation with ActivityAlreadyExistsException", async () => {
    const { create } = await completion();
    await create();

    await expect(create()).rejects.toBeInstanceOf(
      ActivityAlreadyExistsException,
    );
  });

  it("creates one activity when two creations race", async () => {
    const { member, action, create } = await completion();
    const lookup = holdUserLookups(ctx);

    const results = await Promise.allSettled([create(), create()]);
    lookup.mockRestore();

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(
      results.find((result) => result.status === "rejected")?.reason,
    ).toBeInstanceOf(ActivityAlreadyExistsException);
    expect(
      await ctx.dataSource.getRepository(ActionActivity).countBy({
        actionId: action.id,
        userId: member.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    ).toBe(1);
  });
});

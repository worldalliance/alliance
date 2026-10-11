import { ActionActivityType } from "@alliance/common/actionActivity";
import { ActionsService } from "../src/actions/actions.service";
import { Action } from "../src/actions/entities/action.entity";
import { SingleMemberCohortService } from "../src/actions/single-member-cohort.service";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { TasksModule } from "../src/tasks/tasks.module";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("A member's latest completion or withdrawal decides completion (e2e)", () => {
  let ctx: TestContext;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    ({ createUser, createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const setUp = async (types: ActionActivityType[]) => {
    const member = await createUser({ signedAt: addDays(now, -30) });
    const action = await createAction({
      start: addDays(now, -10),
      deadline: addDays(now, 3),
    });
    for (const type of types) {
      await ctx.app.get(ActionsService).createActionActivity({
        actionId: action.id,
        userId: member.id,
        type,
        adminCreated: true,
      });
    }
    return { member, action };
  };

  it.each([
    {
      order: "completed then withdrew",
      types: [
        ActionActivityType.USER_COMPLETED,
        ActionActivityType.USER_WONT_COMPLETE,
      ],
      completed: false,
    },
    {
      order: "withdrew then completed",
      types: [
        ActionActivityType.USER_WONT_COMPLETE,
        ActionActivityType.USER_COMPLETED,
      ],
      completed: true,
    },
  ])(
    "counts a member who $order as completed: $completed",
    async ({ types, completed }) => {
      const { member, action } = await setUp(types);
      const expression = {
        type: "CompletedAction" as const,
        actionId: action.id,
      };
      const user = await ctx.app.get(UserService).findOneOrFail(member.id, {
        tags: true,
        contractEvents: true,
        awayRanges: true,
      });

      const [population, single, stored] = await Promise.all([
        ctx.app
          .get(ActionEventRecipientService)
          .resolveCohortMemberIds(expression),
        ctx.app.get(SingleMemberCohortService).computeIsInCohortExpression({
          user,
          cohortExpression: expression,
        }),
        ctx.dataSource.getRepository(Action).findOneByOrFail({ id: action.id }),
      ]);

      expect({
        population: population.has(member.id),
        single,
        usersCompleted: stored.usersCompleted,
      }).toEqual({
        population: completed,
        single: completed,
        usersCompleted: completed ? 1 : 0,
      });
    },
  );
});

import { ActionActivityType } from "@alliance/common/actionActivity";
import type { Repository } from "typeorm";
import { ActionsService } from "../src/actions/actions.service";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "../src/actions/entities/action.entity";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { CohortResolutionSession } from "../src/notifs/cohort-resolution-session";
import { TasksModule } from "../src/tasks/tasks.module";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
} from "./cohort-decision-fixtures";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("Live cohort with prerequisites (e2e)", () => {
  let ctx: TestContext;
  let actionsService: ActionsService;
  let recipientService: ActionEventRecipientService;
  let userService: UserService;
  let actionRepo: Repository<Action>;
  let activityRepo: Repository<ActionActivity>;
  let createUser: CohortDecisionFixtures["createUser"];
  let createAction: CohortDecisionFixtures["createAction"];
  let cleanUp: CohortDecisionFixtures["cleanUp"];

  const now = new Date();
  const signedAt = addDays(now, -30);

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    actionsService = ctx.app.get(ActionsService);
    recipientService = ctx.app.get(ActionEventRecipientService);
    userService = ctx.app.get(UserService);
    actionRepo = ctx.dataSource.getRepository(Action);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    ({ createUser, createAction, cleanUp } = cohortDecisionFixtures(ctx));
  }, 50000);

  afterEach(() => cleanUp());

  afterAll(async () => {
    await ctx.app.close();
  });

  const load = async (id: number): Promise<ParsedAction> =>
    parseAction(
      await actionRepo.findOneOrFail({
        where: { id },
        relations: { events: true },
      }),
    );

  const inCohort = async (actionId: number, userId: number) => {
    const action = await load(actionId);
    const [population, single] = await Promise.all([
      recipientService.resolveActionCohortMemberIds({
        action,
        session: new CohortResolutionSession(),
      }),
      actionsService.computeIsInActionCohort({
        user: await userService.findOneOrFail(userId, {
          tags: true,
          contractEvents: true,
          awayRanges: true,
        }),
        action,
      }),
    ]);
    return { population: population.has(userId), single };
  };

  it("leaves a member out until their prerequisite resolves", async () => {
    const member = await createUser({ signedAt });
    const upstream = await createAction({
      start: addDays(now, -3),
      deadline: addDays(now, 1),
    });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
      prerequisiteActionIds: [upstream.id],
    });

    expect(await inCohort(action.id, member.id)).toEqual({
      population: false,
      single: false,
    });

    await activityRepo.save({
      actionId: upstream.id,
      userId: member.id,
      type: ActionActivityType.USER_COMPLETED,
    });

    expect(await inCohort(action.id, member.id)).toEqual({
      population: true,
      single: true,
    });
  });

  it("leaves members of actions without prerequisites unchanged", async () => {
    const member = await createUser({ signedAt });
    const action = await createAction({
      start: addDays(now, -1),
      deadline: addDays(now, 3),
    });

    expect(await inCohort(action.id, member.id)).toEqual({
      population: true,
      single: true,
    });
  });

  it.each([
    { type: "InProgressAction" as const, deadline: addDays(now, 3) },
    { type: "MissedActionDeadline" as const, deadline: addDays(now, -1) },
  ])(
    "keeps a member waiting on $type's prerequisite out of its leaf's roster",
    async ({ type, deadline }) => {
      const member = await createUser({ signedAt });
      const prerequisite = await createAction({
        start: addDays(now, -5),
        deadline: addDays(now, 1),
      });
      const read = await createAction({
        start: addDays(now, -3),
        deadline,
        prerequisiteActionIds: [prerequisite.id],
      });
      const action = await createAction({
        start: addDays(now, -1),
        deadline: addDays(now, 3),
        cohortExpression: { type, actionId: read.id },
      });

      expect(await inCohort(action.id, member.id)).toEqual({
        population: false,
        single: false,
      });

      await activityRepo.save({
        actionId: prerequisite.id,
        userId: member.id,
        type: ActionActivityType.USER_COMPLETED,
      });

      expect(await inCohort(action.id, member.id)).toEqual({
        population: true,
        single: true,
      });
    },
  );
});

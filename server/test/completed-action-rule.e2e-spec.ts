import { ActionActivityType } from "@alliance/common/actionActivity";
import { ActionActivityService } from "../src/actions/action-activity.service";
import { ActionFormLinksService } from "../src/actions/action-form-links.service";
import { ActionParticipantsService } from "../src/actions/action-participants.service";
import { ActionRelationsService } from "../src/actions/action-relations.service";
import { CohortResolverService } from "../src/actions/cohort-resolver.service";
import { Action } from "../src/actions/entities/action.entity";
import { SingleMemberCohortService } from "../src/actions/single-member-cohort.service";
import { ActionStatsAnalyticsService } from "../src/analytics/action-stats-analytics.service";
import { ActionStatsRecord } from "../src/analytics/actionstats.entity";
import { AnalyticsModule } from "../src/analytics/analytics.module";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { DailyStatsRecord } from "../src/analytics/dailystats.entity";
import { MemberRetentionAnalyticsService } from "../src/analytics/member-retention-analytics.service";
import { PlatformTenureAnalyticsService } from "../src/analytics/platform-tenure-analytics.service";
import { Community } from "../src/community/entities/community.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { ReferralSource, User } from "../src/user/entities/user.entity";
import { UserVisibilityContextService } from "../src/user/user-visibility-context.service";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  type CohortDecisionFixtures,
  saveLiveCohortDecisions,
} from "./cohort-decision-fixtures";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
} from "./e2e-test-utils";

describe("A member's latest completion or withdrawal decides completion (e2e)", () => {
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

  const setUp = async (
    types: ActionActivityType[],
    deadline = addDays(now, 3),
  ) => {
    const member = await createUser({ signedAt: addDays(now, -30) });
    const action = await createAction({ start: addDays(now, -10), deadline });
    await saveLiveCohortDecisions(ctx);
    for (const type of types) {
      await ctx.app.get(ActionActivityService).createActionActivity({
        actionId: action.id,
        userId: member.id,
        type,
        adminCreated: true,
      });
    }
    return { member, action };
  };

  const orders = [
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
  ];

  it.each(orders)(
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
        ctx.app.get(CohortResolverService).resolveCohortMemberIds(expression),
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

  it.each(orders)(
    "counts a member who $order in their completed-action count: $completed",
    async ({ types, completed }) => {
      const { member } = await setUp(types);

      expect(
        await ctx.app
          .get(UserVisibilityContextService)
          .getCompletedActionCount(member.id),
      ).toBe(completed ? 1 : 0);
    },
  );

  it.each(orders)(
    "counts a member who $order as a participant: $completed",
    async ({ types, completed }) => {
      const { member, action } = await setUp(types);
      const participants = ctx.app.get(ActionParticipantsService);

      const [participantIds, incomplete, stored] = await Promise.all([
        participants.findParticipantIdsForActionById(action.id),
        participants.findIncompleteUsersForAction(action.id),
        ctx.dataSource.getRepository(Action).findOneByOrFail({ id: action.id }),
      ]);

      expect({
        participant: participantIds.includes(member.id),
        incomplete: incomplete.map((user) => user.id),
        usersJoined: stored.usersJoined,
      }).toEqual({
        participant: completed,
        incomplete: [],
        usersJoined: completed ? 1 : 0,
      });
    },
  );

  it.each(orders)(
    "counts a member who $order as withdrawn only when that is their latest",
    async ({ types, completed }) => {
      const { member, action } = await setUp(types);
      const { form } = await createFormWithSnapshot(ctx.dataSource, {
        title: "Withdrawals",
        schema: { title: "Withdrawals", pages: [], outputViews: [] },
      });
      await ctx.dataSource
        .getRepository(Action)
        .update(action.id, { taskFormId: form.id });
      await ctx.app.get(ActionStatsAnalyticsService).calculateActionStats();

      const [withdrawals, stats] = await Promise.all([
        ctx.app.get(ActionFormLinksService).getWithdrawalsForForm(form.id),
        ctx.dataSource
          .getRepository(ActionStatsRecord)
          .findOneByOrFail({ actionId: action.id }),
      ]);

      expect({
        withdrawals: withdrawals.map((activity) => activity.userId),
        usersWithdrawn: stats.usersWithdrawn,
      }).toEqual({
        withdrawals: completed ? [] : [member.id],
        usersWithdrawn: completed ? 0 : 1,
      });
    },
  );

  it.each(orders)(
    "counts a member who $order in their community's completed actions: $completed",
    async ({ types, completed }) => {
      const { member } = await setUp(types);
      const communityRepo = ctx.dataSource.getRepository(Community);
      const community = await communityRepo.save(
        communityRepo.create({ name: "Completion rule", users: [member] }),
      );

      const count = await ctx.app
        .get(ActionRelationsService)
        .countCommunityCompletedActions(member.id, community.id);
      await communityRepo.delete(community.id);

      expect(count).toBe(completed ? 1 : 0);
    },
  );

  it.each(orders)(
    "counts a member who $order in completion analytics: $completed",
    async ({ types, completed }) => {
      const actionActivityService = ctx.app.get(ActionActivityService);
      const others = await Promise.all(
        [0, 1, 2].map(() =>
          createAction({
            start: addDays(now, -10),
            deadline: addDays(now, -1),
          }),
        ),
      );
      await createUser({ signedAt: addDays(now, -30) });
      const { member, action } = await setUp(types, addDays(now, -1));
      for (const other of others) {
        await actionActivityService.completeAction(other.id, member.id, {
          adminCreated: true,
        });
      }
      await ctx.dataSource.query(
        `UPDATE action_activity SET "createdAt" = "createdAt" - interval '3 days'`,
      );
      const inviteRepo = ctx.dataSource.getRepository(OnetimeInvite);
      const invite = await inviteRepo.save(
        inviteRepo.create({
          invitee: "Completion rule",
          code: `rule-${member.id}`,
          status: OnetimeInviteStatus.LINK_USED,
        }),
      );
      await ctx.dataSource.getRepository(User).update(member.id, {
        referredByInvite: { id: invite.id },
        referralSource: ReferralSource.OnetimeInvite,
      });
      await ctx.dataSource.getRepository(DailyStatsRecord).clear();
      await ctx.app.get(ActionStatsAnalyticsService).calculateActionStats();
      await ctx.app.get(AnalyticsService).calculateDailyStats();

      const [tenure, retention, [curve], [daily], funnel] = await Promise.all([
        ctx.app
          .get(PlatformTenureAnalyticsService)
          .getPlatformTenureCohortStats(4),
        ctx.app
          .get(MemberRetentionAnalyticsService)
          .getMemberCompletionRetentionByCohort(),
        ctx.app
          .get(ActionStatsAnalyticsService)
          .getActionCompletionCurves(action.id),
        ctx.dataSource.getRepository(DailyStatsRecord).find(),
        ctx.app.get(AnalyticsService).getInviteFunnel(),
      ]);

      const expected = completed ? 4 : 3;
      expect({
        tenure: tenure.actions.find((stats) => stats.actionId === action.id)
          ?.completedCount,
        retention: retention
          .flatMap((cohort) => cohort.points)
          .reduce((sum, point) => sum + point.weekCompletedCount, 0),
        curve: curve.completedCounts.reduce((sum, count) => sum + count, 0),
        dailyActionsCompleted: daily.actionsCompleted,
        onboardingCompleted: funnel.onboardingCompleted,
      }).toEqual({
        tenure: completed ? 1 : 0,
        retention: expected,
        curve: completed ? 1 : 0,
        dailyActionsCompleted: expected,
        onboardingCompleted: completed ? 1 : 0,
      });
    },
  );
});

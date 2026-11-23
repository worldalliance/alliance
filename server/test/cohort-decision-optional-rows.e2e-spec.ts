import { ActionRelationsService } from "../src/actions/action-relations.service";
import { ActionSuspensionService } from "../src/actions/action-suspension.service";
import { CohortResolutionSession } from "../src/actions/cohort-resolution-session";
import { CohortResolverService } from "../src/actions/cohort-resolver.service";
import { ActionCohortDecision } from "../src/actions/entities/action-cohort-decision.entity";
import {
  ActionEvent,
  ActionStatus,
  loadedActionEventAction,
} from "../src/actions/entities/action-event.entity";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action, parseAction } from "../src/actions/entities/action.entity";
import { MemberActionsService } from "../src/actions/member-actions.service";
import { SingleMemberCohortService } from "../src/actions/single-member-cohort.service";
import { ViewerOptionalReason } from "../src/actions/user-action-status";
import { AnalyticsModule } from "../src/analytics/analytics.module";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { MemberRetentionAnalyticsService } from "../src/analytics/member-retention-analytics.service";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { ActionEventNotifType } from "../src/notifs/entities/action-event-notif.entity";
import { TasksModule } from "../src/tasks/tasks.module";
import { UserActionRelationPillStatus } from "../src/user/dto/user-action-relations.dto";
import type { User } from "../src/user/entities/user.entity";
import { UserService } from "../src/user/user.service";
import {
  addDays,
  cohortDecisionFixtures,
  saveLiveCohortDecisions,
} from "./cohort-decision-fixtures";
import {
  closeTestApp,
  createTestApp,
  type TestContext,
} from "./e2e-test-utils";

describe("Decision rows marked optional (e2e)", () => {
  let ctx: TestContext;
  let required: User;
  let optional: User;
  let action: Action;
  let suite: ActionSuite;
  const now = new Date();

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule, AnalyticsModule]);
    const fx = cohortDecisionFixtures(ctx);
    const signedAt = addDays(now, -60);
    required = await fx.createUser({ signedAt });
    optional = await fx.createUser({ signedAt });
    action = await fx.createAction({
      start: addDays(now, -30),
      deadline: addDays(now, -10),
    });
    suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name: "Optional rows" });
    await ctx.dataSource
      .getRepository(Action)
      .update(action.id, { suite: { id: suite.id } });
    await saveLiveCohortDecisions(ctx, [action.id]);
    const decisions = ctx.dataSource.getRepository(ActionCohortDecision);
    await decisions.update(
      { actionId: action.id, userId: required.id },
      { optional: false },
    );
    await decisions.update(
      { actionId: action.id, userId: optional.id },
      { optional: true },
    );
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const memberActionEvent = () =>
    ctx.dataSource.getRepository(ActionEvent).findOneOrFail({
      where: {
        action: { id: action.id },
        newStatus: ActionStatus.MemberAction,
      },
      relations: { action: { events: true } },
    });

  it("shows each member the action as their row says", async () => {
    const viewer = async (user: User) =>
      (await ctx.app.get(MemberActionsService).findMemberPublic(user.id)).find(
        (each) => each.id === action.id,
      )?.viewer;
    expect(await viewer(required)).toMatchObject({ optional: false });
    expect(await viewer(optional)).toMatchObject({
      optional: true,
      optionalReason: ViewerOptionalReason.SplitGroup,
    });
  });

  it("keeps a task optional for the member among their uncompleted tasks", async () => {
    const tasks = await ctx.app
      .get(MemberActionsService)
      .findUncompletedTasks(optional.id, suite.id);
    expect(tasks.find((each) => each.id === action.id)?.viewer).toMatchObject({
      optional: true,
    });
  });

  it("shows leaders each member's pill as their row says", async () => {
    const pill = async (user: User) =>
      (
        await ctx.app
          .get(ActionRelationsService)
          .findUserActionRelationsForUser(user.id)
      ).users[0]?.relations.find((each) => each.actionId === action.id)?.status;
    expect(await pill(required)).toBe(
      UserActionRelationPillStatus.MissedDeadline,
    );
    expect(await pill(optional)).toBe(
      UserActionRelationPillStatus.OptionalTask,
    );
  });

  it("counts only required work in missed-actions analytics", async () => {
    const { missedLastAction } = await ctx.app
      .get(AnalyticsService)
      .getMissedActions();
    const missed = missedLastAction.map((each) => each.userId);
    expect(missed).toContain(required.id);
    expect(missed).not.toContain(optional.id);
  });

  it("counts optional work in retention only when asked to", async () => {
    const members = async (includeOptional: boolean) =>
      (
        await ctx.app
          .get(MemberRetentionAnalyticsService)
          .getMemberCompletionRetentionByCohort(includeOptional)
      )
        .flatMap((cohort) => cohort.points)
        .flatMap((point) => point.actions)
        .filter((each) => each.actionId === action.id)
        .reduce((sum, each) => sum + each.memberCount, 0);
    expect(await members(false)).toBe(1);
    expect(await members(true)).toBe(2);
  });

  it("leaves optional work out of the suites a member missed", async () => {
    const outcome = (
      await ctx.app.get(ActionSuspensionService).findClosedSuiteOutcomes(now)
    ).find((each) => each.suiteId === suite.id);
    expect(outcome?.missedActionIdsByUser.get(required.id)).toEqual([
      action.id,
    ]);
    expect(outcome?.missedActionIdsByUser.has(optional.id)).toBe(false);
  });

  it("never counts optional work as a missed deadline", async () => {
    const expression = {
      type: "MissedActionDeadline" as const,
      actionId: action.id,
    };
    const missed = await ctx.app
      .get(CohortResolverService)
      .resolveCohortMemberIds(expression, new CohortResolutionSession());
    expect(missed.has(required.id)).toBe(true);
    expect(missed.has(optional.id)).toBe(false);

    const users = await ctx.app
      .get(UserService)
      .findByIds([required.id, optional.id], {
        tags: true,
        awayRanges: true,
        contractEvents: true,
      });
    const single = ctx.app.get(SingleMemberCohortService);
    const missedAlone = (id: number) => {
      const user = users.find((each) => each.id === id);
      if (user === undefined) throw new Error(`user ${id} not loaded`);
      return single.computeIsInCohortExpression({
        user,
        cohortExpression: expression,
      });
    };
    expect(await missedAlone(required.id)).toBe(true);
    expect(await missedAlone(optional.id)).toBe(false);
  });

  it("leaves members with optional work out of required-only recipients", async () => {
    const recipients = ctx.app.get(ActionEventRecipientService);
    const event = await memberActionEvent();
    const base = async (requiredOnly: boolean) =>
      (
        await recipients.findBaseUsersForEvents({
          entries: [
            {
              action: parseAction(loadedActionEventAction(event)),
              eventId: event.id,
            },
          ],
          requiredOnly,
        })
      )
        .get(action.id)!
        .map((user) => user.id);
    expect(await base(false)).toEqual(
      expect.arrayContaining([required.id, optional.id]),
    );
    expect(await base(true)).toContain(required.id);
    expect(await base(true)).not.toContain(optional.id);

    const withActions = await ctx.dataSource
      .getRepository(ActionSuite)
      .findOneOrFail({ where: { id: suite.id }, relations: { actions: true } });
    const reminded = (
      await recipients.findFilteredUsersForEvent(
        event,
        null,
        ActionEventNotifType.PersonalReminder,
        withActions,
        true,
      )
    ).map((user) => user.id);
    expect(reminded).toContain(required.id);
    expect(reminded).not.toContain(optional.id);
  });
});

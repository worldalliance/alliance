import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import {
  computeIsAssignedAndPresent,
  computeMissedRequiredAction,
  hasMemberActionDeadlinePassed,
} from "src/utils/action-user";
import { findLeast } from "src/utils/filter";
import { In, type Repository } from "typeorm";
import { TERMINAL_ACTIVITY_TYPES } from "./action-activity-status";
import { ActionsService } from "./actions.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { SuspensionPlan } from "./dto/scheduled-plans.dto";
import { ActionActivity } from "./entities/action-activity.entity";
import { type ParsedAction } from "./entities/action.entity";
import {
  SUSPENSION_MISSED_SUITE_COUNT,
  suspensionReasonKey,
  trailingMissedSuiteIds,
  type SuiteOutcome,
} from "./missed-suite-streak";

type SuspendPlanContext = {
  /** In close order. */
  suites: SuiteOutcome[];
  idToUser: Map<number, User>;
};

/**
 * A user due for automatic suspension, paired with the key identifying the
 * failure streak that triggered it. `ContractEvent`'s `(user, autoSuspendKey)`
 * unique constraint dedupes on it, so it is never absent for a candidate.
 */
export type SuspensionCandidate = { user: User; reasonKey: string };

@Injectable()
export class ActionSuspensionService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly actionsService: ActionsService,
    private readonly cohortResolverService: CohortResolverService,
  ) {}

  private async buildSuspendPlanContext(
    actions: ParsedAction[],
    maxPastDate: Date,
  ): Promise<SuspendPlanContext> {
    const actionsBySuite = new Map<number, ParsedAction[]>();
    for (const action of actions) {
      if (!action.suite || action.onboarding || action.optional) continue;
      const suiteActions = actionsBySuite.get(action.suite.id) ?? [];
      suiteActions.push(action);
      actionsBySuite.set(action.suite.id, suiteActions);
    }

    const closedSuites = [...actionsBySuite].flatMap(
      ([suiteId, suiteActions]) => {
        let closedAt: Date | null = null;
        for (const action of suiteActions) {
          const deadline = action.memberActionPhase.deadlineEvent?.date;
          if (!deadline) return [];
          if (!closedAt || deadline > closedAt) closedAt = deadline;
        }
        if (!closedAt || closedAt > maxPastDate) return [];
        return [{ suiteId, closedAt, actions: suiteActions }];
      },
    );
    closedSuites.sort(
      (a, b) =>
        a.closedAt.getTime() - b.closedAt.getTime() || a.suiteId - b.suiteId,
    );

    if (closedSuites.length === 0) {
      return { suites: [], idToUser: new Map() };
    }

    const actionIds = closedSuites.flatMap((suite) =>
      suite.actions.map((action) => action.id),
    );
    const satisfyingActivities = await this.actionActivityRepository.find({
      where: {
        actionId: In(actionIds),
        type: In(TERMINAL_ACTIVITY_TYPES),
      },
      select: { actionId: true, userId: true },
    });
    const satisfied = new Set(
      satisfyingActivities.map(
        (activity) => `${activity.userId}:${activity.actionId}`,
      ),
    );

    // Share the active-user load and per-leaf cohort queries across every
    // action in the batch (see CohortResolutionSession).
    const session = new CohortResolutionSession();
    const activeUsers =
      await this.cohortResolverService.getActiveUsers(session);
    const cohortByAction = new Map(
      await Promise.all(
        closedSuites.flatMap((suite) =>
          suite.actions.map(
            async (action) =>
              [
                action.id,
                await this.cohortResolverService.resolveCohort({
                  action,
                  session,
                }),
              ] as const,
          ),
        ),
      ),
    );

    const lastSignedDateByUser = new Map(
      activeUsers.map((user) => [
        user.id,
        findLeast(
          (user.contractEvents ?? []).filter(
            (event) => event.type === ContractEventType.SIGNED,
          ),
          (a, b) => b.date.getTime() - a.date.getTime(),
        )?.date ?? new Date(0),
      ]),
    );

    const idToUser = new Map<number, User>();
    const suites: SuiteOutcome[] = [];
    for (const suite of closedSuites) {
      const missedActionIdsByUser = new Map<number, number[]>();
      for (const action of suite.actions) {
        const { event, deadlineEvent } = action.memberActionPhase;
        if (!event) continue;
        const cohortMemberIds = cohortByAction.get(action.id)!;
        for (const user of activeUsers) {
          if (
            lastSignedDateByUser.get(user.id)! >= event.date ||
            !computeIsAssignedAndPresent({
              eventDate: event.date,
              deadlineDate: deadlineEvent?.date ?? null,
              cohortMemberIds,
              user,
              onboarding: action.onboarding,
            })
          ) {
            continue;
          }
          const missed = missedActionIdsByUser.get(user.id) ?? [];
          if (
            computeMissedRequiredAction({
              action,
              hasTerminalActivity: satisfied.has(`${user.id}:${action.id}`),
              now: maxPastDate,
            })
          ) {
            missed.push(action.id);
          }
          missedActionIdsByUser.set(user.id, missed);
          idToUser.set(user.id, user);
        }
      }
      suites.push({
        suiteId: suite.suiteId,
        closedAt: suite.closedAt,
        actions: suite.actions.map(({ id, name, timeEstimate }) => ({
          id,
          name,
          timeEstimate,
        })),
        missedActionIdsByUser,
      });
    }

    return { suites, idToUser };
  }

  private computeUsersToSuspendFromContext(
    now: Date,
    context: SuspendPlanContext,
  ): SuspensionCandidate[] {
    const closedSuites = context.suites.filter((suite) =>
      hasMemberActionDeadlinePassed(suite.closedAt, now),
    );
    return [...context.idToUser.values()].flatMap((user) => {
      if (!user.hasActiveContract) return [];
      const run = trailingMissedSuiteIds(closedSuites, user.id);
      return run.length >= SUSPENSION_MISSED_SUITE_COUNT
        ? [{ user, reasonKey: suspensionReasonKey(run) }]
        : [];
    });
  }

  async findUsersToSuspend(now: Date, preloadedActions?: ParsedAction[]) {
    const actions =
      preloadedActions ??
      (await this.actionsService.findAllSorted({
        events: true,
        suite: true,
      }));

    const context = await this.buildSuspendPlanContext(actions, now);
    return this.computeUsersToSuspendFromContext(now, context);
  }

  /** Suites closed by `now`, in close order. */
  async findClosedSuiteOutcomes(now: Date): Promise<SuiteOutcome[]> {
    const actions = await this.actionsService.findAllSorted({
      events: true,
      suite: true,
    });
    return (await this.buildSuspendPlanContext(actions, now)).suites;
  }

  async getSuspendPlans(
    rangeStart: Date,
    rangeEnd: Date,
    stepHours: number = 1,
  ): Promise<SuspensionPlan[]> {
    const actions = await this.actionsService.findAllSorted({
      events: true,
      suite: true,
    });
    const context = await this.buildSuspendPlanContext(actions, rangeEnd);

    const plans: SuspensionPlan[] = [];
    let date = rangeStart;
    const suspendedUsers = new Set<number>();
    const rangeEndMs = rangeEnd.getTime();
    const stepMs = milliseconds({ hours: stepHours });

    while (date.getTime() <= rangeEndMs) {
      const notAlreadySuspended = this.computeUsersToSuspendFromContext(
        date,
        context,
      )
        .map((candidate) => candidate.user)
        .filter((user) => !suspendedUsers.has(user.id));
      if (notAlreadySuspended.length > 0) {
        for (const user of notAlreadySuspended) {
          suspendedUsers.add(user.id);
        }
        plans.push({ date, users: notAlreadySuspended });
      }
      date = new Date(date.getTime() + stepMs);
    }
    return plans;
  }
}

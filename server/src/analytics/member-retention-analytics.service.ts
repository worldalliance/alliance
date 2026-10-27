import { ActionActivityType } from "@alliance/common/actionActivity";
import { findStartedMemberActionEvent } from "@alliance/common/actionEvent";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { sqlIsLatestCompletion } from "src/actions/action-activity-status";
import { ActionBranchService } from "src/actions/action-branch.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import {
  Action,
  loadedActionEvents,
  parseAction,
  type ParsedAction,
} from "src/actions/entities/action.entity";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { hasMemberActionDeadlinePassed } from "src/utils/action-user";
import { yieldToEventLoop } from "src/utils/event-loop";
import { type Repository } from "typeorm";
import { formatDateKey } from "./date-key";
import {
  countsTowardCompletionRate,
  countsTowardMemberAnalytics,
} from "./member-analytics-action";
import {
  MemberCompletionRetentionCohort,
  MemberCompletionRetentionPoint,
} from "./member-completion-retention.dto";
import { MemberReliabilityWindow } from "./member-reliability-window.dto";

@Injectable()
export class MemberRetentionAnalyticsService {
  constructor(
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly actionBranchService: ActionBranchService,
  ) {}

  async getMemberCompletionRetentionByCohort(
    includeOptional = true,
    startInFollowingWeek = false,
  ): Promise<MemberCompletionRetentionCohort[]> {
    const signedEvents = await this.contractEventRepository
      .createQueryBuilder("event")
      .select("user.id", "userId")
      .addSelect("MIN(event.date)", "signedAt")
      .innerJoin("event.user", "user")
      .where("event.type = :type", { type: ContractEventType.SIGNED })
      .groupBy("user.id")
      .getRawMany<{ userId: number; signedAt: string }>();

    const memberSignedAtByUserId = new Map<number, Date>();

    for (const row of signedEvents) {
      const userId = Number(row.userId);
      if (Number.isNaN(userId)) {
        continue;
      }
      const signedAt = new Date(row.signedAt);
      if (Number.isNaN(signedAt.getTime())) {
        continue;
      }
      memberSignedAtByUserId.set(userId, signedAt);
    }

    if (memberSignedAtByUserId.size === 0) {
      console.log("No signed users found");
      return [];
    }

    const completionActivities = await this.actionActivityRepository
      .createQueryBuilder("activity")
      .select(["activity.id", "activity.userId", "activity.actionId"])
      .where(sqlIsLatestCompletion("activity"))
      .getMany();

    const completedLookup = new Set<string>();
    for (const activity of completionActivities) {
      completedLookup.add(`${activity.userId}:${activity.actionId}`);
    }

    type CohortWeekBucket = {
      joinedCount: number;
      completedCount: number;
      actionCounts: Map<
        number,
        { actionId: number; actionName: string; memberCount: number }
      >;
    };

    const cohortWeekTotals = new Map<number, Map<number, CohortWeekBucket>>();
    const actions = await this.actionRepository
      .find({
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));
    const now = new Date();

    const eligibleActions: {
      action: ParsedAction;
      memberActionEvent: ActionEvent;
      startDate: Date;
    }[] = [];

    for (const action of actions) {
      if (
        !countsTowardMemberAnalytics(action) ||
        (!includeOptional && action.optional)
      ) {
        continue;
      }
      const sortedEvents = loadedActionEvents(action).sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const memberActionEvent = findStartedMemberActionEvent(sortedEvents, now);

      if (!memberActionEvent) {
        continue;
      }

      const memberActionDeadlineDate =
        action.memberActionPhase.deadlineEvent?.date;

      if (!hasMemberActionDeadlinePassed(memberActionDeadlineDate, now)) {
        continue;
      }

      eligibleActions.push({
        action,
        memberActionEvent,
        startDate: memberActionEvent.date,
      });
    }

    if (eligibleActions.length === 0) {
      return [];
    }

    const groupedActions = new Map<
      string,
      { date: Date; startAt: Date; entries: typeof eligibleActions }
    >();

    for (const entry of eligibleActions) {
      const dateKey = formatDateKey(entry.startDate);
      const group = groupedActions.get(dateKey) ?? {
        date: new Date(`${dateKey}T00:00:00Z`),
        startAt: entry.startDate,
        entries: [],
      };
      if (entry.startDate < group.startAt) {
        group.startAt = entry.startDate;
      }
      group.entries.push(entry);
      groupedActions.set(dateKey, group);
    }

    const actionGroups = Array.from(groupedActions.values()).sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );

    const actionStartDates = actionGroups.map((group) => group.date);
    const cohortIndexByUserId = new Map<number, number>();
    const cohortMembers = new Map<number, Set<number>>();
    for (const [userId, signedAt] of memberSignedAtByUserId) {
      const firstAssignmentDate = new Date(signedAt);
      if (startInFollowingWeek) {
        firstAssignmentDate.setUTCHours(0, 0, 0, 0);
        const daysUntilNextMonday =
          7 - ((firstAssignmentDate.getUTCDay() + 6) % 7);
        firstAssignmentDate.setUTCDate(
          firstAssignmentDate.getUTCDate() + daysUntilNextMonday,
        );
      }
      const cohortIndex = actionGroups.findIndex((group) =>
        startInFollowingWeek
          ? group.startAt >= firstAssignmentDate
          : signedAt < group.startAt,
      );
      if (cohortIndex < 0) {
        continue;
      }
      cohortIndexByUserId.set(userId, cohortIndex);
      const members = cohortMembers.get(cohortIndex) ?? new Set<number>();
      members.add(userId);
      cohortMembers.set(cohortIndex, members);
    }

    const [baseUsersByAction, optionalBranchMembers, doesntApplyWithdrawals] =
      await Promise.all([
        this.actionEventRecipientService.findBaseUsersForEvents({
          entries: actionGroups.flatMap((group) =>
            group.entries.map((entry) => ({
              action: entry.action,
              eventId: entry.memberActionEvent.id,
            })),
          ),
          includeSuspended: true,
        }),
        this.actionBranchService.findOptionalBranchMemberIds({
          actionIds: eligibleActions.map(({ action }) => action.id),
        }),
        this.actionActivityRepository.find({
          where: {
            type: ActionActivityType.USER_WONT_COMPLETE,
            doesntApply: true,
          },
          select: { userId: true, actionId: true },
        }),
      ]);
    const withdrewDoesntApply = new Set(
      doesntApplyWithdrawals.map(
        (activity) => `${activity.userId}:${activity.actionId}`,
      ),
    );

    for (const [actionIndex, group] of actionGroups.entries()) {
      // Long CPU-bound accumulation; let queued requests run between groups.
      await yieldToEventLoop();
      for (const entry of group.entries) {
        const { action } = entry;
        const baseUsers = baseUsersByAction.get(action.id) ?? [];

        for (const user of baseUsers) {
          const signedAt = memberSignedAtByUserId.get(user.id);
          if (!signedAt) {
            continue;
          }
          const cohortIndex = cohortIndexByUserId.get(user.id);
          if (cohortIndex === undefined) {
            continue;
          }
          const weekIndex = actionIndex - cohortIndex;
          if (weekIndex < 0) {
            continue;
          }
          const key = `${user.id}:${action.id}`;
          const completed = completedLookup.has(key);
          if (
            !countsTowardCompletionRate({
              completed,
              onOptionalBranch: !!optionalBranchMembers
                .get(action.id)
                ?.has(user.id),
              withdrewDoesntApply: withdrewDoesntApply.has(key),
            })
          ) {
            continue;
          }

          const weekMap =
            cohortWeekTotals.get(cohortIndex) ??
            new Map<number, CohortWeekBucket>();
          const bucket = weekMap.get(weekIndex) ?? {
            joinedCount: 0,
            completedCount: 0,
            actionCounts: new Map(),
          };
          bucket.joinedCount += 1;
          const actionBucket = bucket.actionCounts.get(action.id) ?? {
            actionId: action.id,
            actionName: action.name,
            memberCount: 0,
          };
          actionBucket.memberCount += 1;
          bucket.actionCounts.set(action.id, actionBucket);
          if (completed) {
            bucket.completedCount += 1;
          }
          weekMap.set(weekIndex, bucket);
          cohortWeekTotals.set(cohortIndex, weekMap);
        }
      }
    }

    return Array.from(cohortWeekTotals.entries())
      .sort(([cohortA], [cohortB]) => cohortA - cohortB)
      .map(([cohortIndex, weekMap]) => {
        const cohortStartDate = actionStartDates[cohortIndex];
        const cohortStart = formatDateKey(cohortStartDate);
        const weeks = Array.from(weekMap.entries()).sort(
          ([weekA], [weekB]) => weekA - weekB,
        );
        let cumulativeJoined = 0;
        let cumulativeCompleted = 0;
        const points: MemberCompletionRetentionPoint[] = weeks.map(
          ([weekIndex, counts]) => {
            const actionIndex = cohortIndex + weekIndex;
            const actionStartDate = actionStartDates[actionIndex];
            cumulativeJoined += counts.joinedCount;
            cumulativeCompleted += counts.completedCount;
            const weekCompletionRate =
              counts.joinedCount > 0
                ? counts.completedCount / counts.joinedCount
                : 0;
            const actions = Array.from(counts.actionCounts.values()).sort(
              (a, b) =>
                b.memberCount - a.memberCount ||
                a.actionName.localeCompare(b.actionName),
            );
            return {
              weekIndex,
              actionIndex,
              actionStartDate: formatDateKey(
                actionStartDate ?? cohortStartDate,
              ),
              completionRate:
                cumulativeJoined > 0
                  ? cumulativeCompleted / cumulativeJoined
                  : 0,
              joinedCount: cumulativeJoined,
              completedCount: cumulativeCompleted,
              weekCompletionRate,
              weekJoinedCount: counts.joinedCount,
              weekCompletedCount: counts.completedCount,
              actions,
            };
          },
        );

        return {
          cohortStart,
          cohortSize: cohortMembers.get(cohortIndex)?.size ?? 0,
          points,
        };
      });
  }

  async getMemberReliabilityWindow(
    weeks: number,
  ): Promise<MemberReliabilityWindow> {
    const normalizedWeeks = Math.max(1, Math.floor(weeks));
    const cohorts = await this.getMemberCompletionRetentionByCohort(
      false,
      true,
    );
    const points = cohorts.flatMap((cohort) => cohort.points);
    const latestActionIndex = Math.max(
      ...points.map((point) => point.actionIndex),
    );
    const earliestActionIndex = latestActionIndex - normalizedWeeks + 1;

    const summarize = (
      includePoint: (point: MemberCompletionRetentionPoint) => boolean,
    ): MemberReliabilityWindow["firstWeek"] => {
      const matchingPoints = points.filter(
        (point) =>
          point.actionIndex >= earliestActionIndex && includePoint(point),
      );
      const assignedCount = matchingPoints.reduce(
        (total, point) => total + point.weekJoinedCount,
        0,
      );
      const completedCount = matchingPoints.reduce(
        (total, point) => total + point.weekCompletedCount,
        0,
      );
      return {
        assignedCount,
        completedCount,
        completionRate: assignedCount > 0 ? completedCount / assignedCount : 0,
      };
    };

    if (!Number.isFinite(latestActionIndex)) {
      const emptyRate = {
        assignedCount: 0,
        completedCount: 0,
        completionRate: 0,
      };
      return {
        weeks: normalizedWeeks,
        firstWeek: emptyRate,
        fourthWeekOrLater: emptyRate,
      };
    }

    return {
      weeks: normalizedWeeks,
      firstWeek: summarize((point) => point.weekIndex === 0),
      fourthWeekOrLater: summarize((point) => point.weekIndex >= 3),
    };
  }
}

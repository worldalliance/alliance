import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { millisecondsInDay, millisecondsInHour } from "date-fns/constants";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionStatus } from "src/actions/entities/action-event.entity";
import { Action, parseAction } from "src/actions/entities/action.entity";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import { ActionCompletionCurve } from "./action-completion-curve.dto";
import { ActionStatsWithOnboarding } from "./actionstats-with-onboarding.dto";
import { ActionStatsRecord } from "./actionstats.entity";

@Injectable()
export class ActionStatsAnalyticsService {
  private readonly logger = new Logger(ActionStatsAnalyticsService.name);

  constructor(
    @InjectRepository(ActionStatsRecord)
    private readonly actionStatsRepository: TypedRepository<ActionStatsRecord>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
  ) {}

  private getActionCompletedDate(action: Action): Date | null {
    if (!action.events) return null;

    const completedStatuses = [
      ActionStatus.Completed,
      ActionStatus.Failed,
      ActionStatus.Abandoned,
      ActionStatus.Resolution,
    ];

    const completedEvent = action.events
      .filter(
        (e) => completedStatuses.includes(e.newStatus) && e.date < new Date(),
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    return completedEvent?.date ?? null;
  }

  @Cron("0 9 * * *") // Daily at 9 AM
  async calculateActionStats() {
    this.logger.log("Starting action stats calculation");

    const now = new Date();

    const actions = await this.actionRepository
      .find({
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));

    const actionIds = actions.map((action) => action.id);
    const withdrawalByActionId = new Map<number, number>();
    const dismissalByActionId = new Map<number, number>();
    if (actionIds.length > 0) {
      const withdrawalCounts = await this.actionActivityRepository
        .createQueryBuilder("activity")
        .select("activity.actionId", "actionId")
        .addSelect("COUNT(DISTINCT activity.userId)", "withdrawnCount")
        .where("activity.actionId IN (:...actionIds)", { actionIds })
        .andWhere("activity.type IN (:...types)", {
          types: [ActionActivityType.USER_WONT_COMPLETE],
        })
        .groupBy("activity.actionId")
        .getRawMany<{ actionId: string; withdrawnCount: string }>();

      for (const row of withdrawalCounts) {
        const actionId = Number(row.actionId);
        const withdrawnCount = Number(row.withdrawnCount);
        if (!Number.isNaN(actionId) && !Number.isNaN(withdrawnCount)) {
          withdrawalByActionId.set(actionId, withdrawnCount);
        }
      }

      const dismissalCounts = await this.actionActivityRepository
        .createQueryBuilder("activity")
        .select("activity.actionId", "actionId")
        .addSelect("COUNT(DISTINCT activity.userId)", "dismissedCount")
        .where("activity.actionId IN (:...actionIds)", { actionIds })
        .andWhere("activity.type = :type", {
          type: ActionActivityType.USER_DISMISSED,
        })
        .groupBy("activity.actionId")
        .getRawMany<{ actionId: string; dismissedCount: string }>();

      for (const row of dismissalCounts) {
        const actionId = Number(row.actionId);
        const dismissedCount = Number(row.dismissedCount);
        if (!Number.isNaN(actionId) && !Number.isNaN(dismissedCount)) {
          dismissalByActionId.set(actionId, dismissedCount);
        }
      }
    }

    for (const action of actions) {
      // Skip draft actions
      if (action.status === ActionStatus.Draft) {
        continue;
      }

      // Check if action has been completed more than 1 week ago
      const completedDate = this.getActionCompletedDate(action);
      //   if (completedDate && completedDate < oneWeekAgo) {
      //     // Skip recalculating for old completed actions
      //     continue;
      //   }

      const usersJoined = action.usersJoined;
      const usersCompleted = action.usersCompleted;
      const usersWithdrawn = withdrawalByActionId.get(action.id) ?? 0;
      const usersDismissed = dismissalByActionId.get(action.id) ?? 0;
      const completionRate = usersJoined > 0 ? usersCompleted / usersJoined : 0;

      // Find member_action event dates
      const sortedEvents = (action.events ?? []).sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const memberActionEvent = sortedEvents.find(
        (e) => e.newStatus === ActionStatus.MemberAction,
      );
      const memberActionStartDate = memberActionEvent?.date ?? null;

      // Find the end date (first event after member_action that changes status)
      let memberActionEndDate: Date | null = null;
      if (memberActionEvent) {
        const endEvent = sortedEvents.find(
          (e) =>
            e.date > memberActionEvent.date &&
            e.newStatus !== ActionStatus.MemberAction,
        );
        memberActionEndDate = endEvent?.date ?? null;
      }

      // Determine if action should show in chart:
      // - not publicOnly
      // - has a member_action event
      const showInChart =
        !action.publicOnly && !!memberActionEvent && !action.onboarding;

      const existingRecord = await this.actionStatsRepository.findOne({
        where: { actionId: action.id },
      });

      if (existingRecord) {
        existingRecord.actionName = action.name;
        existingRecord.usersCompleted = usersCompleted;
        existingRecord.usersJoined = usersJoined;
        existingRecord.usersWithdrawn = usersWithdrawn;
        existingRecord.usersDismissed = usersDismissed;
        existingRecord.completionRate = completionRate;
        existingRecord.lastCalculatedAt = now;
        existingRecord.actionCompletedAt = completedDate;
        existingRecord.showInChart = showInChart;
        existingRecord.memberActionStartDate = memberActionStartDate;
        existingRecord.memberActionEndDate = memberActionEndDate;
        await this.actionStatsRepository.save(existingRecord);
      } else {
        const newRecord = this.actionStatsRepository.create({
          actionId: action.id,
          actionName: action.name,
          usersCompleted,
          usersJoined,
          usersWithdrawn,
          usersDismissed,
          completionRate,
          lastCalculatedAt: now,
          actionCompletedAt: completedDate,
          showInChart,
          memberActionStartDate,
          memberActionEndDate,
        });
        await this.actionStatsRepository.save(newRecord);
      }
    }

    this.logger.log("Finished action stats calculation");
  }

  async getActionStats(): Promise<ActionStatsWithOnboarding[]> {
    const records = await this.actionStatsRepository.find({
      order: { actionId: "ASC" },
    });

    if (records.length === 0) {
      return [];
    }

    const actionIds = records.map((record) => record.actionId);
    const actions = await this.actionRepository.find({
      where: { id: In(actionIds) },
      select: { id: true, onboarding: true, optional: true },
    });
    const onboardingByActionId = new Map<number, boolean>();
    const optionalByActionId = new Map<number, boolean>();
    for (const action of actions) {
      onboardingByActionId.set(action.id, action.onboarding);
      optionalByActionId.set(action.id, action.optional);
    }

    return records.map((record) => ({
      actionStatsRecord: record,
      onboarding: onboardingByActionId.get(record.actionId) ?? false,
      optional: optionalByActionId.get(record.actionId) ?? false,
    }));
  }

  async getActionStatsById(
    actionId: number,
  ): Promise<ActionStatsWithOnboarding | null> {
    const record = await this.actionStatsRepository.findOne({
      where: { actionId },
    });

    if (!record) {
      return null;
    }

    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      select: { id: true, onboarding: true, optional: true },
    });

    return {
      actionStatsRecord: record,
      onboarding: action?.onboarding ?? false,
      optional: action?.optional ?? false,
    };
  }

  async getActionCompletionCurves(
    actionId?: number,
    granularity: "daily" | "hourly" = "daily",
  ): Promise<ActionCompletionCurve[]> {
    const whereClause: { showInChart: boolean; actionId?: number } = {
      showInChart: true,
    };
    if (actionId !== undefined) {
      whereClause.actionId = actionId;
    }

    const actionStats = await this.actionStatsRepository.find({
      where: whereClause,
      order: { actionId: "ASC" },
    });

    if (actionStats.length === 0) {
      return [];
    }

    const now = new Date();
    const actionIds = actionStats.map((record) => record.actionId);
    const actions = await this.actionRepository.find({
      where: { id: In(actionIds) },
      select: { id: true, onboarding: true },
    });

    const onboardingByActionId = new Map<number, boolean>();
    for (const action of actions) {
      onboardingByActionId.set(action.id, action.onboarding);
    }

    const maxDurationDays = 21;

    const eligibleActions = actionStats.filter(
      (record): record is typeof record & { memberActionStartDate: Date } => {
        if (!record.memberActionStartDate || record.usersJoined <= 0) {
          return false;
        }
        if (record.memberActionStartDate > now) {
          return false;
        }
        if (onboardingByActionId.get(record.actionId)) {
          return false;
        }
        const plannedEnd = record.memberActionEndDate ?? now;
        const durationDays = Math.ceil(
          (plannedEnd.getTime() - record.memberActionStartDate.getTime()) /
            millisecondsInDay,
        );
        if (!Number.isFinite(durationDays) || durationDays <= 0) {
          return false;
        }
        return durationDays <= maxDurationDays;
      },
    );

    if (eligibleActions.length === 0) {
      return [];
    }

    const eligibleActionIds = eligibleActions.map((record) => record.actionId);
    const completionActivities = await this.actionActivityRepository.find({
      where: {
        actionId: In(eligibleActionIds),
        type: ActionActivityType.USER_COMPLETED,
      },
      select: { actionId: true, createdAt: true },
      order: { createdAt: "ASC" },
    });

    const completionsByActionId = new Map<number, Date[]>();
    for (const activity of completionActivities) {
      const list = completionsByActionId.get(activity.actionId) ?? [];
      list.push(activity.createdAt);
      completionsByActionId.set(activity.actionId, list);
    }

    const isHourly = granularity === "hourly";
    const msPerBucket = isHourly ? millisecondsInHour : millisecondsInDay;

    return eligibleActions.map((record) => {
      const startDate = new Date(record.memberActionStartDate);
      const plannedEndDate = record.memberActionEndDate
        ? new Date(record.memberActionEndDate)
        : null;
      const endDate =
        plannedEndDate && plannedEndDate < now ? plannedEndDate : now;
      const bucketCount = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / msPerBucket),
      );

      const counts = new Array<number>(bucketCount).fill(0);
      const completions = completionsByActionId.get(record.actionId) ?? [];

      for (const completionDate of completions) {
        if (completionDate < startDate || completionDate > endDate) {
          continue;
        }
        const rawIndex = Math.floor(
          (completionDate.getTime() - startDate.getTime()) / msPerBucket,
        );
        if (rawIndex < 0 || rawIndex >= bucketCount) {
          continue;
        }
        counts[rawIndex] += 1;
      }

      const fractions = counts.map((count) => count / record.usersJoined);

      if (isHourly) {
        return {
          actionId: record.actionId,
          actionName: record.actionName,
          usersJoined: record.usersJoined,
          memberActionStartDate: record.memberActionStartDate,
          memberActionEndDate: record.memberActionEndDate,
          bucketDays: 0,
          dayOffsets: [],
          completedCounts: counts,
          completionFractions: fractions,
          bucketHours: 1,
          hourOffsets: Array.from({ length: bucketCount }, (_, index) => index),
        } satisfies ActionCompletionCurve;
      }

      return {
        actionId: record.actionId,
        actionName: record.actionName,
        usersJoined: record.usersJoined,
        memberActionStartDate: record.memberActionStartDate,
        memberActionEndDate: record.memberActionEndDate,
        bucketDays: 1,
        dayOffsets: Array.from({ length: bucketCount }, (_, index) => index),
        completedCounts: counts,
        completionFractions: fractions,
      } satisfies ActionCompletionCurve;
    });
  }
}

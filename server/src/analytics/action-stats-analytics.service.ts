import { ActionActivityType } from "@alliance/common/actionActivity";
import { hasTakenEffect } from "@alliance/common/actionEvent";
import { Injectable, Logger } from "@nestjs/common";
import { WithoutOverlapping } from "@nestjs/locks";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { millisecondsInDay, millisecondsInHour } from "date-fns/constants";
import {
  sqlIsLatestCompletion,
  sqlIsLatestWithdrawal,
} from "src/actions/action-activity-status";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionStatus } from "src/actions/entities/action-event.entity";
import {
  Action,
  loadedActionEvents,
  parseAction,
} from "src/actions/entities/action.entity";
import { startComputation } from "src/datasources/computation";
import { CronLease } from "src/leases/cron-lease";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import { ActionCompletionCurve } from "./action-completion-curve.dto";
import { ActionStatsWithOnboarding } from "./actionstats-with-onboarding.dto";
import { ActionStatsRecord } from "./actionstats.entity";
import { countsTowardMemberAnalytics } from "./member-analytics-action";

type StatsRow = Omit<ActionStatsRecord, "id" | "deletedAt">;

const STATS_COLUMNS = Object.keys({
  actionId: true,
  actionName: true,
  usersCompleted: true,
  usersJoined: true,
  usersWithdrawn: true,
  usersDismissed: true,
  completionRate: true,
  lastCalculatedAt: true,
  actionCompletedAt: true,
  showInChart: true,
  memberActionStartDate: true,
  memberActionEndDate: true,
  computation: true,
} satisfies Record<keyof StatsRow, true>);

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
    const completedStatuses = [
      ActionStatus.Completed,
      ActionStatus.Failed,
      ActionStatus.Abandoned,
      ActionStatus.Resolution,
    ];

    const completedEvent = loadedActionEvents(action)
      .filter(
        (e) =>
          completedStatuses.includes(e.newStatus) &&
          hasTakenEffect(e.date, new Date()),
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

    return completedEvent?.date ?? null;
  }

  @Cron("0 9 * * *") // Daily at 9 AM
  @WithoutOverlapping({ key: CronLease.ActionStatsAnalytics })
  async calculateActionStatsOnSchedule() {
    await this.calculateActionStats();
  }

  /** Skips the lease; the schedule runs it through calculateActionStatsOnSchedule. */
  async calculateActionStats() {
    this.logger.log("Starting action stats calculation");

    const computation = await startComputation({
      manager: this.actionStatsRepository.manager,
      table: "action_stats_record",
      column: "computation",
    });
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
        .andWhere(sqlIsLatestWithdrawal("activity"))
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

    const records: StatsRow[] = [];
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

      const { event: memberActionEvent, deadlineEvent } =
        action.memberActionPhase;
      const memberActionStartDate = memberActionEvent?.date ?? null;
      const memberActionEndDate = deadlineEvent?.date ?? null;

      const showInChart =
        countsTowardMemberAnalytics(action) && !!memberActionEvent;

      records.push({
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
        computation,
      });
    }

    await this.publishActionStats(records);
    this.logger.log("Finished action stats calculation");
  }

  // The named column list keeps `computation`, which TypeORM leaves out of a
  // Postgres insert that names no columns. Rows go in actionId order so
  // overlapping runs lock them in one order and can't deadlock.
  private async publishActionStats(records: StatsRow[]): Promise<void> {
    if (records.length === 0) return;
    await this.actionStatsRepository
      .createQueryBuilder()
      .insert()
      .into(ActionStatsRecord, STATS_COLUMNS)
      .values(records.toSorted((a, b) => a.actionId - b.actionId))
      .orUpdate(
        STATS_COLUMNS.filter((column) => column !== "actionId"),
        ["actionId"],
        {
          overwriteCondition: {
            where: `action_stats_record."computation" < EXCLUDED."computation"`,
          },
        },
      )
      .execute();
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
        if (!hasTakenEffect(record.memberActionStartDate, now)) {
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
    const completionActivities = await this.actionActivityRepository
      .createQueryBuilder("activity")
      .select(["activity.id", "activity.actionId", "activity.createdAt"])
      .where("activity.actionId IN (:...actionIds)", {
        actionIds: eligibleActionIds,
      })
      .andWhere(sqlIsLatestCompletion("activity"))
      .orderBy("activity.createdAt", "ASC")
      .getMany();

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

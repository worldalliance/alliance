import { ActionActivityType } from '@alliance/common/actionActivity';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import {
  Action,
  parseAction,
  type ParsedAction,
} from 'src/actions/entities/action.entity';
import { ReminderGroup } from 'src/actions/entities/reminder-group.entity';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import { CohortResolutionSession } from 'src/notifs/cohort-resolution-session';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from 'src/user/entities/onetime-invite.entity';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { yieldToEventLoop } from 'src/utils/event-loop';
import { Between, In, IsNull, type Repository } from 'typeorm';
import { ActionCompletionCurve } from './action-completion-curve.dto';
import { ActionStatsWithOnboarding } from './actionstats-with-onboarding.dto';
import { ActionStatsRecord } from './actionstats.entity';
import { AggregateStats } from './aggregatestats.dto';
import { ContractStatusPoint } from './contract-status-history.dto';
import { DailyStatsRecord } from './dailystats.entity';
import { InviteFunnel } from './invite-funnel.dto';
import {
  MemberCompletionRetentionCohort,
  MemberCompletionRetentionPoint,
} from './member-completion-retention.dto';
import { MemberReliabilityWindow } from './member-reliability-window.dto';
import { MissedActions } from './missed-actions.dto';
import { PlatformTenureCohortStats } from './platform-tenure-cohort.dto';
import { ReminderGroupClickRatePoint } from './reminder-group-click-rates.dto';
import { TimeSpentForUser } from './timespent.dto';

@Injectable()
export class AnalyticsService {
  private readonly API_KEY: string;
  private readonly PROJECT_ID: string;
  private readonly logger = new Logger(AnalyticsService.name);

  private timeSpentPerUserLast7Days: TimeSpentForUser[] = [];
  private timeSpentPerUserTotal: TimeSpentForUser[] = [];

  getQuery(range: 'last7Days' | 'total') {
    return `
WITH scoped_sessions AS (
  SELECT
    e.person_id,
    e.session.id                                          AS session_id,
    /* duration is identical across events in a session, but we compute once explicitly */
    toFloat(e.session.$end_timestamp - e.session.$start_timestamp) AS raw_duration
  FROM events AS e
  WHERE e.event = '$pageview'
    ${range === 'last7Days' ? 'AND e.timestamp >= now() - INTERVAL 7 DAY' : ''}
    AND e.person_id IS NOT NULL
    AND e.session.id IS NOT NULL
    AND e.session.$start_timestamp IS NOT NULL
    AND e.session.$end_timestamp IS NOT NULL
)
/* 2) Keep one row per (person_id, session_id) and clamp duration to a reasonable window */
, per_session AS (
  SELECT
    person_id,
    session_id,
    /* drop negatives and absurdly long sessions (e.g. > 8h) */
    greatest(0, least(raw_duration, 8*60*60)) AS session_duration
  FROM scoped_sessions
  GROUP BY person_id, session_id, raw_duration
)
, per_person AS (
  SELECT
    person_id,
    sum(session_duration) AS total_session_duration_seconds
  FROM per_session
  GROUP BY person_id
)
SELECT
  pp.person_id,
  JSONExtractString(p.properties, 'email') AS email,
  pp.total_session_duration_seconds
FROM per_person AS pp
JOIN persons AS p ON p.id = pp.person_id
ORDER BY pp.total_session_duration_seconds DESC
          `;
  }

  constructor(
    private readonly userService: UserService,
    @InjectRepository(DailyStatsRecord)
    private readonly dailyStatsRepository: Repository<DailyStatsRecord>,
    @InjectRepository(ActionStatsRecord)
    private readonly actionStatsRepository: Repository<ActionStatsRecord>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(OnetimeInvite)
    private readonly onetimeInviteRepository: Repository<OnetimeInvite>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(ReminderGroup)
    private readonly reminderGroupRepository: Repository<ReminderGroup>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifRepository: Repository<ActionEventNotif>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
  ) {
    if (!process.env.POSTHOG_QUERY_KEY || !process.env.POSTHOG_PROJECT_ID) {
      this.logger.warn('POSTHOG_QUERY_KEY or POSTHOG_PROJECT_ID is not set');
      return;
    }
    this.API_KEY = process.env.POSTHOG_QUERY_KEY;
    this.PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
  }

  async getPosthogData(
    range: 'last7Days' | 'total',
  ): Promise<TimeSpentForUser[]> {
    const users = await this.userService.findAllUsers();

    const emailToUserId: Record<string, number> = Object.fromEntries(
      users.map((user) => [user.email, user.id]),
    );

    const body = {
      query: {
        kind: 'HogQLQuery',
        query: this.getQuery(range),
      },
    };

    const res = await fetch(
      `https://app.posthog.com/api/projects/${this.PROJECT_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!data || !data.results) {
      return [];
    }

    const results = data.results.map((result) => {
      return {
        person_id: result[0],
        email: result[1],
        total_session_duration_seconds: result[2],
      };
    });

    const timeSpentPerUser: TimeSpentForUser[] = results.map(
      (result) =>
        ({
          userId: emailToUserId[result.email],
          timeSpent: result.total_session_duration_seconds,
        }) satisfies TimeSpentForUser,
    );
    return timeSpentPerUser;
  }

  @Cron('* * * * *')
  async getTimeSpentFromPosthog() {
    if (!this.API_KEY) {
      this.logger.warn('POSTHOG_QUERY_KEY or POSTHOG_PROJECT_ID is not set');
      return;
    }
    if (
      process.env.NODE_ENV === 'development' &&
      !process.env.DEV_POSTHOG_ANALYTICS
    ) {
      return;
    }
    const timeSpentPerUserLast7Days = await this.getPosthogData('last7Days');
    const timeSpentPerUserTotal = await this.getPosthogData('total');

    this.timeSpentPerUserLast7Days = timeSpentPerUserLast7Days;
    this.timeSpentPerUserTotal = timeSpentPerUserTotal;
  }

  async getTimeSpentPerUser(): Promise<TimeSpentForUser[]> {
    return this.timeSpentPerUserLast7Days;
  }

  async getTimeSpentPerUserTotal(): Promise<TimeSpentForUser[]> {
    return this.timeSpentPerUserTotal;
  }

  @Cron('0 8,20 * * *')
  async calculateDailyStats() {
    const now = new Date();
    const dayId = now.toISOString().split('T')[0];

    if (await this.dailyStatsRepository.findOne({ where: { dayId } })) {
      return;
    }

    const users = await this.userRepository.find({
      relations: { contractEvents: true },
    });

    const signedUsers = users.filter(
      (user) => user.hasActiveContract === true,
    ).length;

    const suspendedUsers = users.filter(
      (user) =>
        user.contractEvents!.some(
          (event) => event.type === ContractEventType.SUSPENDED,
        ) && user.hasActiveContract === false,
    ).length;

    const completionActivities = await this.actionActivityRepository.count({
      where: {
        type: ActionActivityType.USER_COMPLETED,
      },
    });

    const anonFormSubmissions = await this.formResponseRepository.count({
      where: {
        user: IsNull(),
      },
    });

    const createdInvites = await this.onetimeInviteRepository.count();
    const acceptedInvites = await this.onetimeInviteRepository.count({
      where: {
        status: OnetimeInviteStatus.LINK_USED,
      },
    });

    const record = await this.dailyStatsRepository.create({
      dayId,
      date: now,
      signedMembers: signedUsers,
      suspendedMembers: suspendedUsers,
      actionsCompleted: completionActivities,
      anonFormSubmissions: anonFormSubmissions,
      invitesCreated: createdInvites,
      invitesAccepted: acceptedInvites,
    });
    await this.dailyStatsRepository.save(record);
  }

  async getDailyStats(
    startDate: string,
    endDate: string,
  ): Promise<DailyStatsRecord[]> {
    return this.dailyStatsRepository.find({
      where: {
        date: Between(new Date(startDate), new Date(endDate)),
      },
    });
  }

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

  @Cron('0 9 * * *') // Daily at 9 AM
  async calculateActionStats() {
    this.logger.log('Starting action stats calculation');

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
        .createQueryBuilder('activity')
        .select('activity.actionId', 'actionId')
        .addSelect('COUNT(DISTINCT activity.userId)', 'withdrawnCount')
        .where('activity.actionId IN (:...actionIds)', { actionIds })
        .andWhere('activity.type IN (:...types)', {
          types: [ActionActivityType.USER_WONT_COMPLETE],
        })
        .groupBy('activity.actionId')
        .getRawMany<{ actionId: string; withdrawnCount: string }>();

      for (const row of withdrawalCounts) {
        const actionId = Number(row.actionId);
        const withdrawnCount = Number(row.withdrawnCount);
        if (!Number.isNaN(actionId) && !Number.isNaN(withdrawnCount)) {
          withdrawalByActionId.set(actionId, withdrawnCount);
        }
      }

      const dismissalCounts = await this.actionActivityRepository
        .createQueryBuilder('activity')
        .select('activity.actionId', 'actionId')
        .addSelect('COUNT(DISTINCT activity.userId)', 'dismissedCount')
        .where('activity.actionId IN (:...actionIds)', { actionIds })
        .andWhere('activity.type = :type', {
          type: ActionActivityType.USER_DISMISSED,
        })
        .groupBy('activity.actionId')
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
        existingRecord.actionCompletedAt = completedDate ?? undefined;
        existingRecord.showInChart = showInChart;
        existingRecord.memberActionStartDate =
          memberActionStartDate ?? undefined;
        existingRecord.memberActionEndDate = memberActionEndDate ?? undefined;
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
          actionCompletedAt: completedDate ?? undefined,
          showInChart,
          memberActionStartDate: memberActionStartDate ?? undefined,
          memberActionEndDate: memberActionEndDate ?? undefined,
        });
        await this.actionStatsRepository.save(newRecord);
      }
    }

    this.logger.log('Finished action stats calculation');
  }

  async getActionStats(): Promise<ActionStatsWithOnboarding[]> {
    const records = await this.actionStatsRepository.find({
      order: { actionId: 'ASC' },
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
    granularity: 'daily' | 'hourly' = 'daily',
  ): Promise<ActionCompletionCurve[]> {
    const whereClause: { showInChart: boolean; actionId?: number } = {
      showInChart: true,
    };
    if (actionId !== undefined) {
      whereClause.actionId = actionId;
    }

    const actionStats = await this.actionStatsRepository.find({
      where: whereClause,
      order: { actionId: 'ASC' },
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

    const msPerDay = 24 * 60 * 60 * 1000;
    const maxDurationDays = 21;

    const eligibleActions = actionStats.filter((record) => {
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
          msPerDay,
      );
      if (!Number.isFinite(durationDays) || durationDays <= 0) {
        return false;
      }
      return durationDays <= maxDurationDays;
    });

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
      order: { createdAt: 'ASC' },
    });

    const completionsByActionId = new Map<number, Date[]>();
    for (const activity of completionActivities) {
      const list = completionsByActionId.get(activity.actionId) ?? [];
      list.push(activity.createdAt);
      completionsByActionId.set(activity.actionId, list);
    }

    const isHourly = granularity === 'hourly';
    const msPerBucket = isHourly ? 60 * 60 * 1000 : msPerDay;

    return eligibleActions.map((record) => {
      const startDate = new Date(record.memberActionStartDate!);
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
          memberActionStartDate: record.memberActionStartDate!,
          memberActionEndDate: record.memberActionEndDate ?? undefined,
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
        memberActionStartDate: record.memberActionStartDate!,
        memberActionEndDate: record.memberActionEndDate ?? undefined,
        bucketDays: 1,
        dayOffsets: Array.from({ length: bucketCount }, (_, index) => index),
        completedCounts: counts,
        completionFractions: fractions,
      } satisfies ActionCompletionCurve;
    });
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async getMemberCompletionRetentionByCohort(
    includeOptional = true,
    startInFollowingWeek = false,
  ): Promise<MemberCompletionRetentionCohort[]> {
    const signedEvents = await this.contractEventRepository
      .createQueryBuilder('event')
      .select('user.id', 'userId')
      .addSelect('MIN(event.date)', 'signedAt')
      .innerJoin('event.user', 'user')
      .where('event.type = :type', { type: ContractEventType.SIGNED })
      .groupBy('user.id')
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
      console.log('No signed users found');
      return [];
    }

    const completionActivities = await this.actionActivityRepository.find({
      where: { type: ActionActivityType.USER_COMPLETED },
      select: { userId: true, actionId: true },
    });

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
        action.publicOnly ||
        action.onboarding ||
        (!includeOptional && action.optional)
      ) {
        continue;
      }
      const sortedEvents = (action.events ?? []).sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const memberActionEvent = sortedEvents.find(
        (event) =>
          event.newStatus === ActionStatus.MemberAction && event.date <= now,
      );

      if (!memberActionEvent) {
        continue;
      }

      const memberActionDeadlineDate =
        action.memberActionPhase.deadlineEvent?.date;

      if (!memberActionDeadlineDate || memberActionDeadlineDate > now) {
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
      const dateKey = this.formatDateKey(entry.startDate);
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

    const baseUsersByAction =
      await this.actionEventRecipientService.findBaseUsersForEvents({
        entries: actionGroups.flatMap((group) =>
          group.entries.map((entry) => ({
            action: entry.action,
            eventId: entry.memberActionEvent.id,
          })),
        ),
        includeSuspended: true,
      });

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
          if (completedLookup.has(`${user.id}:${action.id}`)) {
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
        const cohortStart = this.formatDateKey(cohortStartDate);
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
              actionStartDate: this.formatDateKey(
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
    ): MemberReliabilityWindow['firstWeek'] => {
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

  async getReminderGroupClickRates(): Promise<ReminderGroupClickRatePoint[]> {
    // Every reminder group attached to a member_action event, with the owning
    // action for labelling. The explicit select keeps the groups' message-text
    // columns out of the result.
    const groups = await this.reminderGroupRepository.find({
      select: {
        id: true,
        name: true,
        sendAtAbsolute: true,
        memberActionEvent: {
          id: true,
          date: true,
          action: { id: true, name: true },
        },
      },
      where: { memberActionEvent: { newStatus: ActionStatus.MemberAction } },
      relations: { memberActionEvent: { action: true } },
    });

    // Aggregate in SQL: hydrating every sent notif (with mail.renderedHtml and
    // the group text blobs joined onto each row) just to count clicks stalls
    // the whole event loop once the notif table is large.
    const groupIds = groups.map((group) => group.id);
    const aggregateRows: Array<{
      reminderGroupId: number;
      emailSentCount: number;
      emailClickedCount: number;
      textSentCount: number;
      textClickedCount: number;
      firstSentAt: Date | null;
    }> = groupIds.length
      ? await this.actionEventNotifRepository.query(
          `
            SELECT
              notif."reminderGroupId" AS "reminderGroupId",
              COUNT(mail."id")::int AS "emailSentCount",
              COUNT(mail."id") FILTER (WHERE mail."clickedLink")::int
                AS "emailClickedCount",
              COUNT(mms."id")::int AS "textSentCount",
              COUNT(mms."id") FILTER (WHERE mms."clickedLink")::int
                AS "textClickedCount",
              MIN(notif."createdAt") FILTER (
                WHERE mail."id" IS NOT NULL OR mms."id" IS NOT NULL
              ) AS "firstSentAt"
            FROM "action_event_notif" notif
            LEFT JOIN "mail" mail ON mail."id" = notif."mailId"
            LEFT JOIN "mms" mms ON mms."id" = notif."mmsId"
            WHERE notif."sent" AND notif."reminderGroupId" = ANY($1::int[])
            GROUP BY notif."reminderGroupId"
          `,
          [groupIds],
        )
      : [];

    const aggregatesByGroupId = new Map(
      aggregateRows.map((row) => [row.reminderGroupId, row]),
    );

    const points: ReminderGroupClickRatePoint[] = [];
    for (const group of groups) {
      const aggregate = aggregatesByGroupId.get(group.id);
      if (
        !aggregate ||
        (aggregate.emailSentCount === 0 && aggregate.textSentCount === 0)
      ) {
        continue;
      }

      // Plot each reminder-group at its first sent notification time, falling
      // back to its configured absolute send time or the member_action date.
      const pointDate =
        aggregate.firstSentAt ??
        group.sendAtAbsolute ??
        group.memberActionEvent.date;

      points.push({
        date: pointDate,
        reminderGroupId: group.id,
        reminderGroupName: group.name,
        actionId: group.memberActionEvent.action.id,
        actionName: group.memberActionEvent.action.name,
        emailClickRate:
          aggregate.emailSentCount > 0
            ? aggregate.emailClickedCount / aggregate.emailSentCount
            : 0,
        textClickRate:
          aggregate.textSentCount > 0
            ? aggregate.textClickedCount / aggregate.textSentCount
            : 0,
        emailSentCount: aggregate.emailSentCount,
        emailClickedCount: aggregate.emailClickedCount,
        textSentCount: aggregate.textSentCount,
        textClickedCount: aggregate.textClickedCount,
      });
    }

    return points.sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        a.reminderGroupId - b.reminderGroupId,
    );
  }

  async getMissedActions(): Promise<MissedActions> {
    const now = new Date();
    const actions = await this.actionRepository
      .find({
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));
    const completedActions = actions
      .filter(
        (action) =>
          !action.onboarding && !action.optional && !action.publicOnly,
      )
      .flatMap((action) => {
        const events = action.events.toSorted(
          (a, b) => a.date.getTime() - b.date.getTime(),
        );
        const memberActionEvent = events.find(
          (event) => event.newStatus === ActionStatus.MemberAction,
        );
        if (!memberActionEvent) return [];

        const deadlineEvent = events.find(
          (event) => event.date > memberActionEvent.date,
        );
        if (!deadlineEvent || deadlineEvent.date > now) return [];

        return [{ action, memberActionEvent }];
      })
      .sort(
        (a, b) =>
          b.memberActionEvent.date.getTime() -
          a.memberActionEvent.date.getTime(),
      );

    if (completedActions.length === 0) {
      return { missedLastAction: [], missedLastTwoActions: [] };
    }

    const baseUsersByAction =
      await this.actionEventRecipientService.findBaseUsersForEvents({
        entries: completedActions.map(({ action, memberActionEvent }) => ({
          action,
          eventId: memberActionEvent.id,
        })),
      });
    const activeUsers = new Map<number, User>();
    const participantsByAction = new Map<number, Set<number>>();
    for (const { action } of completedActions) {
      const activeParticipants = (
        baseUsersByAction.get(action.id) ?? []
      ).filter((user) => user.hasActiveContract);
      participantsByAction.set(
        action.id,
        new Set(activeParticipants.map((user) => user.id)),
      );
      for (const user of activeParticipants) {
        activeUsers.set(user.id, user);
      }
    }

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        userId: In(Array.from(activeUsers.keys())),
        actionId: In(completedActions.map(({ action }) => action.id)),
        type: ActionActivityType.USER_COMPLETED,
      },
      select: { userId: true, actionId: true },
    });
    const completedByUserAction = new Set(
      completionActivities.map(
        (activity) => `${activity.userId}:${activity.actionId}`,
      ),
    );

    const missedLastAction: MissedActions['missedLastAction'] = [];
    const missedLastTwoActions: MissedActions['missedLastTwoActions'] = [];
    for (const user of activeUsers.values()) {
      const assignedActions = completedActions.filter(({ action }) =>
        participantsByAction.get(action.id)?.has(user.id),
      );
      const [lastAction, previousAction] = assignedActions;
      const missedLast =
        lastAction &&
        !completedByUserAction.has(`${user.id}:${lastAction.action.id}`);
      if (!missedLast) continue;

      const member = {
        userId: user.id,
        name: user.name,
        lastActionName: lastAction.action.name,
      };
      missedLastAction.push(member);
      if (
        previousAction &&
        !completedByUserAction.has(`${user.id}:${previousAction.action.id}`)
      ) {
        missedLastTwoActions.push(member);
      }
    }

    const byName = (
      a: MissedActions['missedLastAction'][number],
      b: MissedActions['missedLastAction'][number],
    ) => a.name.localeCompare(b.name) || a.userId - b.userId;
    missedLastAction.sort(byName);
    missedLastTwoActions.sort(byName);
    return { missedLastAction, missedLastTwoActions };
  }

  async getPlatformTenureCohortStats(
    weeksOnPlatform: number,
  ): Promise<PlatformTenureCohortStats> {
    const normalizedWeeks = Math.max(0, Math.floor(weeksOnPlatform));
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const now = new Date();

    // Cohort membership needs a first SIGNED contract event, which partial
    // profiles can't have, so the active-user set covers everyone relevant —
    // and the session shares this load with findBaseUsersForEvents below.
    const session = new CohortResolutionSession();
    const users =
      await this.actionEventRecipientService.getActiveUsers(session);

    const cohortUserIds = new Set<number>();
    let activeCount = 0;

    for (const user of users) {
      const signedAt = (user.contractEvents ?? [])
        .filter((event) => event.type === ContractEventType.SIGNED)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date;

      if (!signedAt) {
        continue;
      }

      const tenureWeeks = Math.floor(
        (now.getTime() - signedAt.getTime()) / msPerWeek,
      );
      if (tenureWeeks === normalizedWeeks) {
        cohortUserIds.add(user.id);
        if (user.hasActiveContract) {
          activeCount += 1;
        }
      }
    }

    if (cohortUserIds.size === 0) {
      return {
        weeksOnPlatform: normalizedWeeks,
        cohortSize: 0,
        activeCount: 0,
        churnedCount: 0,
        churnRate: 0,
        assignedCount: 0,
        completedCount: 0,
        completionRate: 0,
        actions: [],
      };
    }

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        userId: In(Array.from(cohortUserIds)),
        type: ActionActivityType.USER_COMPLETED,
      },
      select: { userId: true, actionId: true },
    });

    const completedLookup = new Set<string>();
    for (const activity of completionActivities) {
      completedLookup.add(`${activity.userId}:${activity.actionId}`);
    }

    const actions = await this.actionRepository
      .find({
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));

    const actionStats: PlatformTenureCohortStats['actions'] = [];

    const eligible: {
      action: ParsedAction;
      memberActionEvent: ActionEvent;
      memberActionEndEvent: ActionEvent | undefined;
    }[] = [];
    for (const action of actions) {
      if (action.publicOnly || action.onboarding || action.optional) {
        continue;
      }

      const sortedEvents = (action.events ?? []).sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const memberActionEvent = sortedEvents.find(
        (event) =>
          event.newStatus === ActionStatus.MemberAction && event.date <= now,
      );

      if (!memberActionEvent) {
        continue;
      }

      const memberActionEndEvent =
        action.memberActionPhase.deadlineEvent ?? undefined;

      eligible.push({ action, memberActionEvent, memberActionEndEvent });
    }

    const baseUsersByAction =
      await this.actionEventRecipientService.findBaseUsersForEvents({
        entries: eligible.map((e) => ({
          action: e.action,
          eventId: e.memberActionEvent.id,
        })),
        includeSuspended: true,
        session,
      });

    for (const {
      action,
      memberActionEvent,
      memberActionEndEvent,
    } of eligible) {
      // Long CPU-bound accumulation; let queued requests run between actions.
      await yieldToEventLoop();
      const baseUsers = baseUsersByAction.get(action.id) ?? [];

      const assignedCohortUsers = baseUsers.filter(
        (user) =>
          cohortUserIds.has(user.id) &&
          user.hasActiveContractAt(memberActionEvent.date),
      );
      if (assignedCohortUsers.length === 0) {
        continue;
      }

      const completedCount = assignedCohortUsers.filter((user) =>
        completedLookup.has(`${user.id}:${action.id}`),
      ).length;

      actionStats.push({
        actionId: action.id,
        actionName: action.name,
        assignedCount: assignedCohortUsers.length,
        completedCount,
        completionRate: completedCount / assignedCohortUsers.length,
        memberActionStartDate: memberActionEvent.date,
        memberActionEndDate: memberActionEndEvent?.date,
      });
    }

    actionStats.sort(
      (a, b) =>
        b.assignedCount - a.assignedCount ||
        a.memberActionStartDate.getTime() - b.memberActionStartDate.getTime(),
    );

    const assignedCount = actionStats.reduce(
      (sum, action) => sum + action.assignedCount,
      0,
    );
    const completedCount = actionStats.reduce(
      (sum, action) => sum + action.completedCount,
      0,
    );
    const churnedCount = cohortUserIds.size - activeCount;

    return {
      weeksOnPlatform: normalizedWeeks,
      cohortSize: cohortUserIds.size,
      activeCount,
      churnedCount,
      churnRate: churnedCount / cohortUserIds.size,
      assignedCount,
      completedCount,
      completionRate: assignedCount > 0 ? completedCount / assignedCount : 0,
      actions: actionStats,
    };
  }

  async getTimeToChurnSamples(): Promise<number[]> {
    const allEvents = await this.contractEventRepository.find({
      relations: { user: true },
      order: { date: 'ASC' },
    });

    const userEvents = new Map<
      number,
      { date: Date; type: ContractEventType }[]
    >();

    for (const event of allEvents) {
      const userId = event.user?.id;
      if (!userId) continue;

      const events = userEvents.get(userId) ?? [];
      events.push({ date: event.date, type: event.type });
      userEvents.set(userId, events);
    }

    const churnedUsers = new Map<number, Date>();
    for (const [userId, events] of userEvents) {
      events.sort((a, b) => a.date.getTime() - b.date.getTime());
      const latestEvent = events[events.length - 1];
      if (!latestEvent || latestEvent.type === ContractEventType.SIGNED) {
        continue;
      }

      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (events[index].type === ContractEventType.SIGNED) {
          churnedUsers.set(userId, events[index].date);
          break;
        }
      }
    }

    if (churnedUsers.size === 0) {
      return [];
    }

    const churnedUserIds = Array.from(churnedUsers.keys());
    const lastCompletions = await this.actionActivityRepository
      .createQueryBuilder('activity')
      .select('activity.userId', 'userId')
      .addSelect('MAX(activity.createdAt)', 'lastCompletedAt')
      .where('activity.type = :type', {
        type: ActionActivityType.USER_COMPLETED,
      })
      .andWhere('activity.userId IN (:...userIds)', {
        userIds: churnedUserIds,
      })
      .groupBy('activity.userId')
      .getRawMany<{ userId: string; lastCompletedAt: string }>();

    const lastCompletionByUserId = new Map<number, Date>();
    for (const row of lastCompletions) {
      const userId = Number(row.userId);
      if (Number.isNaN(userId) || !row.lastCompletedAt) {
        continue;
      }
      const lastCompletedAt = new Date(row.lastCompletedAt);
      if (Number.isNaN(lastCompletedAt.getTime())) {
        continue;
      }
      lastCompletionByUserId.set(userId, lastCompletedAt);
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const samples: number[] = [];

    for (const [userId, signedAt] of churnedUsers) {
      const lastCompletedAt = lastCompletionByUserId.get(userId);
      if (!lastCompletedAt) {
        samples.push(0);
        continue;
      }
      if (lastCompletedAt < signedAt) {
        continue;
      }
      const daysToChurn =
        (lastCompletedAt.getTime() - signedAt.getTime()) / msPerDay;
      if (daysToChurn < 0) {
        continue;
      }
      samples.push(daysToChurn);
    }

    return samples;
  }

  async getAggregateStats(): Promise<AggregateStats> {
    const users = await this.userRepository.find({
      relations: { contractEvents: true },
    });
    const signedUsers = users.filter(
      (user) => user.hasActiveContract === true,
    ).length;

    return {
      signedUsers: signedUsers,
    };
  }

  async getContractStatusHistory(
    startDate: string,
    endDate: string,
  ): Promise<ContractStatusPoint[]> {
    // Get all contract events ordered by date
    const allEvents = await this.contractEventRepository.find({
      relations: { user: true },
      order: { date: 'ASC' },
    });

    // Build a timeline of user status changes
    // For each user, track when they signed and when they churned
    const userEvents = new Map<
      number,
      { date: Date; type: ContractEventType }[]
    >();

    for (const event of allEvents) {
      const userId = event.user?.id;
      if (!userId) continue;

      const events = userEvents.get(userId) ?? [];
      events.push({ date: event.date, type: event.type });
      userEvents.set(userId, events);
    }

    // Sort each user's events by date
    for (const events of userEvents.values()) {
      events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    // Generate daily data points
    const start = new Date(startDate);
    const end = new Date(endDate);
    const results: ContractStatusPoint[] = [];

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateEnd = new Date(currentDate);
      dateEnd.setHours(23, 59, 59, 999);

      let activeCount = 0;
      let churnedCount = 0;
      let totalEverSigned = 0;

      for (const [, events] of userEvents) {
        // Find all events up to this date
        const relevantEvents = events.filter((e) => e.date <= dateEnd);

        if (relevantEvents.length === 0) continue;

        // User has at least one event, so they signed at some point
        const hasEverSigned = relevantEvents.some(
          (e) => e.type === ContractEventType.SIGNED,
        );

        if (!hasEverSigned) continue;

        totalEverSigned++;

        // Get the most recent event to determine current status
        const latestEvent = relevantEvents[relevantEvents.length - 1];

        if (latestEvent.type === ContractEventType.SIGNED) {
          activeCount++;
        } else {
          churnedCount++;
        }
      }

      results.push({
        date: this.formatDateKey(currentDate),
        activeCount,
        churnedCount,
        totalEverSigned,
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  async getInviteFunnel(
    startDate?: string,
    endDate?: string,
  ): Promise<InviteFunnel> {
    const dateFilter =
      startDate && endDate
        ? { createdAt: Between(new Date(startDate), new Date(endDate)) }
        : {};

    // 1. Total invites created (excluding rejected requests)
    const invitesCreated = await this.onetimeInviteRepository.count({
      where: [
        { status: OnetimeInviteStatus.LINK_UNUSED, ...dateFilter },
        { status: OnetimeInviteStatus.LINK_USED, ...dateFilter },
      ],
    });

    // 2. Invites used (signup)
    const usedInvites = await this.onetimeInviteRepository.find({
      where: { status: OnetimeInviteStatus.LINK_USED, ...dateFilter },
      relations: { invitedUser: true },
    });
    const invitesUsed = usedInvites.length;

    // Collect invited user IDs
    const invitedUserIds = usedInvites
      .map((invite) => invite.invitedUser?.id)
      .filter((id): id is number => id !== undefined && id !== null);

    if (invitedUserIds.length === 0) {
      return {
        invitesCreated,
        invitesUsed,
        contractSigned: 0,
        onboardingCompleted: 0,
      };
    }

    // 3. Invited users who signed the contract
    const contractSignedCount = await this.contractEventRepository
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT event.user)', 'count')
      .innerJoin('event.user', 'user')
      .where('event.type = :type', { type: ContractEventType.SIGNED })
      .andWhere('user.id IN (:...userIds)', { userIds: invitedUserIds })
      .getRawOne<{ count: string }>();

    const contractSigned = Number(contractSignedCount?.count ?? 0);

    // 4. Invited users who finished onboarding (>= 4 completed actions)
    const onboardingRows = await this.actionActivityRepository
      .createQueryBuilder('activity')
      .select('activity.userId', 'userId')
      .addSelect('COUNT(DISTINCT activity.actionId)', 'completedActions')
      .where('activity.type = :type', {
        type: ActionActivityType.USER_COMPLETED,
      })
      .andWhere('activity.userId IN (:...userIds)', {
        userIds: invitedUserIds,
      })
      .groupBy('activity.userId')
      .having('COUNT(DISTINCT activity.actionId) >= 4')
      .getRawMany<{ userId: string; completedActions: string }>();

    const onboardingCompleted = onboardingRows.length;

    return {
      invitesCreated,
      invitesUsed,
      contractSigned,
      onboardingCompleted,
    };
  }
}

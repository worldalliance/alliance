import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserService } from 'src/user/user.service';
import { TimeSpentForUserDto } from './timespent.dto';
import { DailyStatsRecord } from './dailystats.entity';
import { ActionStatsRecord } from './actionstats.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import {
  ActionActivity,
  ActionActivityType,
} from 'src/actions/entities/action-activity.entity';
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from 'src/user/entities/onetime-invite.entity';
import { User } from 'src/user/entities/user.entity';
import { ContractEventType } from 'src/user/entities/contract-event.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { Action } from 'src/actions/entities/action.entity';
import { ActionStatus } from 'src/actions/entities/action-event.entity';
import { ContractEvent } from 'src/user/entities/contract-event.entity';
import {
  MemberCompletionRetentionCohortDto,
  MemberCompletionRetentionPointDto,
} from './member-completion-retention.dto';
import { TimeToChurnSampleDto } from './time-to-churn.dto';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';

@Injectable()
export class AnalyticsService {
  private readonly API_KEY: string;
  private readonly PROJECT_ID: string;
  private readonly logger = new Logger(AnalyticsService.name);

  private timeSpentPerUserLast7Days: TimeSpentForUserDto[] = [];
  private timeSpentPerUserTotal: TimeSpentForUserDto[] = [];

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
  ): Promise<TimeSpentForUserDto[]> {
    const users = await this.userService.findAllUsers();

    const emailToUserId = users.reduce((acc, user) => {
      acc[user.email] = user.id;
      return acc;
    }, {});

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

    const timeSpentPerUser: TimeSpentForUserDto[] = results.map(
      (result) =>
        ({
          userId: emailToUserId[result.email],
          timeSpent: result.total_session_duration_seconds,
        }) satisfies TimeSpentForUserDto,
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

  async getTimeSpentPerUser(): Promise<TimeSpentForUserDto[]> {
    return this.timeSpentPerUserLast7Days;
  }

  async getTimeSpentPerUserTotal(): Promise<TimeSpentForUserDto[]> {
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

    const actions = await this.actionRepository.find({
      relations: { events: true },
    });

    const actionIds = actions.map((action) => action.id);
    const withdrawalByActionId = new Map<number, number>();
    if (actionIds.length > 0) {
      const withdrawalCounts = await this.actionActivityRepository
        .createQueryBuilder('activity')
        .select('activity.actionId', 'actionId')
        .addSelect('COUNT(DISTINCT activity.userId)', 'withdrawnCount')
        .where('activity.actionId IN (:...actionIds)', { actionIds })
        .andWhere('activity.type IN (:...types)', {
          types: [
            ActionActivityType.USER_WONT_COMPLETE,
            ActionActivityType.USER_DECLINED,
          ],
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
        !action.publicOnly &&
        !!memberActionEvent &&
        !action.everyoneShouldComplete;

      const existingRecord = await this.actionStatsRepository.findOne({
        where: { actionId: action.id },
      });

      if (existingRecord) {
        existingRecord.actionName = action.name;
        existingRecord.usersCompleted = usersCompleted;
        existingRecord.usersJoined = usersJoined;
        existingRecord.usersWithdrawn = usersWithdrawn;
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

  async getActionStats(): Promise<ActionStatsRecord[]> {
    return this.actionStatsRepository.find({
      order: { actionId: 'ASC' },
    });
  }

  private getWeekStartDate(date: Date): Date {
    const utcDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = utcDate.getUTCDay();
    const diff = (day + 6) % 7;
    utcDate.setUTCDate(utcDate.getUTCDate() - diff);
    return utcDate;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async getMemberCompletionRetentionByCohort(): Promise<
    MemberCompletionRetentionCohortDto[]
  > {
    const signedEvents = await this.contractEventRepository
      .createQueryBuilder('event')
      .select('user.id', 'userId')
      .addSelect('MIN(event.date)', 'signedAt')
      .innerJoin('event.user', 'user')
      .where('event.type = :type', { type: ContractEventType.SIGNED })
      .groupBy('user.id')
      .getRawMany<{ userId: number; signedAt: string }>();

    const memberSignedAtByUserId = new Map<number, Date>();
    const cohortMembers = new Map<string, Set<number>>();

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
      const cohortKey = this.formatDateKey(this.getWeekStartDate(signedAt));
      const members = cohortMembers.get(cohortKey) ?? new Set<number>();
      members.add(userId);
      cohortMembers.set(cohortKey, members);
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

    const cohortWeekTotals = new Map<
      string,
      Map<number, { joinedCount: number; completedCount: number }>
    >();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const actions = await this.actionRepository.find({
      relations: { events: true, participatingTags: true },
    });
    const now = new Date();

    for (const action of actions) {
      if (action.publicOnly) {
        continue;
      }
      const memberActionEvent = (action.events ?? [])
        .filter(
          (event) =>
            event.newStatus === ActionStatus.MemberAction && event.date <= now,
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

      if (!memberActionEvent) {
        continue;
      }

      const baseUsers =
        await this.actionEventRecipientService.findBaseUsersForEvent({
          action,
          eventId: memberActionEvent.id,
          eventStatus: ActionStatus.MemberAction,
          includeSuspended: true,
        });

      for (const user of baseUsers) {
        const signedAt = memberSignedAtByUserId.get(user.id);
        if (!signedAt || signedAt > memberActionEvent.date) {
          continue;
        }
        const rawWeekIndex = Math.floor(
          (memberActionEvent.date.getTime() - signedAt.getTime()) / msPerWeek,
        );
        const weekIndex = Math.max(0, rawWeekIndex);
        const cohortKey = this.formatDateKey(this.getWeekStartDate(signedAt));

        const weekMap =
          cohortWeekTotals.get(cohortKey) ??
          new Map<number, { joinedCount: number; completedCount: number }>();
        const bucket = weekMap.get(weekIndex) ?? {
          joinedCount: 0,
          completedCount: 0,
        };
        bucket.joinedCount += 1;
        if (completedLookup.has(`${user.id}:${action.id}`)) {
          bucket.completedCount += 1;
        }
        weekMap.set(weekIndex, bucket);
        cohortWeekTotals.set(cohortKey, weekMap);
      }
    }

    return Array.from(cohortWeekTotals.entries())
      .sort(
        ([cohortA], [cohortB]) =>
          new Date(cohortA).getTime() - new Date(cohortB).getTime(),
      )
      .map(([cohortStart, weekMap]) => {
        const weeks = Array.from(weekMap.entries()).sort(
          ([weekA], [weekB]) => weekA - weekB,
        );
        let cumulativeJoined = 0;
        let cumulativeCompleted = 0;
        const points: MemberCompletionRetentionPointDto[] = weeks.map(
          ([weekIndex, counts]) => {
            cumulativeJoined += counts.joinedCount;
            cumulativeCompleted += counts.completedCount;
            return {
              weekIndex,
              completionRate:
                cumulativeJoined > 0
                  ? cumulativeCompleted / cumulativeJoined
                  : 0,
              joinedCount: cumulativeJoined,
              completedCount: cumulativeCompleted,
            };
          },
        );

        return {
          cohortStart,
          cohortSize: cohortMembers.get(cohortStart)?.size ?? 0,
          points,
        };
      });
  }

  async getTimeToChurnSamples(): Promise<TimeToChurnSampleDto[]> {
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
    const samples: TimeToChurnSampleDto[] = [];

    for (const [userId, signedAt] of churnedUsers) {
      const lastCompletedAt = lastCompletionByUserId.get(userId);
      if (!lastCompletedAt) {
        samples.push({ daysToChurn: 0 });
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
      samples.push({ daysToChurn });
    }

    return samples;
  }

  async getAggregateStats(): Promise<{ signedUsers: number }> {
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
  ): Promise<
    { date: string; activeCount: number; churnedCount: number; totalEverSigned: number }[]
  > {
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
    const results: {
      date: string;
      activeCount: number;
      churnedCount: number;
      totalEverSigned: number;
    }[] = [];

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
}

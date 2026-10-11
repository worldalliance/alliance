/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { TERMINAL_ACTIVITY_TYPES } from "src/actions/action-activity-status";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "src/actions/entities/action.entity";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "src/user/entities/onetime-invite.entity";
import { User } from "src/user/entities/user.entity";
import { inviteAcceptedSql } from "src/user/invite-claim";
import {
  canMissActionDeadline,
  computeMissedRequiredAction,
  findStartedMemberActionEvent,
  hasMemberActionDeadlinePassed,
} from "src/utils/action-user";
import { yieldToEventLoop } from "src/utils/event-loop";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { Between, In, IsNull, type Repository } from "typeorm";
import { DailyStatsRecord } from "./dailystats.entity";
import { formatDateKey } from "./date-key";
import { InviteFunnel } from "./invite-funnel.dto";
import {
  MemberCompletionRetentionCohort,
  MemberCompletionRetentionPoint,
} from "./member-completion-retention.dto";
import { MemberReliabilityWindow } from "./member-reliability-window.dto";
import { MissedActions } from "./missed-actions.dto";
import { ReminderGroupClickRatePoint } from "./reminder-group-click-rates.dto";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(DailyStatsRecord)
    private readonly dailyStatsRepository: TypedRepository<DailyStatsRecord>,
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
  ) {}

  @Cron("0 8,20 * * *")
  async calculateDailyStats() {
    const now = new Date();
    const dayId = formatDateKey(now);

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
    const acceptedInvites = await this.onetimeInviteRepository
      .createQueryBuilder("invite")
      .where(inviteAcceptedSql("invite"))
      .getCount();

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
      .flatMap((action) => {
        const memberActionEvent = action.memberActionPhase.event;
        return memberActionEvent &&
          !action.onboarding &&
          !action.publicOnly &&
          canMissActionDeadline(action, now)
          ? [{ action, memberActionEvent }]
          : [];
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

    const terminalActivities = await this.actionActivityRepository.find({
      where: {
        userId: In(Array.from(activeUsers.keys())),
        actionId: In(completedActions.map(({ action }) => action.id)),
        type: In(TERMINAL_ACTIVITY_TYPES),
      },
      select: { userId: true, actionId: true },
    });
    const terminalByUserAction = new Set(
      terminalActivities.map(
        (activity) => `${activity.userId}:${activity.actionId}`,
      ),
    );

    const missed = (user: User, action: ParsedAction) =>
      computeMissedRequiredAction({
        action,
        hasTerminalActivity: terminalByUserAction.has(
          `${user.id}:${action.id}`,
        ),
        now,
      });

    const missedLastAction: MissedActions["missedLastAction"] = [];
    const missedLastTwoActions: MissedActions["missedLastTwoActions"] = [];
    for (const user of activeUsers.values()) {
      const assignedActions = completedActions.filter(({ action }) =>
        participantsByAction.get(action.id)?.has(user.id),
      );
      const [lastAction, previousAction] = assignedActions;
      if (!lastAction || !missed(user, lastAction.action)) continue;

      const member = {
        userId: user.id,
        name: user.name,
        lastActionName: lastAction.action.name,
      };
      missedLastAction.push(member);
      if (previousAction && missed(user, previousAction.action)) {
        missedLastTwoActions.push(member);
      }
    }

    const byName = (
      a: MissedActions["missedLastAction"][number],
      b: MissedActions["missedLastAction"][number],
    ) => a.name.localeCompare(b.name) || a.userId - b.userId;
    missedLastAction.sort(byName);
    missedLastTwoActions.sort(byName);
    return { missedLastAction, missedLastTwoActions };
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
    const usedInvitesQuery = this.onetimeInviteRepository
      .createQueryBuilder("invite")
      .innerJoin("invite.invitedUser", "invitedUser")
      .select("invitedUser.id", "invitedUserId")
      .where(inviteAcceptedSql("invite"));
    if (startDate && endDate) {
      usedInvitesQuery.andWhere("invite.createdAt BETWEEN :start AND :end", {
        start: new Date(startDate),
        end: new Date(endDate),
      });
    }
    const invitedUserIds = (
      await usedInvitesQuery.getRawMany<{ invitedUserId: number }>()
    ).map(({ invitedUserId }) => invitedUserId);
    const invitesUsed = invitedUserIds.length;

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
      .createQueryBuilder("event")
      .select("COUNT(DISTINCT event.user)", "count")
      .innerJoin("event.user", "user")
      .where("event.type = :type", { type: ContractEventType.SIGNED })
      .andWhere("user.id IN (:...userIds)", { userIds: invitedUserIds })
      .getRawOne<{ count: string }>();

    const contractSigned = Number(contractSignedCount?.count ?? 0);

    // 4. Invited users who finished onboarding (>= 4 completed actions)
    const onboardingRows = await this.actionActivityRepository
      .createQueryBuilder("activity")
      .select("activity.userId", "userId")
      .addSelect("COUNT(DISTINCT activity.actionId)", "completedActions")
      .where("activity.type = :type", {
        type: ActionActivityType.USER_COMPLETED,
      })
      .andWhere("activity.userId IN (:...userIds)", {
        userIds: invitedUserIds,
      })
      .groupBy("activity.userId")
      .having("COUNT(DISTINCT activity.actionId) >= 4")
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

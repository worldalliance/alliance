import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import {
  sqlIsLatestCompletion,
  TERMINAL_ACTIVITY_TYPES,
} from "src/actions/action-activity-status";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionStatus,
  loadedActionEventAction,
} from "src/actions/entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "src/actions/entities/action.entity";
import {
  loadedReminderGroupMemberActionEvent,
  ReminderGroup,
} from "src/actions/entities/reminder-group.entity";
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
} from "src/utils/action-user";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { Between, In, IsNull, type Repository } from "typeorm";
import { DailyStatsRecord } from "./dailystats.entity";
import { formatDateKey } from "./date-key";
import { InviteFunnel } from "./invite-funnel.dto";
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

    const completionActivities = await this.actionActivityRepository
      .createQueryBuilder("activity")
      .where(sqlIsLatestCompletion("activity"))
      .getCount();

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

      const memberActionEvent = loadedReminderGroupMemberActionEvent(group);
      const action = loadedActionEventAction(memberActionEvent);

      // Plot each reminder-group at its first sent notification time, falling
      // back to its configured absolute send time or the member_action date.
      const pointDate =
        aggregate.firstSentAt ?? group.sendAtAbsolute ?? memberActionEvent.date;

      points.push({
        date: pointDate,
        reminderGroupId: group.id,
        reminderGroupName: group.name,
        actionId: action.id,
        actionName: action.name,
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
      .where(sqlIsLatestCompletion("activity"))
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

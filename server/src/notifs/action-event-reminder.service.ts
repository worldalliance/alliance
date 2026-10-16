import { DEFAULT_TIME_ZONE } from "@alliance/common/timezone";
import { Temporal } from "@js-temporal/polyfill";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { NotificationScheduleEntryDto } from "src/actions/dto/notification-schedule.dto";
import { loadedActionSuiteActions } from "src/actions/entities/action-suite.entity";
import {
  cohortNotifiesRecipientPersonally,
  getGroupSendTimeForUser,
  loadedReminderGroupMemberActionEvent,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { UserService } from "src/user/user.service";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { Brackets, type Repository } from "typeorm";
import { loadedActionEventAction } from "../actions/entities/action-event.entity";
import { loadedUserCommunities, User } from "../user/entities/user.entity";
import { ActionEventRecipientService } from "./action-event-recipient.service";
import { NotificationPlan } from "./dto/notification-plan.dto";
import { ActionEventNotifDto } from "./entities/action-event-notif.dto";
import {
  ActionEventNotif,
  ActionEventNotifType,
} from "./entities/action-event-notif.entity";

export interface MissedDeadlineCandidate {
  actionId: number;
  userId: number;
  deadlineEventId: number;
  deadlineDate: Date;
  resolutionEventId: number;
  resolutionDate: Date;
}

export const NOTIFICATION_LOOKBACK_WINDOW_MS = milliseconds({ hours: 3 });

@Injectable()
export class ActionEventReminderService {
  constructor(
    @InjectRepository(ReminderGroup)
    private readonly reminderGroupRepository: Repository<ReminderGroup>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifRepository: TypedRepository<ActionEventNotif>,
    private readonly recipientService: ActionEventRecipientService,
    private readonly userService: UserService,
  ) {}

  async findPlansForGroup(
    group: ReminderGroup,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const plans: NotificationPlan[] = [];

    const [users, alreadyNotifiedUserIds] = await Promise.all([
      this.recipientService.findReminderGroupCohort(group),
      this.findAlreadyNotifiedUserIds(group),
    ]);
    for (const user of users) {
      const reminderSendTime = getGroupSendTimeForUser(user, group);

      if (!reminderSendTime) continue;

      if (alreadyNotifiedUserIds.has(user.id)) continue;

      if (await this.userService.isUserIdAway(user.id, reminderSendTime))
        continue;

      if (reminderSendTime >= windowStart && reminderSendTime <= windowEnd) {
        plans.push({
          user,
          group,
          scheduledFor: reminderSendTime,
        });
      }
    }

    return plans;
  }

  /**
   * Users who must not receive this group's notification because they were
   * already notified. Without `excludePreviouslyNotified`: those with a sent
   * notif for this group. With it: those whose sent notifs on the same
   * member-action event already covered every task this group could tell
   * them about — a legacy notif (null `notifiedActionIds`) counts as having
   * covered everything, and otherwise the notifs' covered action ids must
   * include the group's whole task scope. Users with *partial* coverage stay
   * in the plans; the worker re-filters per task at send time and skips them
   * if nothing new remains, so this plan-time pass only has to be safe, not
   * exact. Uses the event id denormalized onto the notif so the answer
   * survives the originating group's deletion — and since group-leads nudges
   * are written without the event stamp, they never count as having
   * personally notified their recipient.
   */
  private async findAlreadyNotifiedUserIds(
    group: ReminderGroup,
  ): Promise<Set<number>> {
    if (!group.excludePreviouslyNotified) {
      const rows = await this.actionEventNotifRepository
        .createQueryBuilder("notif")
        .where("notif.sent = true")
        .andWhere('notif."reminderGroupId" = :groupId', { groupId: group.id })
        .select('DISTINCT notif."userId"', "userId")
        .getRawMany<{ userId: number }>();
      return new Set(rows.map((row) => Number(row.userId)));
    }

    const rows = await this.actionEventNotifRepository
      .createQueryBuilder("notif")
      .where("notif.sent = true")
      .andWhere('notif."memberActionEventId" = :eventId', {
        eventId: loadedReminderGroupMemberActionEvent(group).id,
      })
      .select('notif."userId"', "userId")
      .addSelect('notif."notifiedActionIds"', "notifiedActionIds")
      .getRawMany<{ userId: number; notifiedActionIds: number[] | null }>();

    const scopeActionIds = groupTaskScopeActionIds(group);

    const coverageByUser = new Map<number, Array<number[] | null>>();
    for (const row of rows) {
      const userId = Number(row.userId);
      const coverage = coverageByUser.get(userId) ?? [];
      coverage.push(row.notifiedActionIds);
      coverageByUser.set(userId, coverage);
    }

    const excluded = new Set<number>();
    for (const [userId, coverage] of coverageByUser) {
      const uncovered = tasksNotYetNotified(
        scopeActionIds.map((id) => ({ id })),
        coverage,
      );
      if (uncovered.length === 0) excluded.add(userId);
    }
    return excluded;
  }

  /**
   * The covered-action-id sets of every sent notif that personally notified
   * this user on this member-action event (a null entry is a legacy notif
   * that counts as having covered everything). Fetched per plan at send time
   * so a sibling send from the same dispatch cycle — invisible to the
   * plan-time snapshot, since plans are dispatched in `scheduledFor` order —
   * is accounted for, without suppressing the catch-up when the sibling plan
   * never actually sent.
   */
  async findSentNotifCoverage(
    userId: number,
    eventId: number,
  ): Promise<Array<number[] | null>> {
    const notifs = await this.actionEventNotifRepository.find({
      where: {
        user: { id: userId },
        memberActionEvent: { id: eventId },
        sent: true,
      },
      select: { id: true, notifiedActionIds: true },
    });
    return notifs.map((notif) => notif.notifiedActionIds);
  }

  async evaluateNotifications(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid schedule window");
    }
    if (end.getTime() < start.getTime()) {
      throw new Error("windowEnd must not be before windowStart");
    }

    const plans: NotificationPlan[] = [];

    const groups = await this.findSendableReminderGroups(
      this.reminderGroupRepository,
      windowStart,
      windowEnd,
    );

    for (const group of groups) {
      const groupPlans = await this.findPlansForGroup(
        group,
        windowStart,
        windowEnd,
      );
      plans.push(...groupPlans);
    }

    if (plans.length === 0) {
      return [];
    }

    plans.sort(comparePlansForDispatch);
    return plans;
  }

  async getNotificationSchedule(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationScheduleEntryDto[]> {
    const plans = dropPlansPreemptedInSameCycle(
      await this.evaluateNotifications(windowStart, windowEnd),
    );

    return Promise.all(
      plans.map(async (plan) => {
        const event = loadedReminderGroupMemberActionEvent(plan.group);
        const action = loadedActionEventAction(event);
        return {
          scheduledFor: plan.scheduledFor,
          actionId: action.id,
          actionName: action.name,
          actionStatus: event.newStatus,
          eventId: event.id,
          type: ActionEventNotifType.Reminder,
          recipients: [], //TODO
        } satisfies NotificationScheduleEntryDto;
      }),
    );
  }

  async findSendableReminderGroups(
    repo: Repository<ReminderGroup>,
    windowStart: Date,
    windowEnd: Date,
  ) {
    const idRows = await repo
      .createQueryBuilder("rg")
      .leftJoin("rg.memberActionEvent", "event")
      .leftJoin("rg.deadlineEvent", "deadline")
      .leftJoin("rg.timingAnchorEvent", "anchor")
      .where('rg."allSent" = false')
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            '(rg."timingMode" = :abs AND rg."sendAtAbsolute" BETWEEN :ws AND :we)',
          )
            .orWhere(
              '(rg."timingMode" = :launch AND event."date" BETWEEN :ws AND :we)',
            )
            .orWhere(
              '(rg."timingMode" = :range AND rg."send_range_start" <= :we AND rg."send_range_end" >= :ws)',
            )
            .orWhere(
              `(
                  rg."timingMode" = :relativerange
                  AND COALESCE(anchor."date", deadline."date") IS NOT NULL
                  AND (COALESCE(anchor."date", deadline."date") - (rg."relative_range_start_seconds_from_deadline" * interval '1 second')) <= :we
                  AND (COALESCE(anchor."date", deadline."date") - (rg."relative_range_end_seconds_from_deadline" * interval '1 second')) >= :ws
                )`,
            )
            .orWhere(
              `(
                 rg."timingMode" = :from
                 AND COALESCE(anchor."date", deadline."date") IS NOT NULL
                 AND (COALESCE(anchor."date", deadline."date") - (rg."sendAtSecondsFromDeadline" * interval '1 second'))
                   BETWEEN :ws AND :we
               )`,
            );
        }),
      )
      .setParameters({
        abs: ReminderGroupTimingMode.Absolute,
        range: ReminderGroupTimingMode.WithinRange,
        from: ReminderGroupTimingMode.FromDeadline,
        relativerange: ReminderGroupTimingMode.WithinRelativeRange,
        launch: ReminderGroupTimingMode.EventLaunch,
        ws: windowStart,
        we: windowEnd,
      })
      .select("rg.id", "id")
      .distinct(true)
      .getRawMany<{ id: number }>();

    const ids = idRows.map((r) => r.id);

    if (ids.length === 0) {
      return [];
    }

    return repo
      .createQueryBuilder("rg")
      .leftJoinAndSelect("rg.memberActionEvent", "event")
      .leftJoinAndSelect("event.action", "eventAction")
      .leftJoinAndSelect("eventAction.events", "eventActionEvents")
      .leftJoinAndSelect("rg.deadlineEvent", "deadline")
      .leftJoinAndSelect("rg.timingAnchorEvent", "anchor")
      .leftJoinAndSelect("rg.users", "users")
      .leftJoinAndSelect("users.tags", "userTags")
      .leftJoinAndSelect("users.contractEvents", "contractEvents")
      .leftJoinAndSelect("rg.userTag", "userTag")
      .leftJoinAndSelect("rg.actionSuite", "actionSuite")
      .leftJoinAndSelect("actionSuite.actions", "actionSuiteActions")
      .where("rg.id IN (:...ids)", { ids })
      .getMany();
  }

  async getPersonalizedSendTime(
    user: User,
    day: Temporal.PlainDate,
  ): Promise<Temporal.ZonedDateTime> {
    const defaultSendTime: Temporal.PlainTime =
      Temporal.PlainTime.from("19:00:00");

    const timeOfDay: Temporal.PlainTime =
      user.preferredReminderTime ?? defaultSendTime;
    const timezone: Temporal.TimeZoneLike = user.timeZone ?? DEFAULT_TIME_ZONE;

    const zoned = day.toZonedDateTime({
      plainTime: timeOfDay,
      timeZone: timezone,
    });

    return zoned;
  }

  async findNotificationPlansForGroup(
    groupId: number,
  ): Promise<NotificationPlan[]> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: {
        memberActionEvent: {
          action: { events: true },
        },
        deadlineEvent: true,
        timingAnchorEvent: true,
        users: { contractEvents: true },
        userTag: true,
        actionSuite: { actions: true },
      },
    });

    return this.findPlansForGroup(
      group,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + milliseconds({ days: 28 })),
    );
  }

  async getSentNotifsForGroup(groupId: number): Promise<ActionEventNotifDto[]> {
    const notifs = await this.actionEventNotifRepository.find({
      where: { reminderGroup: { id: groupId }, sent: true },
      relations: { user: true, mms: true, mail: true, pushes: true },
    });
    return notifs.map((notif) => new ActionEventNotifDto(notif));
  }

  async findUncompletedMembersInCommunities(
    group: ReminderGroup,
    leader: User,
  ): Promise<User[]> {
    const baseUsers = await this.recipientService.findFilteredUsersForEvent(
      loadedReminderGroupMemberActionEvent(group),
      group.deadlineEvent ?? null,
      ActionEventNotifType.PersonalReminder,
      group.actionSuite,
      group.excludeOptionalActions,
    );

    const usersWithCommunities = await this.userService.findByIds(
      baseUsers.map((user) => user.id),
      { communities: true },
    );

    const leaderCommunityIds = new Set(
      leader.leaderOfIds ?? leader.leaderOf?.map((community) => community.id),
    );

    const inCommunities = usersWithCommunities.filter((user) =>
      loadedUserCommunities(user).some((community) =>
        leaderCommunityIds.has(community.id),
      ),
    );
    return inCommunities.filter((user) => user.id !== leader.id);
  }
}

/**
 * The actions an `excludePreviouslyNotified` decision is about: the suite's
 * actions for suite-count groups, else the member event's own action. A user
 * whose prior notifs cover this whole scope has nothing new to hear from the
 * group — even if their (possibly global) message task list would not be
 * empty.
 */
export function groupTaskScopeActionIds(group: ReminderGroup): number[] {
  const suiteActions =
    group.useSuiteTaskCount && group.actionSuite
      ? loadedActionSuiteActions(group.actionSuite)
      : [];
  return suiteActions.length
    ? suiteActions.map((action) => action.id)
    : [loadedActionEventAction(loadedReminderGroupMemberActionEvent(group)).id];
}

/**
 * The tasks a user hasn't been personally notified about yet, given the
 * covered-action-id sets of their prior sent notifs on the event
 * (`findSentNotifCoverage`). A `null` coverage entry is a legacy notif from
 * before per-task tracking existed and counts as having covered everything.
 */
export function tasksNotYetNotified<T extends { id: number }>(
  tasks: T[],
  coverage: Array<number[] | null>,
): T[] {
  if (coverage.some((actionIds) => actionIds === null)) {
    return [];
  }
  const covered = new Set(coverage.flatMap((actionIds) => actionIds ?? []));
  return tasks.filter((task) => !covered.has(task.id));
}

/**
 * Dispatch order for due plans: by send time, and on equal send times
 * non-catch-up plans first, so a catch-up's send-time coverage check sees the
 * sibling's notif and skips the user instead of racing it (the plan array's
 * incoming order comes from an unordered DB read). Group id last so preview
 * and dispatch order identically.
 */
export function comparePlansForDispatch(
  a: NotificationPlan,
  b: NotificationPlan,
): number {
  return (
    a.scheduledFor.getTime() - b.scheduledFor.getTime() ||
    Number(a.group.excludePreviouslyNotified) -
      Number(b.group.excludePreviouslyNotified) ||
    a.group.id - b.group.id
  );
}

/**
 * Preview-only estimate of `excludePreviouslyNotified` suppression within one
 * dispatch cycle: assumes every earlier plan for the same user + member-action
 * event will actually send, covering every task the user could be told about,
 * and hides the catch-up accordingly. Real sends don't use this — a plan can
 * skip or fail, so the worker re-derives the not-yet-notified task set per
 * plan at send time (`findSentNotifCoverage` + `tasksNotYetNotified`) instead.
 *
 * Expects `plans` sorted by `scheduledFor` ascending; keeps the earliest plan
 * per user + member-action event.
 */
export function dropPlansPreemptedInSameCycle(
  plans: NotificationPlan[],
): NotificationPlan[] {
  const notifiedThisCycle = new Set<string>();
  const kept: NotificationPlan[] = [];
  for (const plan of plans) {
    const key = `${plan.user.id}:${loadedReminderGroupMemberActionEvent(plan.group).id}`;
    if (plan.group.excludePreviouslyNotified && notifiedThisCycle.has(key)) {
      continue;
    }
    if (cohortNotifiesRecipientPersonally(plan.group.cohortType)) {
      notifiedThisCycle.add(key);
    }
    kept.push(plan);
  }
  return kept;
}

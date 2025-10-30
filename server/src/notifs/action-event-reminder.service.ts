import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThanOrEqual, Repository } from 'typeorm';
import { ActionEventNotifType } from './entities/action-event-notif.entity';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import {
  ActionActivity,
  ActionActivityType,
} from '../actions/entities/action-activity.entity';
import { ActionEventRecipientService } from './action-event-recipient.service';
import { NotificationScheduleEntryDto } from 'src/actions/dto/notification-schedule.dto';
import { User } from '../user/entities/user.entity';
import {
  getGroupSendTimeForUser,
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from 'src/actions/entities/reminder-group.entity';
import { CreateTODReminderGroupDto } from 'src/actions/dto/action.dto';
import { UserService } from 'src/user/user.service';
import { Temporal } from '@js-temporal/polyfill';
import { Group } from 'src/user/entities/group.entity';

export interface MissedDeadlineCandidate {
  actionId: number;
  userId: number;
  deadlineEventId: number;
  deadlineDate: Date;
  resolutionEventId: number;
  resolutionDate: Date;
}

export const NOTIFICATION_LOOKBACK_WINDOW_MS = 1 * 24 * 60 * 60 * 1000;

export const POST_MEMBER_ACTION_STATUSES = new Set<ActionStatus>([
  ActionStatus.OfficeAction,
  ActionStatus.Resolution,
  ActionStatus.Completed,
  ActionStatus.Failed,
  ActionStatus.Abandoned,
]);

export type NotificationPlan = {
  scheduledFor: Date;
  referenceEvent: ActionEvent;
  targetEvent: ActionEvent;
  user: User;
  group: ReminderGroup;
};

@Injectable()
export class ActionEventReminderService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ReminderGroup)
    private readonly reminderGroupRepository: Repository<ReminderGroup>,
    private readonly recipientService: ActionEventRecipientService,
    private readonly userService: UserService,
  ) {}

  async evaluateNotifications(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid schedule window');
    }
    if (end.getTime() < start.getTime()) {
      throw new Error('windowEnd must not be before windowStart');
    }

    const plans: NotificationPlan[] = [];
    const requiredEvents = new Set<number>();

    // Reminders
    const reminderPlans = await this.computeReminderPlans(start, end);
    for (const plan of reminderPlans) {
      plans.push(plan);
      requiredEvents.add(plan.referenceEvent.id);
      requiredEvents.add(plan.targetEvent.id);
    }

    if (plans.length === 0) {
      return [];
    }

    plans.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
    return plans;
  }

  async getNotificationSchedule(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationScheduleEntryDto[]> {
    const plans = await this.evaluateNotifications(windowStart, windowEnd);

    return Promise.all(
      plans.map(async (plan) => {
        return {
          scheduledFor: plan.scheduledFor,
          actionId: plan.referenceEvent.action!.id,
          actionName: plan.referenceEvent.action!.name,
          actionStatus: plan.referenceEvent.newStatus,
          eventId: plan.referenceEvent.id,
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
    return repo
      .createQueryBuilder('rg')
      .leftJoin('rg.memberActionEvent', 'event')
      .leftJoin('rg.deadlineEvent', 'deadline')
      .leftJoin('rg.users', 'users')
      .andWhere('rg."allSent" = false')
      .where(
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
                 rg."timingMode" = :from
                 AND deadline."date" IS NOT NULL
                 AND (deadline."date" + (rg."sendAtSecondsFromDeadline" * interval '1 second'))
                   BETWEEN :ws AND :we
               )`,
            );
        }),
      )
      .setParameters({
        abs: ReminderGroupTimingMode.Absolute,
        range: ReminderGroupTimingMode.WithinRange,
        from: ReminderGroupTimingMode.FromDeadline,
        launch: ReminderGroupTimingMode.EventLaunch,
        ws: windowStart,
        we: windowEnd,
      })
      .getMany();
  }

  private async computeReminderPlans(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const results: NotificationPlan[] = [];

    const groups = await this.findSendableReminderGroups(
      this.reminderGroupRepository,
      windowStart,
      windowEnd,
    );

    for (const group of groups) {
      const users = await this.recipientService.getReminderGroupCohort(group);

      for (const user of users) {
        const reminderSendTime = getGroupSendTimeForUser(user, group);

        if (!reminderSendTime) continue;

        if (reminderSendTime >= windowStart && reminderSendTime <= windowEnd) {
          results.push({
            user,
            group,
            scheduledFor: reminderSendTime,
            referenceEvent: group.memberActionEvent,
            targetEvent: group.memberActionEvent,
          });
        }
      }
    }

    // const events = await this.eventRepository.find({
    //   relations: [
    //     'action',
    //     'action.participatingGroups',
    //     'reminders',
    //     'reminders.users', //TODO: shouldnt load whole users
    //     'personalActionReminders',
    //     'personalActionReminders.group',
    //     'personalActionReminders.user',
    //   ],
    //   order: { action: { id: 'ASC' }, date: 'ASC' },
    // });

    // const eventsByAction = new Map<number, ActionEvent[]>();
    // for (const event of events) {
    //   if (!event.action) continue;
    //   const list = eventsByAction.get(event.action.id) ?? [];
    //   list.push(event);
    //   eventsByAction.set(event.action.id, list);
    // }

    // for (const [, list] of eventsByAction) {
    //   list.sort((a, b) => a.date.getTime() - b.date.getTime());
    //   for (let i = 0; i < list.length - 1; i += 1) {
    //     const current = list[i];
    //     const next = list[i + 1];
    //     if (
    //       !current.action ||
    //       !ANNOUNCEMENT_SUPPORTED_STATUSES.includes(current.newStatus)
    //     ) {
    //       continue;
    //     }
    //     for (const reminder of current.reminders) {
    //       if (!reminder.sentAt) {
    //         const sendTime = this.computeReminderSendDate(reminder, next);
    //         if (sendTime >= windowStart && sendTime <= windowEnd) {
    //           results.push({
    //             type: ActionEventNotifType.Reminder,
    //             reminder,
    //             scheduledFor: sendTime,
    //             referenceEvent: current,
    //             targetEvent: next,
    //             metadata: {
    //               currentEventId: current.id,
    //               nextEventId: next.id,
    //             },
    //           });
    //         }
    //       }
    //     }
    //     for (const personalReminder of current.personalActionReminders) {
    //       if (!personalReminder.sentAt) {
    //         const sendTime = personalReminder.sendTime;
    //         if (sendTime >= windowStart && sendTime <= windowEnd) {
    //           console.log('sending personal reminder', personalReminder);
    //           results.push({
    //             type: ActionEventNotifType.PersonalReminder,
    //             reminder: personalReminder,
    //             scheduledFor: sendTime,
    //             referenceEvent: current,
    //             targetEvent: next,
    //             metadata: {
    //               currentEventId: current.id,
    //               nextEventId: next.id,
    //             },
    //           });
    //         }
    //       }
    //     }
    //   }
    // }

    return results;
  }

  async findMissedDeadlineCandidates(
    reference: Date,
    windowEnd: Date = reference,
  ): Promise<MissedDeadlineCandidate[]> {
    const rows = await this.eventRepository.find({
      where: { date: LessThanOrEqual(windowEnd) },
      relations: ['action', 'action.participatingGroups'],
      order: { action: { id: 'ASC' }, date: 'ASC' },
    });

    const eventsByAction = new Map<number, ActionEvent[]>();
    for (const event of rows) {
      if (!event.action) continue;
      const list = eventsByAction.get(event.action.id) ?? [];
      list.push(event);
      eventsByAction.set(event.action.id, list);
    }

    const candidates = new Map<
      number,
      { deadlineEvent: ActionEvent; resolutionEvent: ActionEvent }
    >();

    for (const [actionId, list] of eventsByAction) {
      list.sort((a, b) => a.date.getTime() - b.date.getTime());
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const deadline = list[i];
        if (deadline.newStatus !== ActionStatus.MemberAction) {
          continue;
        }

        let followUp: ActionEvent | null = null;
        for (let j = i + 1; j < list.length; j += 1) {
          const candidate = list[j];
          if (candidate.newStatus === ActionStatus.MemberAction) {
            continue;
          }
          if (!POST_MEMBER_ACTION_STATUSES.has(candidate.newStatus)) {
            continue;
          }
          followUp = candidate;
          break;
        }

        if (
          followUp &&
          followUp.date >= reference &&
          followUp.date <= windowEnd
        ) {
          candidates.set(actionId, {
            deadlineEvent: deadline,
            resolutionEvent: followUp,
          });
        }

        break;
      }
    }

    if (candidates.size === 0) {
      return [];
    }

    const activities = await this.actionActivityRepository.find({
      where: { actionId: In(Array.from(candidates.keys())) },
      order: { createdAt: 'ASC' },
      select: ['actionId', 'userId', 'type', 'createdAt'],
    });

    const latestActivityByAction = new Map<
      number,
      Map<number, { type: ActionActivityType; createdAt: Date }>
    >();

    for (const activity of activities) {
      const map =
        latestActivityByAction.get(activity.actionId) ??
        new Map<number, { type: ActionActivityType; createdAt: Date }>();
      map.set(activity.userId, {
        type: activity.type,
        createdAt: activity.createdAt,
      });
      latestActivityByAction.set(activity.actionId, map);
    }

    const raw: Array<MissedDeadlineCandidate & { _timelineDate: Date }> = [];

    const extraRecipientsByAction = new Map<number, User[]>();

    await Promise.all(
      Array.from(candidates.entries()).map(async ([actionId, context]) => {
        const action = context.deadlineEvent.action;
        if (!action || !action.commitmentless) {
          return;
        }

        const recipients = await this.recipientService.getFilteredUsersForEvent(
          context.deadlineEvent,
          ActionEventNotifType.MissedDeadline,
        );
        extraRecipientsByAction.set(actionId, recipients);
      }),
    );

    for (const [actionId, context] of candidates) {
      const userIds = new Set<number>();
      const userMap = latestActivityByAction.get(actionId);

      if (userMap) {
        for (const [userId, activity] of userMap) {
          if (activity.type !== ActionActivityType.USER_JOINED) {
            continue;
          }
          userIds.add(userId);
        }
      }

      const extraRecipients = extraRecipientsByAction.get(actionId) ?? [];
      for (const user of extraRecipients) {
        if (!user?.id || !user.contractDateSigned) {
          continue;
        }
        userIds.add(user.id);
      }

      if (userIds.size === 0) {
        continue;
      }

      for (const userId of userIds) {
        raw.push({
          actionId,
          userId,
          deadlineEventId: context.deadlineEvent.id,
          deadlineDate: context.deadlineEvent.date,
          resolutionEventId: context.resolutionEvent.id,
          resolutionDate: context.resolutionEvent.date,
          _timelineDate: context.resolutionEvent.date,
        });
      }
    }

    if (raw.length === 0) {
      return [];
    }

    const userIds = Array.from(
      new Set(raw.map((candidate) => candidate.userId)),
    );
    const completionsByUser = new Map<number, Date[]>();

    if (userIds.length) {
      const completionActivities = await this.actionActivityRepository.find({
        where: {
          userId: In(userIds),
          type: ActionActivityType.USER_COMPLETED,
        },
        order: { createdAt: 'ASC' },
        select: ['userId', 'createdAt'],
      });

      for (const activity of completionActivities) {
        const list = completionsByUser.get(activity.userId) ?? [];
        list.push(activity.createdAt);
        completionsByUser.set(activity.userId, list);
      }
    }

    const groupedByUser = new Map<
      number,
      Array<MissedDeadlineCandidate & { _timelineDate: Date }>
    >();

    for (const candidate of raw) {
      const list = groupedByUser.get(candidate.userId) ?? [];
      list.push(candidate);
      groupedByUser.set(candidate.userId, list);
    }

    for (const [userId, list] of groupedByUser) {
      const completions = (completionsByUser.get(userId) ?? []).slice();
      completions.sort((a, b) => a.getTime() - b.getTime());

      const timeline: Array<
        | { type: 'completion'; time: Date }
        | {
            type: 'miss';
            time: Date;
            candidate: MissedDeadlineCandidate & { _timelineDate: Date };
          }
      > = [];

      for (const completion of completions) {
        timeline.push({ type: 'completion', time: completion });
      }

      for (const candidate of list) {
        timeline.push({
          type: 'miss',
          time: candidate._timelineDate,
          candidate,
        });
      }

      timeline.sort((a, b) => a.time.getTime() - b.time.getTime());
    }

    return raw;
  }

  async getPersonalizedSendTime(
    user: User,
    day: Temporal.PlainDate,
  ): Promise<Temporal.ZonedDateTime> {
    const defaultSendTime: Temporal.PlainTime =
      Temporal.PlainTime.from('19:00:00');
    const defaultTimeZone: Temporal.TimeZoneLike = 'America/Los_Angeles'; //pacific

    const timeOfDay: Temporal.PlainTime =
      user.preferredReminderTime ?? defaultSendTime;
    const timezone: Temporal.TimeZoneLike = user.timeZone ?? defaultTimeZone;

    const zoned = day.toZonedDateTime({
      plainTime: timeOfDay,
      timeZone: timezone,
    });

    return zoned;
  }

  async createReminderGroup(
    eventId: number,
    dto: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: ['action', 'action.participatingGroups'],
    });
    if (event.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException('Event is not a member action event');
    }

    let userGroup: Group | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Group && dto.userGroupId) {
      userGroup = await this.userService.findGroupOrFail(dto.userGroupId);
    }

    let users: User[] | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Custom && dto.userIds) {
      users = await this.userService.findByIds(dto.userIds);
    }

    const group = await this.reminderGroupRepository.save(
      await this.reminderGroupRepository.create({
        ...dto,
        memberActionEvent: event,
        userGroup,
        users,
      }),
    );

    return this.reminderGroupRepository.findOneOrFail({
      where: { id: group.id },
      relations: ['reminders'],
    });
  }

  async updateReminderGroup(
    actionId: number,
    eventId: number,
    groupId: number,
    dto: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
    });

    Object.assign(group, dto);

    const newGroup = await this.reminderGroupRepository.save(group);

    return this.reminderGroupRepository.findOneOrFail({
      where: { id: newGroup.id },
      relations: ['reminders'],
    });
  }

  async deleteReminderGroup(eventId: number, groupId: number): Promise<void> {
    await this.reminderGroupRepository.delete({
      id: groupId,
    });
  }
}

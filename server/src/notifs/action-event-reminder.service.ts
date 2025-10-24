import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { ActionEventNotifType } from './entities/action-event-notif.entity';
import {
  ActionEvent,
  ActionStatus,
  NotificationType,
} from '../actions/entities/action-event.entity';
import {
  ActionActivity,
  ActionActivityType,
} from '../actions/entities/action-activity.entity';
import { ActionEventRecipientService } from './action-event-recipient.service';
import {
  NotificationScheduleEntryDto,
  NotificationScheduleMetadataDto,
} from 'src/actions/dto/notification-schedule.dto';
import { User } from '../user/entities/user.entity';
import { ProfileDto } from 'src/user/user.dto';
import {
  ActionReminder,
  ReminderCohortType,
  ReminderTimingMode,
} from 'src/actions/entities/action-reminder.entity';

export interface MissedDeadlineCandidate {
  actionId: number;
  userId: number;
  deadlineEventId: number;
  deadlineDate: Date;
  resolutionEventId: number;
  resolutionDate: Date;
}

export const ANNOUNCEMENT_SUPPORTED_STATUSES: ActionStatus[] = [
  ActionStatus.GatheringCommitments,
  ActionStatus.MemberAction,
];

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
  metadata?: NotificationScheduleMetadataDto;
} & (
  | {
      type: Exclude<ActionEventNotifType, ActionEventNotifType.Reminder>;
      reminder?: never;
    }
  | {
      type: ActionEventNotifType.Reminder;
      reminder: ActionReminder;
    }
);

@Injectable()
export class ActionEventReminderService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionReminder)
    private readonly reminderRepository: Repository<ActionReminder>,
    private readonly recipientService: ActionEventRecipientService,
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

    // Announcements
    const announcements = await this.eventRepository.find({
      where: {
        sendNotifsTo: Not(NotificationType.None),
        announcementNotifsSentAt: IsNull(),
        newStatus: In(ANNOUNCEMENT_SUPPORTED_STATUSES),
        date: Between(start, end),
      },
      relations: ['action', 'action.participatingGroups'],
      order: { date: 'ASC' },
    });

    for (const event of announcements) {
      plans.push({
        type: ActionEventNotifType.Announcement,
        scheduledFor: event.date,
        referenceEvent: event,
        targetEvent: event,
      });
      requiredEvents.add(event.id);
    }

    // Reminders
    const reminderPlans = await this.computeReminderPlans(start, end);
    for (const plan of reminderPlans) {
      plans.push(plan);
      requiredEvents.add(plan.referenceEvent.id);
      requiredEvents.add(plan.targetEvent.id);
    }

    // Missed deadlines
    const deadlinePlans = await this.computeDeadlinePlans(start, end);
    for (const plan of deadlinePlans) {
      plans.push(plan);
      requiredEvents.add(plan.referenceEvent.id);
      requiredEvents.add(plan.targetEvent.id);
    }

    if (plans.length === 0) {
      return [];
    }

    // Load any events that were not already fully populated with relations TODO
    const missingEventIds = Array.from(requiredEvents).filter((id) =>
      plans.every(
        (plan) => plan.referenceEvent.id !== id && plan.targetEvent.id !== id,
      ),
    );
    if (missingEventIds.length > 0) {
      const extras = await this.eventRepository.find({
        where: { id: In(missingEventIds) },
        relations: ['action', 'action.participatingGroups'],
      });
      const map = new Map(extras.map((event) => [event.id, event]));
      for (const plan of plans) {
        if (!plan.referenceEvent.action) {
          const replacement = map.get(plan.referenceEvent.id);
          if (replacement) plan.referenceEvent = replacement;
        }
        if (!plan.targetEvent.action) {
          const replacement = map.get(plan.targetEvent.id);
          if (replacement) plan.targetEvent = replacement;
        }
      }
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
        const recipients =
          plan.type === ActionEventNotifType.Reminder &&
          plan.reminder.cohortType === ReminderCohortType.Custom
            ? await this.recipientService
                .filterForCompletion(plan.reminder.users, plan.referenceEvent)
                .then((users) => users.map((user) => new ProfileDto(user)))
            : await this.recipientService
                .getFilteredUsersForEvent(plan.referenceEvent, plan.type)
                .then((users) => users.map((user) => new ProfileDto(user)));

        return {
          type: plan.type,
          scheduledFor: plan.scheduledFor,
          actionId: plan.referenceEvent.action!.id,
          actionName: plan.referenceEvent.action!.name,
          actionStatus: plan.referenceEvent.newStatus,
          eventId: plan.referenceEvent.id,
          recipients,
          metadata: plan.metadata,
        };
      }),
    );
  }

  computeReminderSendDate(
    reminder: ActionReminder,
    nextEvent: ActionEvent,
  ): Date {
    if (reminder.timingMode === ReminderTimingMode.Absolute) {
      if (!reminder.sendAtAbsolute) {
        throw new Error('missing sendAtAbsolute for absolute reminder');
      }
      return reminder.sendAtAbsolute;
    } else if (reminder.timingMode === ReminderTimingMode.FromDeadline) {
      if (!reminder.sendAtSecondsFromDeadline) {
        throw new Error(
          'missing sendAtSecondsFromDeadline for relative reminder',
        );
      }
      return new Date(
        nextEvent.date.getTime() - reminder.sendAtSecondsFromDeadline * 1000,
      );
    }
    return reminder.timingMode satisfies never;
  }

  private async computeReminderPlans(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const results: NotificationPlan[] = [];

    const events = await this.eventRepository.find({
      relations: [
        'action',
        'action.participatingGroups',
        'reminders',
        'reminders.users',
      ],
      order: { action: { id: 'ASC' }, date: 'ASC' },
    });

    const eventsByAction = new Map<number, ActionEvent[]>();
    for (const event of events) {
      if (!event.action) continue;
      const list = eventsByAction.get(event.action.id) ?? [];
      list.push(event);
      eventsByAction.set(event.action.id, list);
    }

    for (const [, list] of eventsByAction) {
      list.sort((a, b) => a.date.getTime() - b.date.getTime());
      for (let i = 0; i < list.length - 1; i += 1) {
        const current = list[i];
        const next = list[i + 1];
        if (
          !current.action ||
          !ANNOUNCEMENT_SUPPORTED_STATUSES.includes(current.newStatus)
        ) {
          continue;
        }
        for (const reminder of current.reminders) {
          if (!reminder.sentAt) {
            const sendTime = this.computeReminderSendDate(reminder, next);
            if (sendTime >= windowStart && sendTime <= windowEnd) {
              results.push({
                type: ActionEventNotifType.Reminder,
                reminder,
                scheduledFor: sendTime,
                referenceEvent: current,
                targetEvent: next,
                metadata: {
                  currentEventId: current.id,
                  nextEventId: next.id,
                },
              });
            }
          }
        }
      }
    }

    return results;
  }

  private async computeDeadlinePlans(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const candidates = await this.findMissedDeadlineCandidates(
      windowStart,
      windowEnd,
    );

    if (!candidates.length) {
      return [];
    }

    const eventIds = Array.from(
      new Set(
        candidates.flatMap((candidate) => [
          candidate.deadlineEventId,
          candidate.resolutionEventId,
        ]),
      ),
    );

    const events = await this.eventRepository.find({
      where: { id: In(eventIds) },
      relations: ['action', 'action.participatingGroups'],
    });

    const eventMap = new Map(events.map((event) => [event.id, event]));

    const aggregated = new Map<
      string,
      {
        deadlineEvent: ActionEvent;
        resolutionEvent: ActionEvent;
        count: number;
      }
    >();

    for (const candidate of candidates) {
      const deadlineEvent = eventMap.get(candidate.deadlineEventId);
      const resolutionEvent = eventMap.get(candidate.resolutionEventId);
      if (!deadlineEvent || !resolutionEvent || !deadlineEvent.action) {
        continue;
      }

      const key = `${candidate.resolutionEventId}`;
      const group = aggregated.get(key) ?? {
        deadlineEvent,
        resolutionEvent,
        count: 0,
        isSecondMiss: false,
      };

      group.count += 1;
      aggregated.set(key, group);
    }

    const plans: NotificationPlan[] = [];

    for (const group of aggregated.values()) {
      plans.push({
        type: ActionEventNotifType.MissedDeadline,
        scheduledFor: group.resolutionEvent.date,
        referenceEvent: group.deadlineEvent,
        targetEvent: group.resolutionEvent,
        metadata: {
          deadlineEventId: group.deadlineEvent.id,
        },
      });
    }

    return plans;
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
}

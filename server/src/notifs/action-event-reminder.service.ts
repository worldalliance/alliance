import { Temporal } from '@js-temporal/polyfill';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CreateReminderGroupDto,
  PreviewEmailHtmlDto,
  PreviewTextDto,
} from 'src/actions/dto/action.dto';
import { NotificationScheduleEntryDto } from 'src/actions/dto/notification-schedule.dto';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';
import {
  getGroupSendTimeForUser,
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from 'src/actions/entities/reminder-group.entity';
import { EmailType } from 'src/mail/mail.entity';
import { MailService, processKeywordReplacements } from 'src/mail/mail.service';
import { Tag } from 'src/user/entities/tag.entity';
import { UserService } from 'src/user/user.service';
import { Brackets, In, MoreThan, Repository } from 'typeorm';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
import { User } from '../user/entities/user.entity';
import { ActionEventRecipientService } from './action-event-recipient.service';
import { ActionEventNotifDto } from './entities/action-event-notif.dto';
import {
  ActionEventNotif,
  ActionEventNotifType,
} from './entities/action-event-notif.entity';
import { generateCIDForNotif } from './notif-utils';
import { shouldPushUser, shouldTextUser } from './notifs.service';
import { testUser } from './test-users';

export interface MissedDeadlineCandidate {
  actionId: number;
  userId: number;
  deadlineEventId: number;
  deadlineDate: Date;
  resolutionEventId: number;
  resolutionDate: Date;
}

export const NOTIFICATION_LOOKBACK_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

export const POST_MEMBER_ACTION_STATUSES = new Set<ActionStatus>([
  ActionStatus.OfficeAction,
  ActionStatus.Resolution,
  ActionStatus.Completed,
  ActionStatus.Failed,
  ActionStatus.Abandoned,
]);

export class NotificationPlan {
  @ApiProperty()
  scheduledFor: Date;
  @ApiProperty()
  user: User;
  group: ReminderGroup;
}

export class PreviewNotificationPlan extends NotificationPlan {
  @ApiProperty()
  channel: 'email' | 'text' | 'push';
}

@Injectable()
export class ActionEventReminderService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly eventRepository: Repository<ActionEvent>,
    @InjectRepository(ReminderGroup)
    private readonly reminderGroupRepository: Repository<ReminderGroup>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifRepository: Repository<ActionEventNotif>,
    private readonly recipientService: ActionEventRecipientService,
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) { }

  async findPlansForGroup(
    group: ReminderGroup,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const plans: NotificationPlan[] = [];

    const users = await this.recipientService.findReminderGroupCohort(group);
    for (const user of users) {
      const reminderSendTime = getGroupSendTimeForUser(user, group);

      if (!reminderSendTime) continue;

      if (await this.userService.isUserIdAway(user.id, reminderSendTime))
        continue;

      if (
        await this.actionEventNotifRepository.exists({
          where: {
            user: { id: user.id },
            reminderGroup: { id: group.id },
            sent: true,
          },
        })
      ) {
        continue;
      }

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

  async attachDeadlineEvent(group: ReminderGroup): Promise<ReminderGroup> {
    if (group.deadlineEvent || !group.memberActionEvent) {
      return group;
    }
    const deadlineEvents = await this.eventRepository.find({
      where: {
        action: { id: group.memberActionEvent.action.id },
        date: MoreThan(group.memberActionEvent.date),
        newStatus: In(Array.from(POST_MEMBER_ACTION_STATUSES)),
      },
      order: {
        date: 'ASC',
      },
      take: 1,
    });
    if (deadlineEvents.length === 0) {
      return group;
    }
    return { ...group, deadlineEvent: deadlineEvents[0] };
  }

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
        const event = plan.group.memberActionEvent!;
        return {
          scheduledFor: plan.scheduledFor,
          actionId: event.action!.id,
          actionName: event.action!.name,
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
      .createQueryBuilder('rg')
      .leftJoin('rg.memberActionEvent', 'event')
      .leftJoin('rg.deadlineEvent', 'deadline')
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
                  AND deadline."date" IS NOT NULL
                  AND (deadline."date" - (rg."relative_range_start_seconds_from_deadline" * interval '1 second')) <= :we
                  AND (deadline."date" - (rg."relative_range_end_seconds_from_deadline" * interval '1 second')) >= :ws
                )`,
            )
            .orWhere(
              `(
                 rg."timingMode" = :from
                 AND deadline."date" IS NOT NULL
                 AND (deadline."date" - (rg."sendAtSecondsFromDeadline" * interval '1 second'))
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
      .select('rg.id', 'id')
      .distinct(true)
      .getRawMany<{ id: number }>();

    const ids = idRows.map((r) => r.id);

    if (ids.length === 0) {
      return [];
    }

    return repo
      .createQueryBuilder('rg')
      .leftJoinAndSelect('rg.memberActionEvent', 'event')
      .leftJoinAndSelect('event.action', 'eventAction')
      .leftJoinAndSelect('eventAction.participatingTags', 'eventActionTags')
      .leftJoinAndSelect('rg.deadlineEvent', 'deadline')
      .leftJoinAndSelect('rg.users', 'users')
      .leftJoinAndSelect('users.tags', 'userTags')
      .leftJoinAndSelect('users.contractEvents', 'contractEvents')
      .leftJoinAndSelect('rg.userTag', 'userTag')
      .leftJoinAndSelect('rg.actionSuite', 'actionSuite')
      .leftJoinAndSelect('actionSuite.actions', 'actionSuiteActions')
      .where('rg.id IN (:...ids)', { ids })
      .getMany();
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

  async findNotificationPlansForGroup(
    groupId: number,
  ): Promise<PreviewNotificationPlan[]> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: {
        memberActionEvent: {
          action: {
            participatingTags: true,
          },
        },
        deadlineEvent: true,
        users: { contractEvents: true },
        userTag: true,
        actionSuite: { actions: true },
      },
    });

    const plans = await this.findPlansForGroup(
      group,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    );
    return plans.map((plan) => ({
      ...plan,
      channel: shouldPushUser(plan.user)
        ? 'push'
        : shouldTextUser(plan.user)
          ? 'text'
          : 'email',
    }));
  }

  async getSentNotifsForGroup(groupId: number): Promise<ActionEventNotifDto[]> {
    const notifs = await this.actionEventNotifRepository.find({
      where: { reminderGroup: { id: groupId }, sent: true },
      relations: { user: true, mms: true, mail: true },
    });
    return notifs.map((notif) => new ActionEventNotifDto(notif));
  }

  async createReminderGroup(
    eventId: number,
    dto: CreateReminderGroupDto,
  ): Promise<ReminderGroup> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    if (event.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException('Event is not a member action event');
    }

    let userTag: Tag | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Tag && dto.userTagId) {
      userTag = await this.userService.findTagOrFail(dto.userTagId);
    }

    let users: User[] | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Custom && dto.userIds) {
      users = await this.userService.findByIds(dto.userIds);
    }

    let actionSuite: ActionSuite | undefined = undefined;
    if (dto.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: dto.suiteId },
      });
    }

    const group = await this.reminderGroupRepository.create({
      ...dto,
      memberActionEvent: event,
      actionSuite,
      userTag,
      users,
    });

    const withDeadline = await this.attachDeadlineEvent(group);

    return this.reminderGroupRepository.save(withDeadline);
  }

  async updateReminderGroup(
    groupId: number,
    dto: CreateReminderGroupDto,
  ): Promise<ReminderGroup> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: { memberActionEvent: { action: true } },
    });

    let userTag: Tag | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Tag && dto.userTagId) {
      userTag = await this.userService.findTagOrFail(dto.userTagId);
    }

    let users: User[] | undefined = undefined;
    if (dto.cohortType === ReminderCohortType.Custom && dto.userIds) {
      users = await this.userService.findByIds(dto.userIds);
    }

    Object.assign(group, dto);
    group.userTag = userTag;
    group.users = users;

    const withDeadline = await this.attachDeadlineEvent(group);

    return this.reminderGroupRepository.save(withDeadline);
  }

  async deleteReminderGroup(groupId: number): Promise<void> {
    await this.reminderGroupRepository.delete({
      id: groupId,
    });
  }

  async getReminderGroupsForEvent(id: number): Promise<ReminderGroup[]> {
    return this.reminderGroupRepository.find({
      where: { memberActionEvent: { id } },
      relations: { memberActionEvent: true, userTag: true, users: true },
    });
  }

  async loadEventsForPreview(
    eventId: number,
  ): Promise<{ deadlineEvent: ActionEvent | undefined; event: ActionEvent }> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: true },
    });
    const deadlineEvents = await this.eventRepository.find({
      where: {
        action: { id: event.action.id },
        date: MoreThan(event.date),
        newStatus: In(Array.from(POST_MEMBER_ACTION_STATUSES)),
      },
      order: {
        date: 'ASC',
      },
      take: 1,
    });
    return {
      event,
      deadlineEvent: deadlineEvents.length > 0 ? deadlineEvents[0] : undefined,
    };
  }

  async getKeywordContextForPreview(
    eventId: number,
    dto: PreviewEmailHtmlDto | PreviewTextDto,
    sendTime?: Date,
  ) {
    const { event, deadlineEvent } = await this.loadEventsForPreview(eventId);

    return {
      action: event.action,
      deadlineEvent,
      user: testUser,
      cid: await generateCIDForNotif(),
      uncompletedTasksCount: dto.taskCount,
      uncompletedTasksTime: dto.taskCount * 5 + ' minutes',
      uncompletedTasksNames: ['Task 1', 'Task 2', 'Task 3'].slice(
        0,
        dto.taskCount,
      ),
      dateNow: sendTime,
    };
  }

  async previewEmailHtml(
    eventId: number,
    dto: PreviewEmailHtmlDto,
    sendTime?: Date,
  ): Promise<string> {
    const replaced = processKeywordReplacements(
      dto.emailMessage,
      await this.getKeywordContextForPreview(eventId, dto, sendTime),
    );

    return this.mailService.renderHtml(EmailType.CustomActionReminder, {
      customMessage: replaced.replace(/\n/g, '<br>'),
    });
  }

  async previewTextMessage(
    eventId: number,
    dto: PreviewTextDto,
    sendTime?: Date,
  ): Promise<string> {
    const context = await this.getKeywordContextForPreview(
      eventId,
      dto,
      sendTime,
    );

    return processKeywordReplacements(dto.textMessage, context);
  }
}

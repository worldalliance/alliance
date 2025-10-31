import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ActionEventNotifType } from './entities/action-event-notif.entity';
import {
  ActionEvent,
  ActionStatus,
} from '../actions/entities/action-event.entity';
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
import { ApiProperty } from '@nestjs/swagger';
import { ActionSuite } from 'src/actions/entities/action-suite.entity';

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

export class NotificationPlan {
  @ApiProperty()
  scheduledFor: Date;
  @ApiProperty()
  referenceEvent: ActionEvent;
  @ApiProperty()
  targetEvent: ActionEvent;
  @ApiProperty()
  user: User;
  group: ReminderGroup;
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
    private readonly recipientService: ActionEventRecipientService,
    private readonly userService: UserService,
  ) {}

  async getPlansForGroup(
    group: ReminderGroup,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationPlan[]> {
    const plans: NotificationPlan[] = [];

    const users = await this.recipientService.getReminderGroupCohort(group);

    for (const user of users) {
      const reminderSendTime = getGroupSendTimeForUser(user, group);

      if (!reminderSendTime) continue;

      if (reminderSendTime >= windowStart && reminderSendTime <= windowEnd) {
        plans.push({
          user,
          group,
          scheduledFor: reminderSendTime,
          referenceEvent: group.memberActionEvent,
          targetEvent: group.memberActionEvent,
        });
      }
    }

    return plans;
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
      const groupPlans = await this.getPlansForGroup(
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
      .leftJoinAndSelect('rg.memberActionEvent', 'event')
      .leftJoinAndSelect('event.action', 'eventAction')
      .leftJoinAndSelect('eventAction.participatingGroups', 'eventActionGroups')
      .leftJoinAndSelect('rg.deadlineEvent', 'deadline')
      .leftJoinAndSelect('rg.users', 'users')
      .leftJoinAndSelect('users.groups', 'userGroups')
      .leftJoinAndSelect('rg.userGroup', 'userGroup')
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
        launch: ReminderGroupTimingMode.EventLaunch,
        ws: windowStart,
        we: windowEnd,
      })
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

  async getNotificationPlansForGroup(
    groupId: number,
  ): Promise<NotificationPlan[]> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
      relations: [
        'memberActionEvent',
        'memberActionEvent.action',
        'memberActionEvent.action.participatingGroups',
        'users',
      ],
    });
    return this.getPlansForGroup(
      group,
      new Date(),
      new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    );
  }

  async createReminderGroup(
    eventId: number,
    dto: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    const event = await this.eventRepository.findOneOrFail({
      where: { id: eventId },
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

    let actionSuite: ActionSuite | undefined = undefined;
    if (dto.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: dto.suiteId },
      });
    }

    return this.reminderGroupRepository.save(
      await this.reminderGroupRepository.create({
        ...dto,
        memberActionEvent: event,
        actionSuite,
        userGroup,
        users,
      }),
    );
  }

  async updateReminderGroup(
    groupId: number,
    dto: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    const group = await this.reminderGroupRepository.findOneOrFail({
      where: { id: groupId },
    });

    Object.assign(group, dto);

    return this.reminderGroupRepository.save(group);
  }

  async deleteReminderGroup(groupId: number): Promise<void> {
    await this.reminderGroupRepository.delete({
      id: groupId,
    });
  }

  async getReminderGroupsForEvent(id: number): Promise<ReminderGroup[]> {
    return this.reminderGroupRepository.find({
      where: { memberActionEvent: { id } },
      relations: ['memberActionEvent'],
    });
  }
}

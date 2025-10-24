import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiProperty } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { instanceToPlain } from 'class-transformer';
import { from, Observable } from 'rxjs';
import { CommentDto, CreateCommentDto } from 'src/forum/dto/comment.dto';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import { ActionEventReminderService } from 'src/notifs/action-event-reminder.service';
import { NotifsService } from 'src/notifs/notifs.service';
import { ILike, In, LessThan, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  ActionReminderDto,
  AdminActionEventDto,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionReminderDto,
  CreateActionUpdateDto,
  LatLonDto,
  PreEventNotifDataDto,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionReminderDto,
} from './dto/action.dto';
import {
  ActionActivity,
  ActionActivityType,
} from './entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
  NotificationType,
} from './entities/action-event.entity';
import { Action, ActionTaskType } from './entities/action.entity';
import {
  ActionReminder,
  ReminderCohortType,
  ReminderTimingMode,
} from './entities/action-reminder.entity';
import { Group } from 'src/user/entities/group.entity';
import { UserDto } from 'src/user/user.dto';
import { NotificationScheduleEntryDto } from './dto/notification-schedule.dto';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { User } from 'src/user/entities/user.entity';
import { ActionEventNotifType } from 'src/notifs/entities/action-event-notif.entity';
import { ActionUpdate } from './entities/action-update.entity';

export enum UserActionRelation {
  Joined = 'joined',
  Completed = 'completed',
  None = 'none',
  Declined = 'declined',
}

export class UserActionRelationDto {
  @ApiProperty({ enum: UserActionRelation, enumName: 'UserActionRelation' })
  relation: UserActionRelation;
}

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(EditableContent)
    private readonly editableContentRepository: Repository<EditableContent>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(ActionReminder)
    private readonly actionReminderRepository: Repository<ActionReminder>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notifsService: NotifsService,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly actionEventReminderService: ActionEventReminderService,
  ) {}

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const { participatingGroups, ...rest } = createActionDto;
    const action = this.actionRepository.create(rest);

    if (participatingGroups && participatingGroups.length > 0) {
      action.participatingGroups =
        await this.resolveParticipatingGroups(participatingGroups);
    }

    return this.actionRepository.save(action);
  }

  findAll(): Promise<ActionDto[]> {
    return this.actionRepository
      .find({
        relations: ['events', 'activities', 'participatingGroups'],
      })
      .then((actions) => {
        return actions.map((action) => new ActionDto(action));
      });
  }

  async getUsersJoinedForCommitmentlessAction(action: Action): Promise<number> {
    const baseUsers =
      await this.actionEventRecipientService.getBaseUsersForEvent(
        ActionStatus.MemberAction,
        action,
        action.events.find(
          (event) => event.newStatus === ActionStatus.MemberAction,
        )?.date ?? new Date(),
      );
    const completionActivities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        type: ActionActivityType.USER_COMPLETED,
      },
    });
    const set = new Set([
      ...baseUsers.map((user) => user.id),
      ...completionActivities.map((activity) => activity.userId),
    ]);

    return set.size;
  }

  async findPublic(userId?: number): Promise<ActionDto[]> {
    const actions = await this.actionRepository.find({
      relations: ['events', 'activities', 'participatingGroups'],
    });

    const user = userId
      ? await this.userService.findOne(userId, ['groups'])
      : null;

    const filtered: Action[] = [];
    for (const action of actions) {
      if (await this.userCanSeeAction(action, user)) {
        filtered.push(action);
      }
    }

    return await Promise.all(
      filtered.map(async (action) => {
        let shouldParticipate = false;
        if (
          user &&
          action.events.some(
            (event) => event.newStatus === ActionStatus.MemberAction,
          )
        ) {
          const targetGroupIds = new Set(
            (action.participatingGroups || []).map((group) => group.id),
          );
          shouldParticipate =
            this.actionEventRecipientService.userShouldCompleteEvent(
              user,
              action.events.find(
                (event) => event.newStatus === ActionStatus.MemberAction,
              )!.date,
              targetGroupIds,
              action.everyoneShouldComplete,
            );
        }
        return new ActionDto(action, {
          canParticipate: user
            ? await this.isEligibleForAction(action, user)
            : false,
          shouldParticipate: shouldParticipate,
          userJoined: action.commitmentless
            ? await this.getUsersJoinedForCommitmentlessAction(action)
            : undefined,
          reqAuthenticated: !!user,
        });
      }),
    );
  }

  async getNotificationSchedule(
    windowStart: Date,
    windowEnd: Date,
  ): Promise<NotificationScheduleEntryDto[]> {
    return this.actionEventReminderService.getNotificationSchedule(
      windowStart,
      windowEnd,
    );
  }

  async userCanSeeAction(action: Action, user: User | null): Promise<boolean> {
    if (user?.admin) {
      return true;
    }
    if (action.status === ActionStatus.Draft || action.archived) {
      return false;
    }
    if (
      !action.participatingGroups?.length ||
      action.showToNonparticipating === true
    ) {
      return true;
    }
    if (!user) {
      return false;
    }

    if (!action.participatingGroups?.length) {
      return false;
    }

    return user.groups.some((group) =>
      action.participatingGroups.some(
        (participatingGroup) => participatingGroup.id === group.id,
      ),
    );
  }

  async findOne(
    id: number,
    userId?: number,
    serverSide = false,
  ): Promise<Action> {
    const user = userId
      ? await this.userService.findOne(userId, ['groups'])
      : null;
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: ['events', 'activities', 'participatingGroups', 'updates'],
    });

    if (
      !action ||
      !((await this.userCanSeeAction(action, user)) || serverSide)
    ) {
      throw new NotFoundException('Action not found');
    }
    return instanceToPlain(action) as Action;
  }

  async findOneDto(
    id: number,
    userId?: number,
    serverSide = false,
  ): Promise<ActionDto> {
    const action = await this.findOne(id, userId, serverSide);
    const user = userId
      ? await this.userService.findOne(userId, ['groups'])
      : null;
    return new ActionDto(action, {
      canParticipate: user
        ? await this.isEligibleForAction(action, user)
        : false,
      userJoined: action.commitmentless
        ? await this.getUsersJoinedForCommitmentlessAction(action)
        : undefined,
      userRelation: user
        ? await this.getActionRelation(action.id, user.id)
        : undefined,
      reqAuthenticated: !!user,
    });
  }

  async getActionRelation(
    actionId: number,
    userId: number,
  ): Promise<UserActionRelation> {
    const activities = await this.actionActivityRepository.find({
      where: { action: { id: actionId }, user: { id: userId } },
    });
    if (
      activities.some(
        (activity) => activity.type === ActionActivityType.USER_DECLINED,
      )
    ) {
      return UserActionRelation.Declined;
    }
    if (
      activities.some(
        (activity) => activity.type === ActionActivityType.USER_WONT_COMPLETE,
      )
    ) {
      return UserActionRelation.Declined;
    }
    if (
      activities.some(
        (activity) => activity.type === ActionActivityType.USER_COMPLETED,
      )
    ) {
      return UserActionRelation.Completed;
    }
    if (
      activities.some(
        (activity) => activity.type === ActionActivityType.USER_JOINED,
      )
    ) {
      return UserActionRelation.Joined;
    }
    return UserActionRelation.None;
  }

  async createActionActivity(
    actionId: number,
    userId: number,
    type: ActionActivityType,
    taskFormResponse?: FormResponse,
  ): Promise<ActionActivityDto> {
    const action = await this.findOne(actionId, userId);

    if (
      type === ActionActivityType.USER_JOINED ||
      type === ActionActivityType.USER_COMPLETED
    ) {
      await this.ensureUserEligibleForAction(action, userId);
    }

    if (type === ActionActivityType.USER_JOINED) {
      this.eventEmitter.emit('action.delta', { actionId, delta: +1 });
    }

    const user = await this.userService.findOneOrFail(userId);

    const activity = this.actionActivityRepository.create({
      type: type,
      actionId: actionId,
      userId: userId,
      action: action,
      user: user,
      taskFormResponse,
    });
    const savedActivity = await this.actionActivityRepository.save(activity);

    const activityDto = new ActionActivityDto(savedActivity);
    this.eventEmitter.emit('action.activity', {
      actionId,
      activity: activityDto,
    });

    await this.checkAndProcessAutomaticTransitions(actionId);

    return activityDto;
  }

  async joinAction(
    actionId: number,
    userId: number,
  ): Promise<ActionActivityDto> {
    return this.createActionActivity(
      actionId,
      userId,
      ActionActivityType.USER_JOINED,
    );
  }

  async declineAction(
    actionId: number,
    userId: number,
    reason: string,
    isMoral: boolean,
  ): Promise<ActionActivityDto> {
    const action = await this.findOne(actionId, userId);
    await this.ensureUserEligibleForAction(action, userId);
    const user = await this.userService.findOneOrFail(userId);

    const activity = this.actionActivityRepository.create({
      type: ActionActivityType.USER_DECLINED,
      actionId: actionId,
      userId: userId,
      action: action,
      user: user,
      declineReason: reason,
      isMoral,
    });
    const savedActivity = await this.actionActivityRepository.save(activity);
    return new ActionActivityDto(savedActivity);
  }

  async optoutAction(
    actionId: number,
    userId: number,
    reason: string,
    outOfTime: boolean,
  ): Promise<ActionActivityDto> {
    const action = await this.findOne(actionId, userId);
    await this.ensureUserEligibleForAction(action, userId);
    const user = await this.userService.findOneOrFail(userId);

    const activity = this.actionActivityRepository.create({
      type: ActionActivityType.USER_WONT_COMPLETE,
      actionId: actionId,
      userId: userId,
      action: action,
      user: user,
      declineReason: reason,
      outOfTime,
    });
    const savedActivity = await this.actionActivityRepository.save(activity);
    return new ActionActivityDto(savedActivity);
  }

  async completeAction(
    actionId: number,
    userId: number,
    taskFormResponse?: FormResponse,
  ): Promise<ActionActivityDto> {
    return this.createActionActivity(
      actionId,
      userId,
      ActionActivityType.USER_COMPLETED,
      taskFormResponse,
    );
  }

  async update(
    id: number,
    updateActionDto: UpdateActionDto,
    userId: number,
  ): Promise<Action | null> {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: ['participatingGroups'],
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    const { participatingGroups, ...rest } = updateActionDto;

    Object.assign(action, rest);

    if (participatingGroups !== undefined) {
      action.participatingGroups =
        await this.resolveParticipatingGroups(participatingGroups);
    }

    await this.actionRepository.save(action);
    return this.findOne(id, userId);
  }

  async addEvent(
    actionId: number,
    actionEventDto: CreateActionEventDto,
    userId?: number,
  ): Promise<ActionEvent> {
    const action = await this.findOne(actionId, userId);

    const newEvent = this.actionEventRepository.create({
      ...actionEventDto,
      action,
    });

    const savedEvent = await this.actionEventRepository.save(newEvent);

    return savedEvent;
  }

  private sanitizeMessage(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private async applyReminderChanges(
    reminder: ActionReminder,
    actionId: number,
    event: ActionEvent,
    dto: CreateActionReminderDto | UpdateActionReminderDto,
  ): Promise<void> {
    const timingMode = dto.timingMode ?? reminder.timingMode;
    if (!timingMode) {
      throw new BadRequestException('Timing mode is required for reminders');
    }
    reminder.timingMode = timingMode;

    if (dto.deadlineEventId !== undefined) {
      const deadlineEvent = await this.actionEventRepository.findOne({
        where: { id: dto.deadlineEventId, action: { id: actionId } },
      });
      if (!deadlineEvent) {
        throw new NotFoundException('Deadline event not found');
      }
    }

    let sendAtAbsolute =
      dto.sendAtAbsolute ?? reminder.sendAtAbsolute ?? undefined;
    if (typeof sendAtAbsolute === 'string') {
      const parsed = new Date(sendAtAbsolute);
      sendAtAbsolute = Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const secondsSource =
      dto.sendAtSecondsFromDeadline ?? reminder.sendAtSecondsFromDeadline;
    const sendAtSecondsFromDeadline =
      secondsSource !== undefined && secondsSource !== null
        ? Number(secondsSource)
        : undefined;

    if (timingMode === ReminderTimingMode.Absolute) {
      if (!sendAtAbsolute) {
        throw new BadRequestException(
          'sendAtAbsolute is required when timingMode is absolute',
        );
      }
      reminder.sendAtAbsolute = sendAtAbsolute;
      reminder.sendAtSecondsFromDeadline = undefined;
    } else if (timingMode === ReminderTimingMode.FromDeadline) {
      if (
        sendAtSecondsFromDeadline === undefined ||
        Number.isNaN(sendAtSecondsFromDeadline)
      ) {
        throw new BadRequestException(
          'sendAtSecondsFromDeadline is required when timingMode is from deadline',
        );
      }
      reminder.sendAtSecondsFromDeadline = sendAtSecondsFromDeadline;
      reminder.sendAtAbsolute = undefined;
    }

    const cohortType =
      dto.cohortType ??
      reminder.cohortType ??
      ReminderCohortType.AllUncompleted;
    if (!cohortType) {
      throw new BadRequestException('Cohort type is required for reminders');
    }
    reminder.cohortType = cohortType;

    if (cohortType === ReminderCohortType.Custom) {
      const userIdsSource =
        dto.userIds ??
        (reminder.users ? reminder.users.map((user) => user.id) : []);
      const uniqueUserIds = Array.from(new Set(userIdsSource));
      if (!uniqueUserIds.length) {
        throw new BadRequestException(
          'Custom cohorts require at least one user',
        );
      }

      const users = await this.userRepository.find({
        where: { id: In(uniqueUserIds) },
        relations: ['groups'],
      });

      if (users.length !== uniqueUserIds.length) {
        const foundIds = new Set(users.map((user) => user.id));
        const missing = uniqueUserIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(`User(s) not found: ${missing.join(', ')}`);
      }

      reminder.users = users;
    } else {
      reminder.users = [];
    }

    if (dto.emailSubject !== undefined) {
      const trimmedSubject = dto.emailSubject?.trim() ?? '';
      reminder.emailSubject = trimmedSubject || reminder.emailSubject;
    }

    if (dto.emailMessage !== undefined) {
      const sanitized = this.sanitizeMessage(dto.emailMessage);
      if (sanitized !== undefined) {
        reminder.emailMessage = sanitized;
      }
    }

    if (dto.textMessage !== undefined) {
      const sanitized = this.sanitizeMessage(dto.textMessage);
      if (sanitized !== undefined) {
        reminder.textMessage = sanitized;
      }
    }

    reminder.memberActionEvent = event;
  }

  private async buildReminderDto(
    reminderId: number,
  ): Promise<ActionReminderDto> {
    const fullReminder = await this.actionReminderRepository.findOne({
      where: { id: reminderId },
      relations: ['memberActionEvent', 'memberActionEvent.action', 'users'],
    });

    if (!fullReminder) {
      throw new NotFoundException('Failed to load reminder');
    }

    return new ActionReminderDto(fullReminder);
  }

  async createReminder(
    actionId: number,
    eventId: number,
    dto: CreateActionReminderDto,
  ): Promise<ActionReminderDto> {
    const event = await this.actionEventRepository.findOne({
      where: { id: eventId, action: { id: actionId } },
      relations: ['action'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException(
        'Custom reminders can only be created for member action events',
      );
    }

    const reminder = this.actionReminderRepository.create({
      memberActionEvent: event,
      users: [],
    });

    await this.applyReminderChanges(reminder, actionId, event, dto);

    const saved = await this.actionReminderRepository.save(reminder);

    return this.buildReminderDto(saved.id);
  }

  async updateReminder(
    actionId: number,
    eventId: number,
    reminderId: number,
    dto: UpdateActionReminderDto,
  ): Promise<ActionReminderDto> {
    const reminder = await this.actionReminderRepository.findOne({
      where: { id: reminderId },
      relations: ['memberActionEvent', 'memberActionEvent.action', 'users'],
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    if (
      !reminder.memberActionEvent ||
      reminder.memberActionEvent.id !== eventId ||
      reminder.memberActionEvent.action?.id !== actionId
    ) {
      throw new NotFoundException('Reminder not found');
    }

    if (reminder.memberActionEvent.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException(
        'Custom reminders can only be created for member action events',
      );
    }

    await this.applyReminderChanges(
      reminder,
      actionId,
      reminder.memberActionEvent,
      dto,
    );

    const saved = await this.actionReminderRepository.save(reminder);

    return this.buildReminderDto(saved.id);
  }

  async deleteReminder(reminderId: number) {
    const reminder = await this.actionReminderRepository.findOne({
      where: { id: reminderId },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    await this.actionReminderRepository.delete(reminderId);
  }

  async remove(id: number) {
    await this.actionRepository.delete(id);
  }

  countCommitted(actionId: number): Observable<number> {
    return from(
      this.actionActivityRepository.count({
        where: {
          action: { id: actionId },
          type: ActionActivityType.USER_JOINED,
        },
      }),
    );
  }

  async countCommittedBulk(ids: number[]): Promise<Record<number, number>> {
    if (!ids.length) return {};

    const rows = await this.actionActivityRepository
      .createQueryBuilder('ua')
      .select('ua.actionId', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('ua.actionId IN (:...ids)', { ids })
      .andWhere('ua.type IN (:...types)', {
        types: [ActionActivityType.USER_JOINED],
      })
      .groupBy('ua.actionId')
      .getRawMany<{ id: string; count: string }>();

    const map: Record<number, number> = {};
    rows.forEach((r) => (map[+r.id] = +r.count));
    ids.forEach((id) => (map[id] ??= 0));
    return map;
  }

  async findCompletedForUser(userId: number): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: { userId, type: ActionActivityType.USER_COMPLETED },
      relations: ['action'],
    });
    return activities.map((activity) => new ActionActivityDto(activity));
  }

  async userCoordinatesForAction(actionId: number): Promise<LatLonDto[]> {
    const joinActivities = await this.actionActivityRepository.find({
      where: {
        action: { id: actionId },
        type: ActionActivityType.USER_JOINED,
      },
      relations: ['user', 'user.city'],
    });
    return joinActivities
      .filter(
        (activity) =>
          activity.user.city !== null && activity.user.city !== undefined,
      )
      .map((activity) => ({
        latitude: activity.user.city!.latitude,
        longitude: activity.user.city!.longitude,
      }));
  }

  async getActionActivities(actionId: number): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: { actionId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return activities.map((activity) => new ActionActivityDto(activity));
  }

  async getActivityFeed(
    limit: number = 20,
    before?: Date,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: {
        ...(before ? { createdAt: LessThan(before) } : {}),
        type: In([
          ActionActivityType.USER_JOINED,
          ActionActivityType.USER_COMPLETED,
        ]),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    if (activities.length === 0) {
      return [];
    }

    return Promise.all(
      activities.map(async (activity) => {
        return new ActionActivityDto(activity);
      }),
    );
  }

  private async resolveParticipatingGroups(
    groups?: Array<Partial<Group>>,
  ): Promise<Group[]> {
    if (!groups || groups.length === 0) {
      return [];
    }

    const ids = groups
      .map((group) => group?.id)
      .filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));
    const found = await this.groupRepository.findBy({ id: In(uniqueIds) });

    if (found.length !== uniqueIds.length) {
      const foundIds = new Set(found.map((group) => group.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Group(s) not found: ${missing.join(', ')}`);
    }

    return found;
  }

  async isIdEligibleForAction(
    actionId: number,
    userId: number,
  ): Promise<boolean> {
    const action = await this.findOne(actionId, userId);
    const user = await this.userService.findOne(userId, ['groups']);
    if (!user) {
      return false;
    }
    return this.isEligibleForAction(action, user);
  }

  async isEligibleForAction(action: Action, user: User): Promise<boolean> {
    const groups = action.participatingGroups;
    const userGroupIds = new Set((user.groups || []).map((group) => group.id));
    const isMember = groups.some((group) => userGroupIds.has(group.id));
    return isMember;
  }

  async ensureUserEligibleForAction(action: Action, userId: number) {
    const groups = action.participatingGroups;

    const user = await this.userService.findOne(userId, ['groups']);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userGroupIds = new Set((user.groups || []).map((group) => group.id));
    const isMember = groups.some((group) => userGroupIds.has(group.id));

    if (!isMember) {
      throw new ForbiddenException(
        'This action is not available to your groups.',
      );
    }
  }

  async checkAndProcessAutomaticTransitions(actionId: number) {
    const action = await this.findOne(actionId, undefined, true);

    // Check if we should transition from GatheringCommitments to CommitmentsReached
    if (action.status === ActionStatus.GatheringCommitments) {
      if (
        action.commitmentThreshold &&
        action.usersJoined >= action.commitmentThreshold
      ) {
        await this.createAutomaticTransitionEvent(
          actionId,
          ActionStatus.OfficeAction,
          'Commitment threshold reached',
          `${action.usersJoined} people have committed to this action, meeting the threshold of ${action.commitmentThreshold}.`,
        );
      }
    }

    // Check if we should transition from MemberAction to Resolution
    if (
      action.status === ActionStatus.MemberAction &&
      action.usersJoined > 0 &&
      action.usersCompleted >= action.usersJoined &&
      !action.commitmentless
    ) {
      await this.createAutomaticTransitionEvent(
        actionId,
        ActionStatus.Resolution,
        'All members completed action',
        `All ${action.usersJoined} committed members have completed the action.`,
      );
    }
  }

  private async createAutomaticTransitionEvent(
    actionId: number,
    newStatus: ActionStatus,
    title: string,
    description: string,
  ): Promise<void> {
    const action = await this.findOne(actionId, undefined, true);

    const eventData: CreateActionEventDto = {
      title,
      description,
      newStatus,
      sendNotifsTo: NotificationType.Joined, // Notify users who joined the action
      date: new Date(), // Set to current time for immediate transition
      showInTimeline: true,
    };

    const newEvent = this.actionEventRepository.create({
      ...eventData,
      action,
    });

    await this.actionEventRepository.save(newEvent);
  }

  async clearDb() {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    // Clear in order to respect foreign key constraints
    await this.actionActivityRepository.delete({});
    await this.actionEventRepository.delete({});
    await this.actionRepository.delete({});
  }

  async setTestRelations(id: number) {
    const actions = await this.actionRepository.find({
      relations: ['events'],
    });
    for (const action of actions) {
      if (action.status === ActionStatus.MemberAction) {
        await this.createActionActivity(
          action.id,
          id,
          ActionActivityType.USER_JOINED,
        );
      }
    }
  }

  async getActivityForUser(userId: number): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: {
        user: { id: userId },
      },
      relations: ['action', 'user', 'likes'],
    });
    return activities.map((activity) => new ActionActivityDto(activity));
  }

  async friendActivity(userId: number): Promise<ActionActivityDto[]> {
    const user = await this.userService.findOne(userId, [
      'sentFriendRequests',
      'receivedFriendRequests',
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const friends = await this.userService.findFriends(userId);
    const friendActivities = await this.actionActivityRepository.find({
      where: {
        user: { id: In(friends.map((f) => f.id)) },
        type: In([
          ActionActivityType.USER_JOINED,
          ActionActivityType.USER_COMPLETED,
        ]),
      },
      relations: ['user', 'action'],
      order: { createdAt: 'DESC' },
    });
    return friendActivities.map((activity) => new ActionActivityDto(activity));
  }

  async findByName(name: string): Promise<Action[]> {
    const actions = await this.actionRepository.find({
      where: { name: ILike(`%${name}%`) },
      relations: ['events'],
    });
    return actions.filter((action) => action.status !== ActionStatus.Draft);
  }

  async getActivity(id: number): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: ['user', 'action', 'likes'],
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return new ActionActivityDto(activity);
  }

  async getEvent(id: number): Promise<ActionEventDto> {
    const event = await this.actionEventRepository.findOne({
      where: { id },
      relations: ['action'],
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return new ActionEventDto(event);
  }

  async likeActivity(id: number, userId: number, unlike = false) {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: ['user', 'action', 'likes'],
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    const user = await this.userService.findOneOrFail(userId);

    const qb = this.actionActivityRepository
      .createQueryBuilder()
      .relation(ActionActivity, 'likes')
      .of(activity);

    if (unlike) {
      await qb.remove(user);
    } else if (!activity.likes.some((like) => like.id === user.id)) {
      await qb.add(user);
    }

    const updatedActivity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: ['likes'],
    });
    if (!updatedActivity) {
      throw new NotFoundException('Activity not found');
    }

    return new ActionActivityDto(updatedActivity);
  }

  async addActivityComment(
    id: number,
    commentDto: CreateCommentDto,
    userId: number,
  ): Promise<CommentDto> {
    const user = await this.userService.findOneOrFail(userId);
    const content = this.editableContentRepository.create({
      body: commentDto.editableContent.body,
      attachments: commentDto.editableContent.attachments ?? [],
    });
    await this.editableContentRepository.save(content);
    const comment = this.commentRepository.create({
      parentObjectType: CommentParentObject.Activity,
      parentObjectId: id,
      parentId: commentDto.parentId,
      author: user,
      authorId: user.id,
      editableContent: content,
    });
    const savedComment = await this.commentRepository.save(comment);
    return new CommentDto(savedComment);
  }

  async updateActivity(
    id: number,
    updateActivityDto: UpdateActionActivityDto,
    userId: number,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: ['editableContent'],
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    if (activity.userId !== userId) {
      throw new ForbiddenException('You are not the owner of this activity');
    }
    let editableContent = await this.editableContentRepository.findOne({
      where: { id: activity.editableContent?.id },
    });
    if (!editableContent) {
      editableContent = this.editableContentRepository.create(
        updateActivityDto.editableContent,
      );
    }
    editableContent.attachments = updateActivityDto.editableContent.attachments;
    editableContent.body = updateActivityDto.editableContent.body;
    await this.editableContentRepository.save(editableContent);

    activity.editableContent = editableContent;
    await this.actionActivityRepository.save(activity);

    return this.getActivity(id);
  }

  async getPaymentAmountForAction(id: number): Promise<number> {
    const action = await this.findOne(id, undefined, true);
    if (action.type !== ActionTaskType.Funding) {
      throw new BadRequestException('Action is not a funding action');
    }
    if (!action.donationAmount) {
      throw new BadRequestException('Action has no funding amount');
    }
    return action.donationAmount;
  }

  async eventNotifData(
    actionId: number,
    type: ActionStatus,
    sendNotifsTo: NotificationType,
  ): Promise<PreEventNotifDataDto> {
    if (sendNotifsTo === NotificationType.None) {
      return {
        texts: [],
        emails: [],
        pushes: [],
      };
    }

    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: ['participatingGroups'],
    });
    if (!action) {
      throw new NotFoundException('Action not found');
    }

    const users =
      await this.actionEventRecipientService.getFilteredUsersForEvent(
        {
          newStatus: type,
          action,
          date: new Date(),
        },
        ActionEventNotifType.Announcement,
      );

    const texts = users.filter((user) =>
      this.notifsService.shouldTextUser(user),
    );
    const emails = users
      .filter((user) => this.notifsService.shouldEmailUser(user))
      .filter((user) => !texts.includes(user));

    const pushes = [];

    return {
      texts: texts.map((user) => new UserDto(user)),
      emails: emails.map((user) => new UserDto(user)),
      pushes: pushes.map((user) => new UserDto(user)),
    };
  }

  async adminCreateActivity(
    activityDto: CreateActionActivityDto,
  ): Promise<ActionActivityDto> {
    return this.createActionActivity(
      activityDto.actionId,
      activityDto.userId,
      activityDto.type,
    );
  }

  async archive(id: number): Promise<ActionDto> {
    const action = await this.actionRepository.findOneOrFail({ where: { id } });
    action.archived = true;
    return new ActionDto(await this.actionRepository.save(action));
  }

  async unarchive(id: number): Promise<ActionDto> {
    const action = await this.actionRepository.findOneOrFail({ where: { id } });
    action.archived = false;
    return new ActionDto(await this.actionRepository.save(action));
  }

  async getEventWithReminders(id: number): Promise<AdminActionEventDto> {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id },
      relations: [
        'reminders',
        'reminders.users',
        'reminders.memberActionEvent',
      ],
    });
    return new AdminActionEventDto(event);
  }

  async createActionUpdate(
    id: number,
    createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<ActionUpdate> {
    const content = this.editableContentRepository.create({
      body: createActionUpdateDto.content.body,
      attachments: createActionUpdateDto.content.attachments ?? [],
    });
    await this.editableContentRepository.save(content);
    const action = await this.actionRepository.findOneOrFail({ where: { id } });
    const actionUpdate = this.actionUpdateRepository.create({
      ...createActionUpdateDto,
      content,
      action,
    });
    return this.actionUpdateRepository.save(actionUpdate);
  }
}

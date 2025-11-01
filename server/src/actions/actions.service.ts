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
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  NotificationPlan,
} from 'src/notifs/action-event-reminder.service';
import { NotifsService } from 'src/notifs/notifs.service';
import { ILike, In, LessThan, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  ActionSuiteDto,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionSuiteDto,
  CreateActionUpdateDto,
  CreateTODReminderGroupDto,
  LatLonDto,
  PreEventNotifDataDto,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionEventDto,
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
import { Group } from 'src/user/entities/group.entity';
import { UserDto } from 'src/user/user.dto';
import { NotificationScheduleEntryDto } from './dto/notification-schedule.dto';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { User } from 'src/user/entities/user.entity';
import { ActionEventNotifType } from 'src/notifs/entities/action-event-notif.entity';
import { ActionUpdate } from './entities/action-update.entity';
import { ReminderGroup } from './entities/reminder-group.entity';
import { ActionSuite } from './entities/action-suite.entity';
import { ActionEventNotifDto } from 'src/notifs/entities/action-event-notif.dto';

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
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    private readonly notifsService: NotifsService,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly actionEventReminderService: ActionEventReminderService,
  ) {}

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const { participatingGroups, suiteId, ...rest } = createActionDto;
    const action = this.actionRepository.create(rest);

    if (suiteId) {
      const suite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: suiteId },
      });
      action.suite = suite;
    }

    if (participatingGroups && participatingGroups.length > 0) {
      action.participatingGroups =
        await this.resolveParticipatingGroups(participatingGroups);
    }

    return this.actionRepository.save(action);
  }

  findAll(): Promise<ActionDto[]> {
    return this.actionRepository
      .find({
        relations: ['events', 'activities', 'participatingGroups', 'suite'],
      })
      .then((actions) => {
        return actions.map((action) => new ActionDto(action));
      });
  }

  async getUsersJoinedForCommitmentlessAction(action: Action): Promise<number> {
    const event = action.events.find(
      (event) => event.newStatus === ActionStatus.MemberAction,
    );
    const baseUsers =
      await this.actionEventRecipientService.getBaseUsersForEvent(
        ActionStatus.MemberAction,
        action,
        event?.date ?? new Date(),
      );
    const completionActivities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        type: ActionActivityType.USER_COMPLETED,
      },
    });
    const withdrawalActivities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        type: ActionActivityType.USER_WONT_COMPLETE,
      },
    });
    const baseUsersMinusWithdrawals = baseUsers.filter(
      (user) =>
        !withdrawalActivities.some((activity) => activity.userId === user.id),
    );
    const set = new Set([
      ...baseUsersMinusWithdrawals.map((user) => user.id),
      ...completionActivities.map((activity) => activity.userId),
    ]);

    return set.size;
  }

  async findPublic(userId?: number): Promise<ActionDto[]> {
    const actions = await this.actionRepository.find({
      relations: ['events', 'participatingGroups', 'activities'],
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
      relations: [
        'events',
        'activities',
        'participatingGroups',
        'updates',
        'suite',
      ],
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
    const action = await this.findOne(actionId, userId);

    if (action.status !== ActionStatus.GatheringCommitments) {
      throw new BadRequestException(
        'You can only join an action during the gathering commitments phase',
      );
    }

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

    const { participatingGroups, suiteId, ...rest } = updateActionDto;

    if (suiteId) {
      const suite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: suiteId },
      });
      action.suite = suite;
    }

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

  async deleteReminderGroup(groupId: number) {
    return this.actionEventReminderService.deleteReminderGroup(groupId);
  }
  async getNotificationPlansForGroup(
    groupId: number,
  ): Promise<NotificationPlan[]> {
    return this.actionEventReminderService.getNotificationPlansForGroup(
      groupId,
    );
  }

  async getSentNotifsForGroup(groupId: number): Promise<ActionEventNotifDto[]> {
    return this.actionEventReminderService.getSentNotifsForGroup(groupId);
  }

  async createdTimedReminderGroup(
    eventId: number,
    dto: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    return this.actionEventReminderService.createReminderGroup(eventId, dto);
  }

  async updateReminderGroup(
    groupId: number,
    dto: CreateTODReminderGroupDto,
  ): Promise<ReminderGroup> {
    return this.actionEventReminderService.updateReminderGroup(groupId, dto);
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
      relations: ['action', 'user'],
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
      relations: ['user'],
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
      relations: ['user', 'likes'],
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

  async getReminderGroupsForEvent(id: number): Promise<ReminderGroup[]> {
    return this.actionEventReminderService.getReminderGroupsForEvent(id);
  }

  async getSuites(): Promise<ActionSuite[]> {
    return this.actionSuiteRepository.find();
  }

  async getSuite(id: number): Promise<ActionSuiteDto> {
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id },
      relations: [
        'actions',
        'actions.events',
        'reminderGroups',
        'reminderGroups.memberActionEvent',
        'reminderGroups.memberActionEvent',
        'reminderGroups.deadlineEvent',
      ],
    });
    return new ActionSuiteDto(instanceToPlain(suite) as ActionSuite);
  }

  async createSuite(
    createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuiteDto> {
    const suite = this.actionSuiteRepository.create(createActionSuiteDto);
    return this.actionSuiteRepository.save(suite);
  }

  async batchUpdateSuiteEvents(
    suiteId: number,
    eventId: number,
    body: UpdateActionEventDto,
  ) {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: ['action', 'action.events'],
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: ['actions', 'actions.events'],
    });
    const eventIdx = event.action.events.findIndex(
      (event) => event.id === eventId,
    );
    const eventsToUpdate = new Set<number>([eventId]);

    for (const action of suite.actions) {
      const possibleEvent = action.events[eventIdx];
      if (
        possibleEvent.newStatus === event.newStatus &&
        possibleEvent.suiteManaged
      ) {
        eventsToUpdate.add(possibleEvent.id);
      }
    }

    for (const id of eventsToUpdate) {
      await this.actionEventRepository.update(id, body);
    }
    return this.getSuite(suiteId);
  }

  async addSuiteEvent(suiteId: number, actionEventDto: CreateActionEventDto) {
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: ['actions'],
    });

    for (const action of suite.actions) {
      console.log('adding event to action', action.id);
      const newEvent = this.actionEventRepository.create({
        ...actionEventDto,
        action,
        suiteManaged: true,
      });
      await this.actionEventRepository.save(newEvent);
    }
    return this.getSuite(suiteId);
  }

  async deleteSuiteEvent(suiteId: number, eventId: number) {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: ['action', 'action.events'],
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: ['actions', 'actions.events'],
    });
    const eventIdx = event.action.events.findIndex(
      (event) => event.id === eventId,
    );

    for (const action of suite.actions) {
      const possibleEvent = action.events[eventIdx];
      if (
        possibleEvent.newStatus === event.newStatus &&
        possibleEvent.suiteManaged
      ) {
        console.log('deleting event', possibleEvent.id);
        await this.actionEventRepository.delete(possibleEvent.id);
      }
    }
    return this.getSuite(suiteId);
  }

  async tentativePlansForGroup(
    eventId: number,
    body: CreateTODReminderGroupDto,
  ): Promise<NotificationPlan[]> {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: ['action', 'action.events', 'action.participatingGroups'],
    });

    let group: Group | undefined = undefined;
    if (body.userGroupId) {
      group = await this.groupRepository.findOneOrFail({
        where: { id: body.userGroupId },
      });
    }

    let users: User[] = [];
    if (body.userIds) {
      users = await this.userService.findByIds(body.userIds);
    }

    const fakeGroup = {
      ...body,
      id: 0,
      name: 'Tentative Reminder Group',
      memberActionEvent: event,
      notifications: [],
      users,
      userGroup: group,
      allSent: false,
    } satisfies ReminderGroup;

    return this.actionEventReminderService.getPlansForGroup(
      await this.actionEventReminderService.attachDeadlineEvent(fakeGroup),
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + 30 * NOTIFICATION_LOOKBACK_WINDOW_MS),
    );
  }

  async getUncompletedTasksCount(userId: number): Promise<number> {
    const actions = (await this.findPublic(userId)).filter(
      (action) =>
        action.shouldParticipate &&
        action.userRelation !== UserActionRelation.Completed,
    );
    return actions.length;
  }
}

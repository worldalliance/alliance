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
import { randomBytes } from 'crypto';
import { from, Observable } from 'rxjs';
import { CommentDto, CreateCommentDto } from 'src/forum/dto/comment.dto';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { ForumService } from 'src/forum/forum.service';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
  PreviewNotificationPlan,
} from 'src/notifs/action-event-reminder.service';
import { LikeNotificationService } from 'src/notifs/like-notification.service';
import { NotifsService, shouldTextUser } from 'src/notifs/notifs.service';
import { actionActivityUrl, actionUrl, withSid } from 'src/search/approutes';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { RelationString } from 'src/tasks/entities/type';
import { FormSchema } from 'src/tasks/schema';
import {
  CommunityUserInfoDto,
  UserActionRelationDetailDto,
  UserActionRelationsForUserDto,
  UserActionRelationsResponseDto,
  UserActionRelationStatus,
  UserActionSummaryDto,
} from 'src/user/dto/user-action-relations.dto';
import { ContractEventType } from 'src/user/entities/contract-event.entity';
import { Tag } from 'src/user/entities/tag.entity';
import { User } from 'src/user/entities/user.entity';
import { ProfileDto } from 'src/user/user.dto';
import { ILike, In, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import {
  ActionActivityDto,
  ActionDto,
  ActionEventDto,
  ActionSuiteDto,
  ActionUpdateDto,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionSuiteDto,
  CreateActionUpdateDto,
  CreateReminderGroupDto,
  ExportActionDto,
  FormResponseOutputDto,
  LatLonDto,
  ReminderGroupPlanDto,
  SuspensionPlanDto,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionEventDto,
} from './dto/action.dto';
import {
  ActionActivity,
  ActionActivityType,
} from './entities/action-activity.entity';
import { ActionEvent, ActionStatus } from './entities/action-event.entity';
import { ActionShareUrl } from './entities/action-share-url.entity';
import { ActionSuite } from './entities/action-suite.entity';
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from './entities/action-update.entity';
import { Action, ActionTaskType } from './entities/action.entity';
import {
  ReminderGroup,
  ReminderGroupTimingMode,
} from './entities/reminder-group.entity';

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
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(ActionUpdate)
    private readonly actionUpdateRepository: Repository<ActionUpdate>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(ActionShareUrl)
    private readonly actionShareUrlRepository: Repository<ActionShareUrl>,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
    private readonly notifsService: NotifsService,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly likeNotificationService: LikeNotificationService,
    private readonly forumService: ForumService,
  ) {}

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const { participatingTags, suiteId, ...rest } = createActionDto;
    const action = this.actionRepository.create(rest);

    if (suiteId) {
      const suite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: suiteId },
      });
      action.suite = suite;
    }

    if (participatingTags && participatingTags.length > 0) {
      action.participatingTags =
        await this.resolveParticipatingTags(participatingTags);
    }

    return this.actionRepository.save(action);
  }

  findAll(): Promise<Action[]> {
    return this.actionRepository.find({
      relations: [
        'events',
        'activities',
        'participatingTags',
        'suite',
        'manualCohortUsers',
      ],
    });
  }

  async findAllSorted(
    relations: (keyof Omit<Action, 'usersCompleted' | 'status'>)[] = [],
    limit?: number,
  ): Promise<Action[]> {
    // Sort by:
    // 1. Soonest upcoming event (sooner first)
    // 2. Latest past member action event (later first)
    // 3. Priority (higher priority first)

    const qb = this.actionRepository
      .createQueryBuilder('a')
      .leftJoin('a.events', 'e')
      .addSelect(
        `
    MIN(CASE WHEN e.date > NOW() THEN e.date END)
  `,
        'soonest_future_event_date',
      )
      .addSelect(
        `
    MAX(CASE 
      WHEN e.newStatus = :memberAction THEN e.date 
    END)
  `,
        'latest_memberaction_event_date',
      )
      .setParameter('memberAction', ActionStatus.MemberAction)
      .groupBy('a.id')
      .orderBy(
        'CASE WHEN MIN(CASE WHEN e.date > NOW() THEN e.date END) IS NULL THEN 1 ELSE 0 END',
        'ASC',
      ) // actions with future events first
      .addOrderBy('soonest_future_event_date', 'ASC') // earliest future event first
      .addOrderBy(
        'CASE WHEN MAX(CASE WHEN e.newStatus = :memberAction THEN e.date END) IS NULL THEN 1 ELSE 0 END',
        'ASC',
      ) // actions with past member-action events next
      .addOrderBy('latest_memberaction_event_date', 'DESC') // latest member-action event first
      .addOrderBy('a.priority', 'ASC'); // higher priority first

    if (limit) {
      qb.limit(limit);
    }
    const actions = await qb.getMany();

    if (relations.length > 0) {
      const metadata = this.actionRepository.metadata;
      await Promise.all(
        actions.map(async (action) => {
          for (const rel of relations) {
            const relationMeta = metadata.relations.find(
              (r) => r.propertyName === rel,
            );

            if (!relationMeta) {
              continue;
            }

            const relationQb = this.actionRepository
              .createQueryBuilder()
              .relation(Action, rel)
              .of(action);

            let loaded: unknown;

            if (relationMeta.isOneToOne || relationMeta.isManyToOne) {
              loaded = await relationQb.loadOne();
            } else {
              loaded = await relationQb.loadMany();
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (action as any)[rel] = loaded;
          }
        }),
      );
    }

    return actions;
  }

  async reloadAllActionUsersJoined(): Promise<void> {
    const actions = await this.actionRepository.find();
    for (const action of actions) {
      await this.reloadUsersJoinedForAction(action.id);
    }
  }

  async reloadUsersJoinedForAction(actionId: number): Promise<void> {
    const action = await this.actionRepository.findOneOrFail({
      where: { id: actionId },
      relations: ['events', 'participatingTags', 'activities'],
    });

    let joined = action.usersJoined;
    if (action.commitmentless) {
      joined = await this.getUsersJoinedForCommitmentlessAction(action);
    } else {
      const activities = await this.actionActivityRepository.find({
        where: {
          actionId: action.id,
          type: In([
            ActionActivityType.USER_JOINED,
            ActionActivityType.USER_WONT_COMPLETE,
          ]),
        },
      });
      joined = Math.max(
        activities.filter(
          (activity) => activity.type === ActionActivityType.USER_JOINED,
        ).length -
          activities.filter(
            (activity) =>
              activity.type === ActionActivityType.USER_WONT_COMPLETE,
          ).length,
        0,
      );
    }
    await this.actionRepository.update(action.id, { usersJoined: joined });
  }

  async getUsersJoinedForCommitmentlessAction(action: Action): Promise<number> {
    const event = action.events.find(
      (event) => event.newStatus === ActionStatus.MemberAction,
    );
    if (!event) return 1;

    const baseUsers =
      await this.actionEventRecipientService.getBaseUsersForEvent(
        ActionStatus.MemberAction,
        action,
        event.date,
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

  async findPublic(userId?: number, sorted?: boolean): Promise<ActionDto[]> {
    const relations: (keyof Omit<Action, 'usersCompleted' | 'status'>)[] = [
      'events',
      'participatingTags',
      'activities',
      'manualCohortUsers',
    ];
    const actions = sorted
      ? await this.findAllSorted(relations)
      : await this.actionRepository.find({
          relations: relations,
        });

    const user = userId
      ? await this.userService.findOne(userId, [
          'tags',
          'awayRanges',
          'contractEvents',
        ])
      : null;

    const filtered: Action[] = [];
    for (const action of actions) {
      if ((await this.userCanSeeAction(action, user)) && !action.publicOnly) {
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
          const targetTagIds = new Set(
            (action.participatingTags || []).map((tag) => tag.id),
          );
          shouldParticipate =
            this.actionEventRecipientService.userShouldCompleteEvent(
              user,
              action.events.find(
                (event) => event.newStatus === ActionStatus.MemberAction,
              )!.date,
              targetTagIds,
              action.everyoneShouldComplete,
              action.useManualCohort,
              action.manualCohortUsers,
            );
        }

        return new ActionDto(action, {
          canParticipate: user
            ? await this.isEligibleForAction(action, user)
            : false,
          shouldParticipate: shouldParticipate,
          userRelation: user
            ? await this.getActionRelationFromActivities(
                action.activities.filter(
                  (activity) => activity.userId === user.id,
                ),
              )
            : undefined,
          reqAuthenticated: !!user,
        });
      }),
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
      !action.participatingTags?.length ||
      action.showToNonparticipating === true
    ) {
      return true;
    }
    if (!user) {
      return false;
    }

    if (!action.participatingTags?.length) {
      return false;
    }

    return user.tags.some((tag) =>
      action.participatingTags.some(
        (participatingTag) => participatingTag.id === tag.id,
      ),
    );
  }

  async findOne(
    id: number,
    userId?: number,
    serverSide = false,
  ): Promise<Action> {
    const user = userId
      ? await this.userService.findOne(userId, ['tags'])
      : null;
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: [
        'events',
        'activities',
        'participatingTags',
        'manualCohortUsers',
        'updates',
        'suite',
      ] satisfies RelationString<Action>[],
    });

    if (action?.publicOnly) {
      return instanceToPlain(action) as Action;
    }

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
      ? await this.userService.findOne(userId, ['tags'])
      : null;
    return new ActionDto(action, {
      canParticipate: user
        ? await this.isEligibleForAction(action, user)
        : false,
      userRelation: user
        ? await this.getActionRelation(action.id, user.id)
        : undefined,
      reqAuthenticated: !!user,
    });
  }

  // assumes pre-filtered for one users activities!
  async getActionRelationFromActivities(
    activities: ActionActivity[],
  ): Promise<UserActionRelation> {
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

  async getActionRelation(
    actionId: number,
    userId: number,
  ): Promise<UserActionRelation> {
    const activities = await this.actionActivityRepository.find({
      where: { action: { id: actionId }, user: { id: userId } },
    });
    return this.getActionRelationFromActivities(activities);
  }

  async createActionActivity(
    actionId: number,
    userId: number,
    type: ActionActivityType,
    taskFormResponse?: FormResponse,
    declineReason?: string,
    isMoral?: boolean,
    adminCreated?: boolean,
  ): Promise<ActionActivityDto> {
    const action = await this.findOne(actionId, userId);

    if (
      (type === ActionActivityType.USER_JOINED ||
        type === ActionActivityType.USER_COMPLETED) &&
      !adminCreated
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
      declineReason,
      isMoral,
    });
    const savedActivity = await this.actionActivityRepository.save(activity);

    const activityDto = new ActionActivityDto(savedActivity);
    this.eventEmitter.emit('action.activity', {
      actionId,
      activity: activityDto,
    });

    await this.reloadUsersJoinedForAction(actionId);

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
    return this.createActionActivity(
      actionId,
      userId,
      ActionActivityType.USER_WONT_COMPLETE,
      undefined,
      reason,
      outOfTime,
    );
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
      relations: ['participatingTags', 'manualCohortUsers'],
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    const { participatingTags, suiteId, ...rest } = updateActionDto;

    if (suiteId) {
      const suite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: suiteId },
      });
      action.suite = suite;
    }

    Object.assign(action, rest);

    if (participatingTags !== undefined) {
      action.participatingTags =
        await this.resolveParticipatingTags(participatingTags);
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

    await this.reloadUsersJoinedForAction(action.id);

    return savedEvent;
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

  async getLikedActivityIds(
    activityIds: number[],
    userId: number,
  ): Promise<Set<number>> {
    if (!activityIds.length || !userId) {
      return new Set();
    }

    const rows = await this.actionActivityRepository
      .createQueryBuilder('activity')
      .innerJoin('activity.likes', 'liker', 'liker.id = :userId', { userId })
      .where('activity.id IN (:...activityIds)', { activityIds })
      .select('activity.id', 'id')
      .getRawMany<{ id: number }>();

    return new Set(rows.map((r) => r.id));
  }

  async findCompletedForUser(
    userId: number,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: { userId, type: ActionActivityType.USER_COMPLETED },
      relations: ['action', 'user', 'taskFormResponse'],
    });

    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(
          activities.map((a) => a.id),
          requestingUserId,
        )
      : new Set<number>();

    if (comments) {
      return this.attachComments(activities, requestingUserId);
    }
    return activities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
        }),
    );
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

  buildOutputFormResponse(
    activity: ActionActivity,
  ): FormResponseOutputDto | undefined {
    if (!activity.taskFormResponse) {
      return undefined;
    }

    const schema = activity.taskFormResponse
      .schemaSnapshot as unknown as FormSchema;

    const answerToIsPublic = (
      answer: string,
      selections: Record<string, boolean>,
    ) => {
      if (selections?.[answer] === false) {
        return false;
      }
      return schema.pages.some((page) =>
        page.fields.some(
          (field) =>
            field.id === answer &&
            'label' in field &&
            field.output?.output === true,
        ),
      );
    };

    const answers = activity.taskFormResponse.answers;
    const publicAnswers = activity.taskFormResponse.publicAnswers ?? {};

    const answersPrunedObj = Object.fromEntries(
      Object.entries(answers).filter(([key]) =>
        answerToIsPublic(key, publicAnswers),
      ),
    );

    if (!Object.keys(answersPrunedObj).length) {
      return undefined;
    }

    const responseWithPruned = {
      ...activity.taskFormResponse,
      answers: answersPrunedObj,
    } as FormResponse;

    return new FormResponseOutputDto(responseWithPruned);
  }

  async getActionActivities(
    actionId: number,
    limit?: number,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.buildActivityFeedQuery({
      limit: limit ?? 20,
      actionId,
      filterFeedTypes: false,
    }).getMany();

    if (activities.length === 0) {
      return [];
    }

    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(
          activities.map((a) => a.id),
          requestingUserId,
        )
      : new Set<number>();

    if (comments) {
      return this.attachComments(activities, requestingUserId);
    }
    return activities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
        }),
    );
  }

  async attachComments(
    activities: ActionActivity[],
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(
          activities.map((a) => a.id),
          requestingUserId,
        )
      : new Set<number>();

    return Promise.all(
      activities.map(async (activity) => {
        return new ActionActivityDto(activity, {
          comments: (
            await this.forumService.findCommentsForActivity(activity.id)
          ).map((comment) => new CommentDto(comment)),
          formResponseOutput: activity.taskFormResponse
            ? this.buildOutputFormResponse(activity)
            : undefined,
          likedByMe: likedIds.has(activity.id),
        });
      }),
    );
  }

  /**
   * Shared helper to build optimized activity feed queries.
   * Only selects the fields needed for ActionActivityDto to minimize data transfer.
   */
  private buildActivityFeedQuery(options: {
    limit: number;
    before?: Date;
    userIds?: number[];
    actionId?: number;
    filterFeedTypes?: boolean;
  }) {
    const qb = this.actionActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.action', 'action')
      .leftJoinAndSelect('activity.editableContent', 'editableContent')
      .leftJoinAndSelect('activity.taskFormResponse', 'taskFormResponse')
      .select([
        'activity.id',
        'activity.type',
        'activity.actionId',
        'activity.userId',
        'activity.createdAt',
        'activity.likesCount',
        'user.id',
        'user.name',
        'user.profilePicture',
        'user.profileDescription',
        'user.admin',
        'user.staff',
        'user.anonymous',
        'action.id',
        'action.name',
        'editableContent.id',
        'editableContent.body',
        'editableContent.attachments',
        'taskFormResponse.id',
        'taskFormResponse.formId',
        'taskFormResponse.answers',
        'taskFormResponse.publicAnswers',
        'taskFormResponse.schemaSnapshot',
        'taskFormResponse.visibilityValidatorResults',
        'taskFormResponse.deviceType',
      ])
      .loadRelationIdAndMap('user.leaderOfIds', 'user.leaderOf')
      .orderBy('activity.createdAt', 'DESC')
      .take(options.limit);

    if (options.filterFeedTypes !== false) {
      qb.where('activity.type IN (:...types)', {
        types: [
          ActionActivityType.USER_JOINED,
          ActionActivityType.USER_COMPLETED,
        ],
      });
    }

    if (options.before) {
      qb.andWhere('activity.createdAt < :before', { before: options.before });
    }

    if (options.userIds?.length) {
      qb.andWhere('activity.userId IN (:...userIds)', {
        userIds: options.userIds,
      });
    }

    if (options.actionId) {
      qb.andWhere('activity.actionId = :actionId', {
        actionId: options.actionId,
      });
    }

    return qb;
  }

  async getActivityFeed(
    limit: number = 20,
    before?: Date,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.buildActivityFeedQuery({
      limit,
      before,
    }).getMany();

    if (activities.length === 0) {
      return [];
    }

    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(
          activities.map((a) => a.id),
          requestingUserId,
        )
      : new Set<number>();

    if (comments) {
      return this.attachComments(activities, requestingUserId);
    }

    return activities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
        }),
    );
  }

  private async resolveParticipatingTags(
    tags?: Array<Partial<Tag>>,
  ): Promise<Tag[]> {
    if (!tags || tags.length === 0) {
      return [];
    }

    const ids = tags
      .map((tag) => tag?.id)
      .filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));
    const found = await this.tagRepository.findBy({ id: In(uniqueIds) });

    if (found.length !== uniqueIds.length) {
      const foundIds = new Set(found.map((tag) => tag.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Tag(s) not found: ${missing.join(', ')}`);
    }

    return found;
  }

  async isIdEligibleForAction(
    actionId: number,
    userId: number,
  ): Promise<boolean> {
    const action = await this.findOne(actionId, userId);
    const user = await this.userService.findOne(userId, ['tags']);
    if (!user) {
      return false;
    }
    return this.isEligibleForAction(action, user);
  }

  async isEligibleForAction(action: Action, user: User): Promise<boolean> {
    if (action.preventCompletion) {
      return false;
    }
    if (action.useManualCohort) {
      return action.manualCohortUsers?.some((m) => m.id === user.id) ?? false;
    }
    const tags = action.participatingTags;
    const userTagIds = new Set((user.tags || []).map((tag) => tag.id));
    const isMember = tags.some((tag) => userTagIds.has(tag.id));
    return isMember;
  }

  async ensureUserEligibleForAction(action: Action, userId: number) {
    const user = await this.userService.findOne(userId, ['tags']);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (action.preventCompletion) {
      throw new ForbiddenException('This action is no longer available');
    }

    if (action.useManualCohort) {
      if (action.manualCohortUsers?.some((m) => m.id === userId)) {
        return;
      } else {
        throw new ForbiddenException('This action is not available to you');
      }
    }

    const userTagIds = new Set((user.tags || []).map((tag) => tag.id));
    const isMember = action.participatingTags.some((tag) =>
      userTagIds.has(tag.id),
    );

    if (!isMember) {
      throw new ForbiddenException(
        'This action is not available to your tags.',
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
      relations: ['action', 'user'],
    });
    return activities.map((activity) => new ActionActivityDto(activity));
  }

  async friendActivity(
    userId: number,
    comments?: boolean,
    limit?: number,
  ): Promise<ActionActivityDto[]> {
    const user = await this.userService.findOne(userId, [
      'sentFriendRequests',
      'receivedFriendRequests',
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const friends = await this.userService.findFriends(userId);

    if (friends.length === 0) {
      return [];
    }

    const friendActivities = await this.buildActivityFeedQuery({
      limit: limit ?? 20,
      userIds: friends.map((f) => f.id),
    }).getMany();

    if (friendActivities.length === 0) {
      return [];
    }

    const likedIds = await this.getLikedActivityIds(
      friendActivities.map((a) => a.id),
      userId,
    );

    if (comments) {
      return this.attachComments(friendActivities, userId);
    }

    return friendActivities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
        }),
    );
  }

  async communityActivity(
    limitNum: number = 20,
    beforeDate: Date | undefined,
    communityId: number,
    comments?: boolean,
    requestingUserId?: number,
  ) {
    const community = await this.userService.findCommunityOrFail(communityId);

    const members = community.users ?? [];

    if (members.length === 0) {
      return [];
    }

    const memberActivities = await this.buildActivityFeedQuery({
      limit: limitNum,
      before: beforeDate,
      userIds: members.map((m) => m.id),
    }).getMany();

    if (memberActivities.length === 0) {
      return [];
    }

    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(
          memberActivities.map((a) => a.id),
          requestingUserId,
        )
      : new Set<number>();

    if (comments) {
      return this.attachComments(memberActivities, requestingUserId);
    }

    return memberActivities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
        }),
    );
  }

  async findByName(name: string): Promise<Action[]> {
    const actions = await this.actionRepository.find({
      where: { name: ILike(`%${name}%`) },
      relations: ['events'],
    });
    return actions.filter((action) => action.status !== ActionStatus.Draft);
  }

  async getActivity(
    id: number,
    requestingUserId?: number,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: ['user', 'action', 'likes', 'taskFormResponse'],
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return new ActionActivityDto(activity, {
      formResponseOutput: this.buildOutputFormResponse(activity),
      includeLikes: true,
      likedByMe: requestingUserId
        ? activity.likes?.some((like) => like.id === requestingUserId)
        : undefined,
    });
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

    let createdLike = false;
    let removedLike = false;
    if (unlike) {
      if (activity.likes.some((like) => like.id === user.id)) {
        await qb.remove(user);
        removedLike = true;
      }
    } else if (!activity.likes.some((like) => like.id === user.id)) {
      await qb.add(user);
      createdLike = true;
    }

    // Update likesCount
    if (createdLike || removedLike) {
      await this.actionActivityRepository.update(id, {
        likesCount: () => `"likesCount" ${createdLike ? '+ 1' : '- 1'}`,
      });
    }

    const updatedActivity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: ['user', 'action', 'likes'],
    });
    if (!updatedActivity) {
      throw new NotFoundException('Activity not found');
    }

    if (createdLike && updatedActivity.user) {
      await this.likeNotificationService.createOrUpdate({
        owner: updatedActivity.user,
        liker: user,
        targetType: 'activity',
        targetContent: updatedActivity.action.name,
        targetId: updatedActivity.id,
        webAppLocation: actionActivityUrl(
          updatedActivity.action?.id ?? updatedActivity.actionId,
          updatedActivity.id,
        ),
        groupingKey: `activity_like:${updatedActivity.id}`,
      });
    }

    return new ActionActivityDto(updatedActivity, {
      includeLikes: true,
      likedByMe: !unlike,
    });
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
      relations: ['editableContent', 'taskFormResponse'],
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

  async adminCreateActivity(
    activityDto: CreateActionActivityDto,
  ): Promise<ActionActivityDto> {
    return this.createActionActivity(
      activityDto.actionId,
      activityDto.userId,
      activityDto.type,
      undefined,
      undefined,
      undefined,
      true,
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
  ): Promise<ActionUpdateDto> {
    const content = this.editableContentRepository.create({
      body: createActionUpdateDto.content.body,
      attachments: createActionUpdateDto.content.attachments ?? [],
    });
    await this.editableContentRepository.save(content);
    const action = await this.actionRepository.findOneOrFail({
      where: { id },
      relations: ['participatingTags'],
    });

    let tag: Tag | undefined = undefined;
    if (createActionUpdateDto.tagId) {
      tag = await this.tagRepository.findOneOrFail({
        where: { id: createActionUpdateDto.tagId },
      });
    }

    let associatedEvent: ActionEvent | undefined = undefined;
    if (createActionUpdateDto.associatedEventId) {
      associatedEvent = await this.actionEventRepository.findOneOrFail({
        where: { id: createActionUpdateDto.associatedEventId },
      });
    }

    const actionUpdate = await this.actionUpdateRepository.save(
      this.actionUpdateRepository.create({
        ...createActionUpdateDto,
        content,
        action,
        tag,
        associatedEvent,
      }),
    );

    if (createActionUpdateDto.notifyType !== ActionUpdateNotifyType.None) {
      await this.generateNotifsForActionUpdate(actionUpdate);
    }

    return new ActionUpdateDto(actionUpdate);
  }

  async deleteActionUpdate(id: number) {
    const actionUpdate = await this.actionUpdateRepository.findOneOrFail({
      where: { id },
    });
    await this.actionUpdateRepository.delete(id);
    return actionUpdate;
  }

  async getAllActionUpdates(limit?: number): Promise<ActionUpdateDto[]> {
    const actionUpdates = await this.actionUpdateRepository.find({
      take: limit,
      relations: ['action'],
      select: {
        action: {
          name: true,
        },
      },
    });

    return actionUpdates.map(
      (actionUpdate) => new ActionUpdateDto(actionUpdate),
    );
  }

  async generateNotifsForActionUpdate(actionUpdate: ActionUpdate) {
    let users: User[] = [];
    if (actionUpdate.notifyType === ActionUpdateNotifyType.ActionCohort) {
      users = await this.userService.findAll();
    } else if (actionUpdate.notifyType === ActionUpdateNotifyType.Tag) {
      if (!actionUpdate.tag) {
        throw new BadRequestException('Tag is required');
      }
      users = (await this.userService.findTagOrFail(actionUpdate.tag.id)).users;
    } else if (actionUpdate.notifyType === ActionUpdateNotifyType.AllMembers) {
      users = await this.userService.findAllUsers();
    }

    for (const user of users) {
      await this.notifsService.createActionUpdateNotif(actionUpdate, user);
    }
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
        'actions.participatingTags',
        'actions.activities',
      ],
    });

    return new ActionSuiteDto(
      instanceToPlain(suite) as ActionSuite,
      suite.actions.map((action) => new ActionDto(action)),
    );
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
      if (action.events.length <= eventIdx) {
        throw new BadRequestException(
          'Events do not have equivalent events to edit',
        );
      }
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

      await this.reloadUsersJoinedForAction(action.id);
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
      if (action.events.length <= eventIdx) {
        throw new BadRequestException(
          'Events do not have equivalent events to delete',
        );
      }
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
    body: CreateReminderGroupDto,
  ): Promise<PreviewNotificationPlan[]> {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: [
        'action',
        'action.events',
        'action.participatingTags',
        'action.manualCohortUsers',
      ],
    });

    let tag: Tag | undefined = undefined;
    if (body.userTagId) {
      tag = await this.tagRepository.findOneOrFail({
        where: { id: body.userTagId },
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
      userTag: tag,
      allSent: false,
    } satisfies ReminderGroup;

    const withDeadlineEvent =
      await this.actionEventReminderService.attachDeadlineEvent(fakeGroup);

    if (
      fakeGroup.timingMode === ReminderGroupTimingMode.FromDeadline ||
      fakeGroup.timingMode === ReminderGroupTimingMode.WithinRelativeRange
    ) {
      if (!withDeadlineEvent.deadlineEvent) {
        throw new BadRequestException(
          'Deadline event is required for relative timing modes',
        );
      }
    }
    if (fakeGroup.timingMode === ReminderGroupTimingMode.WithinRange) {
      if (
        fakeGroup.send_range_start &&
        fakeGroup.send_range_end &&
        new Date(fakeGroup.send_range_start).getTime() >
          new Date(fakeGroup.send_range_end).getTime()
      ) {
        throw new BadRequestException(
          'Send range start must be before the end',
        );
      }
    }

    const plans = await this.actionEventReminderService.getPlansForGroup(
      withDeadlineEvent,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    );

    return plans.map((plan) => ({
      ...plan,
      channel: shouldTextUser(plan.user) ? 'text' : 'email',
    }));
  }

  async getUncompletedTasks(
    userId: number,
    suiteId?: number,
  ): Promise<ActionDto[]> {
    const actions = (await this.findPublic(userId)).filter(
      (action) =>
        action.shouldParticipate &&
        action.userRelation !== UserActionRelation.Completed,
    );
    if (!suiteId) {
      return actions;
    }

    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: ['actions'],
    });

    return actions.filter((action) =>
      suite.actions.some((a) => a.id === action.id),
    );
  }

  async exportAction(
    id: number,
    events?: boolean,
    reminders?: boolean,
    taskForm?: boolean,
    suite?: boolean,
  ): Promise<ExportActionDto> {
    const relations = [
      'participatingTags',
      ...(events ? ['events'] : []),
      ...(suite ? ['suite'] : []),
    ];
    const action = await this.actionRepository.findOneOrFail({
      where: { id },
      relations,
    });

    const actionWithExtras: ExportActionDto = {
      ...action,
      taskForm: taskForm
        ? await this.formRepository.findOneOrFail({
            where: { id: action.taskFormId },
          })
        : undefined,
      reminderGroups: reminders
        ? await this.actionEventReminderService.getReminderGroupsForEvent(
            action.id,
          )
        : undefined,
    };

    return actionWithExtras;
  }

  async importAction(json: string): Promise<ActionDto> {
    const importaction = JSON.parse(json) as ExportActionDto;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { taskForm, reminderGroups, ...action } = importaction;

    if (action.suite) {
      const suite = await this.actionSuiteRepository.findOne({
        where: { name: action.suite.name },
      });
      if (suite) {
        action.suite = suite;
      } else {
        const newSuite = this.actionSuiteRepository.create({
          name: action.suite.name,
        });
        await this.actionSuiteRepository.save(newSuite);
        action.suite = newSuite;
      }
    }

    if (taskForm) {
      const newTaskForm = this.formRepository.create({
        ...taskForm,
        id: undefined,
      });
      await this.formRepository.save(newTaskForm);
      action.taskFormId = newTaskForm.id;
    }

    if (action.events) {
      const newEvents: ActionEvent[] = [];
      for (const event of action.events) {
        const newEvent = this.actionEventRepository.create({
          ...event,
          id: undefined,
          action: undefined,
        });
        newEvents.push(newEvent);
      }
      await this.actionEventRepository.save(newEvents);
      action.events = newEvents;
    }

    if (action.participatingTags) {
      const existingTags: Tag[] = [];
      for (const tag of action.participatingTags) {
        const found = await this.tagRepository.findOne({
          where: {
            id: tag.id,
          },
        });
        if (found) {
          existingTags.push(found);
        }
      }
      action.participatingTags = existingTags;
    }

    const newAction = this.actionRepository.create({
      ...action,
      id: undefined,
    });
    await this.actionRepository.save(newAction);

    return new ActionDto(newAction);
  }

  // TODO move ==================================

  async getUserActionRelations(): Promise<UserActionRelationsResponseDto> {
    const users = await this.userService.getAllUserIds();
    return this.getActionRelationsForUsers(users);
  }

  async getActionRelationsForUsers(
    userIds: number[],
    actionLimit: number = 8,
  ): Promise<UserActionRelationsResponseDto> {
    const actions = (await this.findAllSorted(['events'], actionLimit)).filter(
      (action) => action.status !== ActionStatus.Draft,
    );

    const now = new Date();
    const memberActionPhaseEnded = new Map<number, boolean>();

    for (const action of actions) {
      const pastEvents = (action.events ?? [])
        .filter((event) => event.date <= now)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const memberActionIndex = pastEvents.findIndex(
        (event) => event.newStatus === ActionStatus.MemberAction,
      );
      memberActionPhaseEnded.set(
        action.id,
        memberActionIndex !== -1 && memberActionIndex < pastEvents.length - 1,
      );
    }

    const actionSummaries: UserActionSummaryDto[] = actions.map((action) => ({
      id: action.id,
      name: action.name,
      status: action.status,
    }));

    const actionIds = actionSummaries.map((summary) => summary.id);
    const actionOrder = new Map(actionIds.map((id, index) => [id, index]));

    const activities = await this.actionActivityRepository.find({
      where: { actionId: In(actionIds), userId: In(userIds) },
      select: ['actionId', 'userId', 'type', 'createdAt'],
      order: { createdAt: 'ASC' },
    });

    const statusPriority: Record<UserActionRelationStatus, number> = {
      [UserActionRelationStatus.Completed]: 5,
      [UserActionRelationStatus.WontComplete]: 4,
      [UserActionRelationStatus.Declined]: 3,
      [UserActionRelationStatus.MissedDeadline]: 2,
      [UserActionRelationStatus.Joined]: 1,
      [UserActionRelationStatus.None]: 0,
    };

    const typeToStatus = (
      type: ActionActivityType,
    ): UserActionRelationStatus => {
      switch (type) {
        case ActionActivityType.USER_COMPLETED:
          return UserActionRelationStatus.Completed;
        case ActionActivityType.USER_WONT_COMPLETE:
          return UserActionRelationStatus.WontComplete;
        case ActionActivityType.USER_DECLINED:
          return UserActionRelationStatus.Declined;
        case ActionActivityType.USER_JOINED:
          return UserActionRelationStatus.Joined;
        default:
          return UserActionRelationStatus.None;
      }
    };

    const perUser = new Map<
      number,
      Map<
        number,
        {
          status: UserActionRelationStatus;
          priority: number;
          latestActivityType?: ActionActivityType;
          latestActivityAt?: Date;
        }
      >
    >();

    for (const activity of activities) {
      const status = typeToStatus(activity.type);
      if (status === UserActionRelationStatus.None) {
        continue;
      }

      const userRelations = perUser.get(activity.userId) ?? new Map();
      const existing = userRelations.get(activity.actionId);
      const priority = statusPriority[status];

      if (!existing || priority >= existing.priority) {
        userRelations.set(activity.actionId, {
          status,
          priority,
          latestActivityType: activity.type,
          latestActivityAt: activity.createdAt,
        });
      }

      perUser.set(activity.userId, userRelations);
    }

    for (const [, actionMap] of perUser) {
      for (const [actionId, detail] of actionMap) {
        if (
          detail.status === UserActionRelationStatus.Joined &&
          memberActionPhaseEnded.get(actionId)
        ) {
          detail.status = UserActionRelationStatus.MissedDeadline;
          detail.priority =
            statusPriority[UserActionRelationStatus.MissedDeadline];
        }
      }
    }

    const users: UserActionRelationsForUserDto[] = Array.from(
      perUser.entries(),
    ).map(([userId, actionMap]) => {
      const relations: UserActionRelationDetailDto[] = Array.from(
        actionMap.entries(),
      )
        .map(([actionId, detail]) => ({
          actionId,
          status: detail.status,
          latestActivityType: detail.latestActivityType,
          latestActivityAt: detail.latestActivityAt?.toISOString(),
        }))
        .sort(
          (a, b) =>
            (actionOrder.get(a.actionId) ?? 0) -
            (actionOrder.get(b.actionId) ?? 0),
        );

      return {
        userId,
        relations,
      } satisfies UserActionRelationsForUserDto;
    });

    return {
      actions: actionSummaries,
      users,
    };
  }

  async getMemberInfo(userId: number): Promise<CommunityUserInfoDto> {
    const userIds = await this.userService.getUserIdsForUserCommunity(userId);
    const actionRelations = await this.getActionRelationsForUsers(userIds);

    return {
      actions: actionRelations.actions,
      users: actionRelations.users,
    };
  }

  async getFailedUsersForEvent(
    action: Action,
    event: ActionEvent,
  ): Promise<User[]> {
    const baseUsers =
      await this.actionEventRecipientService.getBaseUsersForEvent(
        ActionStatus.MemberAction,
        action,
        event.date,
      );

    const completionActivities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        type: In([
          ActionActivityType.USER_COMPLETED,
          ActionActivityType.USER_WONT_COMPLETE,
          ActionActivityType.USER_DECLINED,
        ]),
      },
    });

    const didntComplete = baseUsers.filter(
      (user) =>
        !completionActivities.some((activity) => activity.userId === user.id),
    );
    return didntComplete;
  }

  async getNextEvent(action: Action): Promise<ActionEvent | null> {
    const memberActionIndex = action.events.findIndex(
      (event) => event.newStatus === ActionStatus.MemberAction,
    );
    if (memberActionIndex === -1) {
      return null;
    }
    return action.events[memberActionIndex + 1];
  }

  isActionPast(action: Action, now: Date): boolean {
    return (
      action.events.some(
        (event) =>
          event.newStatus === ActionStatus.MemberAction && event.date < now,
      ) && action.status !== ActionStatus.MemberAction
    );
  }

  async findUsersToSuspend(now: Date) {
    const actions = await this.findAllSorted([
      'events',
      'suite',
      'participatingTags',
    ]);

    const suiteMap = new Map<
      number,
      {
        suite: ActionSuite;
        actions: Action[];
        orderIndex: number;
      }
    >();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action.suite) continue;

      const suiteId = action.suite.id;
      if (!suiteMap.has(suiteId)) {
        suiteMap.set(suiteId, {
          suite: action.suite,
          actions: [],
          orderIndex: i,
        });
      }
      suiteMap.get(suiteId)!.actions.push(action);
    }

    const orderedSuites = Array.from(suiteMap.values()).sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const pastSuites = orderedSuites.filter(({ actions }) =>
      actions.every((action) => this.isActionPast(action, now)),
    );

    const failedUsersForSuites = new Map<number, number[]>();

    const idToUser = new Map<number, User>();

    const getLastSignedDate = (user: User) => {
      return (
        user.contractEvents
          ?.filter((event) => event.type === ContractEventType.SIGNED)
          .sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date ??
        new Date(0)
      );
    };

    for (const suite of pastSuites) {
      for (const action of suite.actions) {
        const event = action.events.find(
          (event) => event.newStatus === ActionStatus.MemberAction,
        );
        if (!event) {
          continue;
        }
        const failed = await this.getFailedUsersForEvent(action, event);
        const failedAndActive = failed.filter((user) => user.hasActiveContract);

        const signedBeforeFailed = failedAndActive.filter(
          (user) => getLastSignedDate(user) < event.date,
        );
        for (const user of signedBeforeFailed) {
          idToUser.set(user.id, user);
        }

        if (failedUsersForSuites.has(suite.suite.id)) {
          failedUsersForSuites
            .get(suite.suite.id)!
            .push(...signedBeforeFailed.map((user) => user.id));
        } else {
          failedUsersForSuites.set(
            suite.suite.id,
            signedBeforeFailed.map((user) => user.id),
          );
        }
      }
    }
    const usersToSuspend = new Set<number>();
    const suspendReasonKeys = new Map<number, string>();

    for (let i = 2; i < pastSuites.length; i++) {
      const failedThis = failedUsersForSuites.get(pastSuites[i].suite.id);
      const failedPrevious = failedUsersForSuites.get(
        pastSuites[i - 1].suite.id,
      );
      const failedPreviousPrevious = failedUsersForSuites.get(
        pastSuites[i - 2].suite.id,
      );
      if (!failedPrevious || !failedThis || !failedPreviousPrevious) {
        continue;
      }
      const failedAll = failedThis
        .filter((userId) => failedPrevious.includes(userId))
        .filter((userId) => failedPreviousPrevious.includes(userId));

      for (const userId of failedAll) {
        usersToSuspend.add(userId);
        suspendReasonKeys.set(
          userId,
          `s-${pastSuites[i].suite.id}-${pastSuites[i - 1].suite.id}-${pastSuites[i - 2].suite.id}`,
        );
      }
    }
    return {
      usersToSuspend: Array.from(usersToSuspend).map(
        (userId) => idToUser.get(userId)!,
      ),
      suspendReasonKeys,
    };
  }

  async getSuspendPlans(
    rangeStart: Date,
    rangeEnd: Date,
    stepHours: number = 1,
  ): Promise<SuspensionPlanDto[]> {
    const plans: SuspensionPlanDto[] = [];
    let date = rangeStart;
    const suspendedUsers = new Set<number>();
    while (new Date(date).getTime() <= new Date(rangeEnd).getTime()) {
      const { usersToSuspend } = await this.findUsersToSuspend(date);
      const notAlreadySuspended = usersToSuspend.filter(
        (user) => !suspendedUsers.has(user.id),
      );
      if (notAlreadySuspended.length > 0) {
        for (const user of notAlreadySuspended) {
          suspendedUsers.add(user.id);
        }
        plans.push({
          date,
          users: notAlreadySuspended.map((user) => new ProfileDto(user)),
        });
      }
      date = new Date(new Date(date).getTime() + stepHours * 60 * 60 * 1000);
    }
    return plans;
  }

  async getReminderPlansOverview(): Promise<ReminderGroupPlanDto[]> {
    return [];
  }

  private generateCIDForShareUrl() {
    return 'share-' + randomBytes(5).toString('hex');
  }

  async getShareLink(actionId: number, userId: number): Promise<string> {
    const sid = this.generateCIDForShareUrl();
    const url = withSid(actionUrl(actionId, true), sid);

    const shareUrl = await this.actionShareUrlRepository.create({
      url,
      user: { id: userId },
      action: { id: actionId },
      data: {
        sid,
      },
    });

    await this.actionShareUrlRepository.save(shareUrl);
    return shareUrl.url;
  }
}

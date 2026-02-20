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
import { EditableContentDto } from 'src/forum/dto/editablecontent.dto';
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
  POST_MEMBER_ACTION_STATUSES,
  PreviewNotificationPlan,
} from 'src/notifs/action-event-reminder.service';
import { LikeNotificationService } from 'src/notifs/like-notification.service';
import { NotifsService, shouldTextUser } from 'src/notifs/notifs.service';
import { actionActivityUrl, actionUrl, withSid } from 'src/search/approutes';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { FormSchema } from 'src/tasks/schema';
import {
  ActionSuiteSummaryDto,
  CommunityUserInfoDto,
  UserActionRelationDetailDto,
  UserActionRelationsForUserDto,
  UserActionRelationsResponseDto,
  UserActionRelationPillStatus,
  UserActionSummaryDto,
} from 'src/user/dto/user-action-relations.dto';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { Tag } from 'src/user/entities/tag.entity';
import { User } from 'src/user/entities/user.entity';
import { ProfileDto } from 'src/user/dto/user.dto';
import {
  ILike,
  In,
  IsNull,
  LessThan,
  MoreThan,
  Or,
  type Repository,
} from 'typeorm';
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
  GlobalFeedActionUpdateDto,
  GlobalFeedActivityGroupDto,
  GlobalFeedForumCommentsDto,
  GlobalFeedItemDto,
  GlobalFeedItemType,
  GlobalFeedNewMembersDto,
  LatLonDto,
  ReminderGroupPlanDto,
  SetPriorityDto,
  SuspensionPlanDto,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionEventDto,
  UserActionRelation,
} from './dto/action.dto';
import { Post } from 'src/forum/entities/post.entity';
import {
  ActionActivity,
  ActionActivityType,
  ActivitySource,
} from './entities/action-activity.entity';
import { ActionEvent, ActionStatus } from './entities/action-event.entity';
import { ActionShareUrl } from './entities/action-share-url.entity';
import { ActionSuite } from './entities/action-suite.entity';
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from './entities/action-update.entity';
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from './entities/action.entity';
import {
  ReminderGroup,
  ReminderGroupTimingMode,
} from './entities/reminder-group.entity';
import { ShareUrlDto, ShareUrlStatsDto } from './dto/share-url.dto';
import type { Relations } from 'src/utils/Repository';
import { run } from 'src/utils/promise';
import { CachedFilter } from 'src/utils/cached-filter';
import { findLeast } from 'src/utils/filter';
import {
  computeIsAwayDuringAnyOfLastMemberAction,
  computeIsTaggedOrInManualCohort,
  computeIsTaggedOrInManualCohortAction,
} from 'src/utils/action-user';
import { computeIsAwayInRange } from 'src/utils/user';
import { CommunityService } from 'src/community/community.service';
import { GeneralUpdate } from './entities/general-update.entity';
import { GeneralUpdateActivity } from './entities/general-update-activity.entity';
import { GeneralUpdateActivityType } from './entities/general-update-activity.entity';
import {
  CreateGeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from './dto/general-update.dto';
import { startDatePriorityComparator } from 'src/utils/general-update';

const MS_IN_WEEK = 7 * 24 * 60 * 60 * 1000;

type SuspendPlanContext = {
  orderedSuites: Array<{ suiteId: number; pastDate: Date | null }>;
  expectedBySuite: Map<number, Set<number>>;
  failedBySuite: Map<number, Set<number>>;
  idToUser: Map<number, User>;
  allExpectedUsers: number[];
};

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
    @InjectRepository(GeneralUpdate)
    private readonly generalUpdateRepository: Repository<GeneralUpdate>,
    @InjectRepository(GeneralUpdateActivity)
    private readonly generalUpdateActivityRepository: Repository<GeneralUpdateActivity>,
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
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
    private readonly communityService: CommunityService,
    private readonly notifsService: NotifsService,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly likeNotificationService: LikeNotificationService,
    private readonly forumService: ForumService,
  ) {}

  async shiftPrioritiesAfterInsertion(): Promise<void> {
    await this.actionRepository.manager.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Action)
        .set({ priority: () => 'priority + 1' })
        .where('priority >= :min', { min: 0 })
        .execute();
      await manager
        .createQueryBuilder()
        .update(GeneralUpdate)
        .set({ priority: () => 'priority + 1' })
        .where('priority >= :min', { min: 0 })
        .execute();
    });
  }

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const { participatingTags, suiteId, authorIds, ...rest } = createActionDto;
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

    if (authorIds !== undefined) {
      action.authors = authorIds.length
        ? await this.userService.findByIds(authorIds)
        : [];
    }

    const saved = await this.actionRepository.save(action);
    await this.shiftPrioritiesAfterInsertion();
    await this.syncGeneralUpdateDatesForSuites([saved.suite?.id]);
    return saved;
  }

  findAll(): Promise<Action[]> {
    return this.actionRepository.find({
      relations: {
        events: true,
        activities: true,
        participatingTags: true,
        suite: true,
      },
    });
  }

  async findAllSorted(
    relations:
      | Omit<Relations<Action>, 'usersCompleted' | 'status'>
      | undefined = undefined,
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
    const sortedActions = await qb.getMany();

    if (!relations || sortedActions.length === 0) {
      return sortedActions;
    }

    const actionIds = sortedActions.map((a) => a.id);
    const actionsWithRelations = await this.actionRepository.find({
      where: { id: In(actionIds) },
      relations,
    });

    const actionMap = new Map(actionsWithRelations.map((a) => [a.id, a]));
    return actionIds.map((id) => actionMap.get(id)!);
  }

  async findUsersCompletedForAction(actionId: number): Promise<number> {
    return this.actionActivityRepository.count({
      where: {
        actionId,
        type: ActionActivityType.USER_COMPLETED,
      },
    });
  }

  async reloadUsersCompletedForAction(actionId: number): Promise<void> {
    const usersCompleted = await this.findUsersCompletedForAction(actionId);
    await this.actionRepository.update(actionId, { usersCompleted });
  }

  async reloadAllActionUsersCompleted(): Promise<void> {
    const actions = await this.actionRepository.find();
    for (const action of actions) {
      await this.reloadUsersCompletedForAction(action.id);
    }
  }

  async reloadAllActionUsersJoined(): Promise<void> {
    const actions = await this.actionRepository.find();
    for (const action of actions) {
      await this.reloadUsersJoinedForAction(action.id);
    }
  }

  async reloadUsersJoinedForAction(actionId: number): Promise<void> {
    const usersJoined = (await this.findUsersJoinedForActionById(actionId))
      .length;
    await this.actionRepository.update(actionId, { usersJoined });
  }

  async findUsersJoinedForActionById(actionId: number): Promise<number[]> {
    const action = await this.actionRepository.findOneOrFail({
      where: { id: actionId },
      relations: {
        events: true,
        participatingTags: true,
        activities: true,
      },
    });

    return this.findUsersJoinedForAction(action);
  }

  async findUsersJoinedForAction(action: Action): Promise<number[]> {
    return action.commitmentless
      ? this.findUsersJoinedForCommitmentlessAction(action)
      : this.findUsersJoinedForCommitmentfulAction(action);
  }

  async findUsersJoinedForCommitmentfulAction(
    action: Action,
  ): Promise<number[]> {
    const activities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        type: In([
          ActionActivityType.USER_JOINED,
          ActionActivityType.USER_WONT_COMPLETE,
        ]),
      },
    });

    const userIds: Set<number> = new Set(
      activities
        .filter((activity) => activity.type === ActionActivityType.USER_JOINED)
        .map((activity) => activity.userId),
    );
    for (const activity of activities.filter(
      (activity) => activity.type === ActionActivityType.USER_WONT_COMPLETE,
    )) {
      userIds.delete(activity.userId);
    }
    return Array.from(userIds);
  }

  async findUsersJoinedForCommitmentlessAction(
    action: Action,
  ): Promise<number[]> {
    const event = action.events.find(
      (event) => event.newStatus === ActionStatus.MemberAction,
    );
    if (!event) return [];

    const baseUsers =
      await this.actionEventRecipientService.findBaseUsersForEvent({
        eventId: event.id,
        eventStatus: ActionStatus.MemberAction,
        action,
        includeDismissed: true,
      });

    const deadlineEvents = await this.actionEventRepository.find({
      where: {
        action: { id: action.id },
        date: MoreThan(event.date),
        newStatus: In(Array.from(POST_MEMBER_ACTION_STATUSES)),
      },
      order: {
        date: 'ASC',
      },
      take: 1,
    });
    const notAwayForDeadline =
      deadlineEvents.length > 0
        ? baseUsers.filter((user) => !user.isAwayAt(deadlineEvents[0].date))
        : baseUsers;

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
    const notAwayUsersMinusWithdrawals = notAwayForDeadline.filter(
      (user) =>
        !withdrawalActivities.some((activity) => activity.userId === user.id),
    );
    const set = new Set([
      ...notAwayUsersMinusWithdrawals.map((user) => user.id),
      ...completionActivities.map((activity) => activity.userId),
    ]);

    return Array.from(set);
  }

  async findIncompleteUsersForAction(actionId: number): Promise<User[]> {
    const action = await this.actionRepository.findOneOrFail({
      where: { id: actionId },
      relations: {
        events: true,
        participatingTags: true,
        activities: true,
      },
    });

    const joinedUserIds = await this.findUsersJoinedForAction(action);

    const completedActivities = await this.actionActivityRepository.find({
      where: {
        actionId,
        type: ActionActivityType.USER_COMPLETED,
      },
      select: { userId: true },
    });
    const completedUserIds = new Set(completedActivities.map((a) => a.userId));

    const incompleteUserIds = joinedUserIds.filter(
      (id) => !completedUserIds.has(id),
    );

    if (incompleteUserIds.length === 0) {
      return [];
    }

    return this.userService.findByIds(incompleteUserIds);
  }

  async findPublic(userId?: number, sorted?: boolean): Promise<ActionDto[]> {
    const relations: Omit<Relations<Action>, 'usersCompleted' | 'status'> = {
      events: true,
      participatingTags: true,
    };
    const actions = sorted
      ? await this.findAllSorted(relations)
      : await this.actionRepository.find({
          relations,
        });

    const user = userId
      ? await this.userService.findOne(userId, {
          tags: true,
          awayRanges: true,
          contractEvents: true,
          activities: true,
        })
      : null;

    const filtered: Action[] = [];
    for (const action of actions) {
      if ((await this.userCanSeeAction(action, user)) && !action.publicOnly) {
        filtered.push(action);
      }
    }

    const actionsDismissed = new Set(
      (
        await this.actionActivityRepository.find({
          where: {
            user: { id: userId },
            type: ActionActivityType.USER_DISMISSED,
            action: { id: In(filtered.map((action) => action.id)) },
          },
        })
      ).map((activity) => activity.actionId),
    );

    return await Promise.all(
      filtered.map(async (action) => {
        const shouldParticipate =
          !!user &&
          action.events.some(
            (event) => event.newStatus === ActionStatus.MemberAction,
          ) &&
          !actionsDismissed.has(action.id) &&
          computeIsTaggedOrInManualCohortAction({
            action,
            user,
            includeSuspended: false,
          });

        return new ActionDto(action, {
          canParticipate: user
            ? await this.isEligibleForAction(action, user)
            : false,
          shouldParticipate: shouldParticipate,
          userRelation: user
            ? await this.getActionRelationFromActivities(
                user.activities!.filter(
                  (activity) => activity.actionId === action.id,
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
      action.visibilityMode === VisibilityMode.Public
    ) {
      return true;
    }

    if (!user) {
      return false;
    }
    if (action.visibilityMode === VisibilityMode.AllMembers) {
      return true;
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
      ? await this.userService.findOne(userId, {
          tags: true,
          contractEvents: true,
        })
      : null;
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: {
        events: true,
        activities: true,
        participatingTags: true,
        updates: true,
        suite: true,
        authors: true,
      },
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
      ? await this.userService.findOne(userId, {
          tags: true,
          contractEvents: true,
        })
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

  async findAllGeneralUpdates(): Promise<GeneralUpdate[]> {
    const now = new Date();
    return (
      await this.generalUpdateRepository.find({
        where: {
          startDate: LessThan(now),
        },
      })
    ).sort(startDatePriorityComparator);
  }

  async findAllGeneralUpdatesAdmin(): Promise<GeneralUpdate[]> {
    return (
      await this.generalUpdateRepository.find({
        relations: { tags: true, suites: true },
      })
    ).sort(startDatePriorityComparator);
  }

  async findOneGeneralUpdate(id: number): Promise<GeneralUpdate> {
    return await this.generalUpdateRepository.findOneOrFail({
      where: { id },
      relations: { tags: true, suites: true },
    });
  }

  async createGeneralUpdate(
    dto: CreateGeneralUpdateDto,
  ): Promise<GeneralUpdate> {
    const { tagIds, suiteIds, ...rest } = dto;
    const generalUpdate = this.generalUpdateRepository.create({
      ...rest,
      schema: {},
    });

    if (tagIds && tagIds.length > 0) {
      generalUpdate.tags = await this.tagRepository.findBy({
        id: In(tagIds),
      });
    }

    if (suiteIds && suiteIds.length > 0) {
      generalUpdate.suites = await this.actionSuiteRepository.findBy({
        id: In(suiteIds),
      });
    }

    const saved = await this.generalUpdateRepository.save(generalUpdate);

    await this.shiftPrioritiesAfterInsertion();
    if (generalUpdate.suites) {
      await this.syncGeneralUpdateDatesForSuites(
        generalUpdate.suites.map((suite) => suite.id),
      );
    }

    return saved;
  }

  async updateGeneralUpdate(
    id: number,
    dto: UpdateGeneralUpdateDto,
  ): Promise<GeneralUpdate> {
    const generalUpdate = await this.findOneGeneralUpdate(id);
    const { tagIds, suiteIds, ...rest } = dto;

    Object.assign(generalUpdate, rest);

    if (tagIds !== undefined) {
      generalUpdate.tags =
        tagIds.length > 0
          ? await this.tagRepository.findBy({ id: In(tagIds) })
          : [];
    }

    if (suiteIds !== undefined) {
      generalUpdate.suites =
        suiteIds.length > 0
          ? await this.actionSuiteRepository.findBy({ id: In(suiteIds) })
          : [];
    }

    const update = await this.generalUpdateRepository.save(generalUpdate);

    if (generalUpdate.suites) {
      await this.syncGeneralUpdateDatesForSuites(
        generalUpdate.suites.map((suite) => suite.id),
      );
    }

    return update;
  }

  async setPriorityOrder(dto: SetPriorityDto): Promise<void> {
    await Promise.all([
      ...dto.actionPriorities.map((actionPriority) =>
        this.actionRepository.update(actionPriority.id, {
          priority: actionPriority.priority,
        }),
      ),
      ...dto.generalUpdatePriorities.map((generalUpdatePriority) =>
        this.generalUpdateRepository.update(generalUpdatePriority.id, {
          priority: generalUpdatePriority.priority,
        }),
      ),
    ]);
  }

  async deleteGeneralUpdate(id: number): Promise<void> {
    await this.generalUpdateRepository.delete(id);
  }

  async syncGeneralUpdateDatesForSuites(
    suiteIds: (number | null | undefined)[],
  ): Promise<void> {
    suiteIds = suiteIds.filter(
      (id): id is number => id != null && id != undefined,
    );
    if (suiteIds.length === 0) {
      return;
    }

    const generalUpdates = await this.generalUpdateRepository.find({
      where: {
        suites: {
          id: In(suiteIds),
        },
      },
      relations: {
        suites: {
          actions: { events: true },
        },
      },
    });

    for (const generalUpdate of generalUpdates) {
      if (generalUpdate.suites!.length === 0) {
        continue;
      }

      const action = generalUpdate.suites![0]?.actions![0];
      if (!action) {
        continue;
      }

      generalUpdate.startDate = action.latestMemberActionEvent.event?.date;
      generalUpdate.endDate =
        action.latestMemberActionEvent.deadline ?? undefined;
    }
    await this.generalUpdateRepository.save(generalUpdates);
  }

  async findUnreadGeneralUpdates(params: {
    userId: number;
    now: Date;
    allowExpired: boolean;
  }): Promise<GeneralUpdate[]> {
    const { userId, now, allowExpired } = params;

    const updates = await this.generalUpdateRepository.find({
      where: {
        startDate: LessThan(now),
        ...(!allowExpired && { endDate: Or(IsNull(), MoreThan(now)) }),
      },
      relations: {
        activities: true,
        tags: true,
      },
    });
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      contractEvents: true,
    });

    return updates
      .filter((update) => {
        if (
          update.activities!.some(
            (activity) =>
              activity.type === GeneralUpdateActivityType.DISMISSED &&
              activity.userId === userId,
          )
        ) {
          return false;
        }
        return computeIsTaggedOrInManualCohort({
          user,
          useManualCohort: update.useManualCohort,
          manualCohortUserIdSet: new Set(update.manualCohortUserIds),
          participatingTagIdSet: new Set(update.tags.map((tag) => tag.id)),
          everyoneShouldComplete: false,
          latestMemberActionEventDate: update.startDate,
          latestMemberActionEventDeadline: update.endDate,
          includeSuspended: false,
        });
      })
      .sort(startDatePriorityComparator);
  }

  async dismissGeneralUpdate(
    userId: number,
    generalUpdateId: number,
  ): Promise<void> {
    const generalUpdates = await this.findUnreadGeneralUpdates({
      userId,
      now: new Date(),
      allowExpired: true,
    });
    const generalUpdate = generalUpdates.find(
      (update) => update.id === generalUpdateId,
    );
    if (!generalUpdate) {
      throw new NotFoundException(
        'General update not found or already dismissed',
      );
    }

    await this.generalUpdateActivityRepository.save(
      this.generalUpdateActivityRepository.create({
        generalUpdate: { id: generalUpdateId },
        user: { id: userId },
        type: GeneralUpdateActivityType.DISMISSED,
        createdAt: new Date(),
      }),
    );
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
        (activity) => activity.type === ActionActivityType.USER_DISMISSED,
      )
    ) {
      return UserActionRelation.Dismissed;
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

  async dismissAction(
    userId: number,
    actionId: number,
  ): Promise<ActionActivityDto> {
    return await this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_DISMISSED,
    });
  }

  async createActionActivity(options: {
    actionId: number;
    userId: number;
    type: ActionActivityType;
    taskFormResponse?: FormResponse;
    declineReason?: string;
    isOutOfTime?: boolean;
    adminCreated?: boolean;
  }): Promise<ActionActivityDto> {
    const {
      actionId,
      userId,
      type,
      taskFormResponse,
      declineReason,
      isOutOfTime,
      adminCreated,
    } = options;
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
      outOfTime: isOutOfTime,
      source: adminCreated
        ? ActivitySource.ADMIN_OVERRIDE
        : ActivitySource.USER,
    });
    const savedActivity = await this.actionActivityRepository.save(activity);

    const activityDto = new ActionActivityDto(savedActivity);
    this.eventEmitter.emit('action.activity', {
      actionId,
      activity: activityDto,
    });

    await this.reloadUsersJoinedForAction(actionId);
    if (type === ActionActivityType.USER_COMPLETED) {
      await this.reloadUsersCompletedForAction(actionId);
    }

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

    return this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_JOINED,
    });
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
    return this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_WONT_COMPLETE,
      declineReason: reason,
      isOutOfTime: outOfTime,
    });
  }

  async completeAction(
    actionId: number,
    userId: number,
    options: {
      taskFormResponse?: FormResponse;
      adminCreated?: boolean;
    } = {},
  ): Promise<ActionActivityDto> {
    return this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_COMPLETED,
      taskFormResponse: options.taskFormResponse,
      adminCreated: options.adminCreated,
    });
  }

  async update(
    id: number,
    updateActionDto: UpdateActionDto,
    userId: number,
  ): Promise<Action | null> {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: {
        participatingTags: true,
        authors: true,
        suite: true,
      },
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }
    const oldSuiteId = action.suite?.id;

    const { participatingTags, suiteId, authorIds, ...rest } = updateActionDto;

    if (suiteId !== undefined) {
      if (suiteId === null) {
        action.suite = null;
      } else {
        const suite = await this.actionSuiteRepository.findOneOrFail({
          where: { id: suiteId },
        });
        action.suite = suite;
      }
    }

    if (authorIds !== undefined) {
      action.authors = authorIds.length
        ? await this.userService.findByIds(authorIds)
        : [];
    }

    Object.assign(action, rest);

    if (participatingTags !== undefined) {
      action.participatingTags =
        await this.resolveParticipatingTags(participatingTags);
    }

    await this.actionRepository.save(action);
    const newSuiteId = action.suite?.id;
    await this.syncGeneralUpdateDatesForSuites([oldSuiteId, newSuiteId]);

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

    await this.syncGeneralUpdateDatesForSuites([action.suite?.id]);
    return savedEvent;
  }

  async remove(id: number) {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: { suite: true },
    });
    await this.actionRepository.delete(id);
    await this.syncGeneralUpdateDatesForSuites([action?.suite?.id]);
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
      relations: {
        action: true,
        user: true,
        taskFormResponse: true,
      },
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
      relations: {
        user: { city: true },
      },
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

    //TODO: for now we dont use pruned so that we can use non-output fields
    // to evaluate the conditional visibility of output fields - maybe just cache?
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
      answers,
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
    const activityIds = activities.map((activity) => activity.id);
    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(activityIds, requestingUserId)
      : new Set<number>();

    const commentsByActivity =
      await this.forumService.findCommentsForActivities(activityIds);

    return activities.map((activity) => {
      const comments = commentsByActivity.get(activity.id) ?? [];
      return new ActionActivityDto(activity, {
        comments: comments.map((comment) => new CommentDto(comment)),
        formResponseOutput: activity.taskFormResponse
          ? this.buildOutputFormResponse(activity)
          : undefined,
        likedByMe: likedIds.has(activity.id),
      });
    });
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
    communityId?: number;
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

    if (options.communityId) {
      qb.innerJoin(
        'user.communities',
        'communityFilter',
        'communityFilter.id = :communityId',
        { communityId: options.communityId },
      );
    } else if (options.userIds?.length) {
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
      .filter((id): id is string => typeof id === 'string');

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
    const user = await this.userService.findOne(userId, {
      tags: true,
      contractEvents: true,
    });
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
      return action.manualCohortUserIds?.some((m) => m === user.id) ?? false;
    }
    const tags = action.participatingTags;
    const userTagIds = new Set((user.tags || []).map((tag) => tag.id));
    const isMember = tags.some((tag) => userTagIds.has(tag.id));

    if (action.onboarding) {
      const earliestContractEvent = findLeast(
        user.contractEvents ?? [],
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const earliestActionEvent = findLeast(
        action.events ?? [],
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      if (!earliestContractEvent) {
        return isMember;
      }
      if (
        !earliestActionEvent ||
        earliestContractEvent.date < earliestActionEvent.date
      ) {
        return false;
      }
    }

    return isMember;
  }

  async ensureUserEligibleForAction(action: Action, userId: number) {
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      contractEvents: true,
    });
    if (!(await this.isEligibleForAction(action, user))) {
      throw new ForbiddenException('This action is not available to you');
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
    await this.syncGeneralUpdateDatesForSuites([action.suite?.id]);
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
      relations: { events: true },
    });
    for (const action of actions) {
      if (action.status === ActionStatus.MemberAction) {
        await this.createActionActivity({
          actionId: action.id,
          userId: id,
          type: ActionActivityType.USER_JOINED,
        });
      }
    }
  }

  async getActivityForUser(userId: number): Promise<ActionActivityDto[]> {
    const activities = await this.actionActivityRepository.find({
      where: {
        user: { id: userId },
      },
      relations: { action: true, user: true },
    });
    return activities.map((activity) => new ActionActivityDto(activity));
  }

  async friendActivity(
    userId: number,
    comments?: boolean,
    limit?: number,
  ): Promise<ActionActivityDto[]> {
    const user = await this.userService.findOne(userId, {
      sentFriendRequests: true,
      receivedFriendRequests: true,
    });
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

  async friendActivityForAction(
    userId: number,
    actionId: number,
    comments?: boolean,
    limit?: number,
  ): Promise<ActionActivityDto[]> {
    const friends = await this.userService.findFriends(userId);

    if (friends.length === 0) {
      return [];
    }

    const friendActivities = await this.buildActivityFeedQuery({
      limit: limit ?? 20,
      userIds: friends.map((f) => f.id),
      actionId,
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
    const community = await this.communityService.findOneOrFail(communityId);

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
      relations: { events: true },
    });
    return actions.filter((action) => action.status !== ActionStatus.Draft);
  }

  async getActivity(
    id: number,
    requestingUserId?: number,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: {
        user: true,
        action: true,
        likes: true,
        taskFormResponse: true,
      },
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
      relations: { action: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return new ActionEventDto(event);
  }

  async likeActivity(id: number, userId: number, unlike = false) {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: { user: true, action: true, likes: true },
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
      relations: { user: true, action: true, likes: true },
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
      relations: { editableContent: true, taskFormResponse: true },
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
    return this.createActionActivity({
      actionId: activityDto.actionId,
      userId: activityDto.userId,
      type: activityDto.type,
      adminCreated: true,
    });
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
      relations: { participatingTags: true },
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

  async updateActionUpdate(
    id: number,
    createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<ActionUpdateDto> {
    const actionUpdate = await this.actionUpdateRepository.findOneOrFail({
      where: { id },
    });
    const updatedActionUpdate = { ...actionUpdate, ...createActionUpdateDto };
    const saved = await this.actionUpdateRepository.save(updatedActionUpdate);
    return new ActionUpdateDto(saved);
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
      relations: { action: true },
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
      relations: {
        actions: { events: true, participatingTags: true, activities: true },
        reminderGroups: { memberActionEvent: true, deadlineEvent: true },
        generalUpdates: true,
      },
    });

    return new ActionSuiteDto(
      instanceToPlain(suite) as ActionSuite,
      suite.actions.map((action) => new ActionDto(action)),
    );
  }

  async createSuite(
    createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuite> {
    const suite = this.actionSuiteRepository.create(createActionSuiteDto);
    const saved = await this.actionSuiteRepository.save(suite);
    await this.syncGeneralUpdateDatesForSuites([suite.id]);
    return saved;
  }

  async batchUpdateSuiteEvents(
    suiteId: number,
    eventId: number,
    body: UpdateActionEventDto,
  ) {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: { events: true } },
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: { events: true } },
    });
    const eventIdx = event.action.events
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .findIndex((event) => event.id === eventId);
    const eventsToUpdate = new Set<number>([eventId]);

    for (const action of suite.actions) {
      if (action.events.length <= eventIdx) {
        throw new BadRequestException(
          'Events do not have equivalent events to edit',
        );
      }
      const possibleEvent = action.events.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      )[eventIdx];
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
    await this.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.getSuite(suiteId);
  }

  async addSuiteEvent(suiteId: number, actionEventDto: CreateActionEventDto) {
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: true },
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
    await this.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.getSuite(suiteId);
  }

  async deleteSuiteEvent(suiteId: number, eventId: number) {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: { events: true } },
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: { events: true } },
    });
    const eventIdx = event.action.events
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .findIndex((event) => event.id === eventId);

    for (const action of suite.actions) {
      if (action.events.length <= eventIdx) {
        throw new BadRequestException(
          'Events do not have equivalent events to delete',
        );
      }
      const possibleEvent = action.events.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      )[eventIdx];
      if (
        possibleEvent.newStatus === event.newStatus &&
        possibleEvent.suiteManaged
      ) {
        console.log('deleting event', possibleEvent.id);
        await this.actionEventRepository.delete(possibleEvent.id);
      }
    }
    await this.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.getSuite(suiteId);
  }

  async tentativePlansForGroup(
    eventId: number,
    body: CreateReminderGroupDto,
  ): Promise<PreviewNotificationPlan[]> {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: {
        action: {
          events: true,
          participatingTags: true,
        },
      },
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

    const plans = await this.actionEventReminderService.findPlansForGroup(
      withDeadlineEvent,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    );

    return plans.map((plan) => ({
      ...plan,
      channel: shouldTextUser(plan.user) ? 'text' : 'email',
    }));
  }

  async findUncompletedTasks(
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
      relations: { actions: true },
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
    const relations: Relations<Action> = {
      participatingTags: true,
      authors: true,
      events: events || undefined,
      suite: suite || undefined,
    };

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

    const {
      taskForm,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      reminderGroups,
      suite,
      events,
      participatingTags,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      activities,
      authors,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      updates,
      ...actionCols
    } = importaction;

    let suiteIdToSync: number | undefined;
    const result = await this.actionRepository.manager.transaction(
      async (em) => {
        const actionRepo = em.getRepository(Action);
        const suiteRepo = em.getRepository(ActionSuite);
        const formRepo = em.getRepository(Form);
        const eventRepo = em.getRepository(ActionEvent);
        const tagRepo = em.getRepository(Tag);

        const inserted = await actionRepo.insert({
          ...actionCols,
          id: undefined,
        });

        const actionId = inserted.identifiers[0].id as number;

        if (suite) {
          let foundSuite = await suiteRepo.findOne({
            where: { name: suite.name },
          });
          if (!foundSuite) {
            foundSuite = await suiteRepo.save(
              suiteRepo.create({ name: suite.name }),
            );
          }
          await actionRepo.update(actionId, { suite: { id: foundSuite.id } });
          suiteIdToSync = foundSuite.id;
        }

        if (authors?.length) {
          await actionRepo
            .createQueryBuilder()
            .relation(Action, 'authors')
            .of(actionId)
            .add(authors.map((a) => ({ id: a.id })));
        }

        if (taskForm) {
          const newTaskForm = await formRepo.save(
            formRepo.create({ ...taskForm, id: undefined }),
          );
          await actionRepo.update(actionId, { taskFormId: newTaskForm.id });
        }

        if (events?.length) {
          await eventRepo.insert(
            events.map((e) => ({
              ...e,
              updates: undefined,
              id: undefined,
              action: { id: actionId },
            })),
          );
        }

        if (participatingTags?.length) {
          const tagIds = (
            await tagRepo.findBy({ id: In(participatingTags.map((t) => t.id)) })
          ).map((t) => t.id);

          if (tagIds.length) {
            await actionRepo
              .createQueryBuilder()
              .relation(Action, 'participatingTags')
              .of(actionId)
              .add(tagIds);
          }
        }

        const saved = await actionRepo.findOneOrFail({
          where: { id: actionId },
        });

        return new ActionDto(saved);
      },
    );
    await this.syncGeneralUpdateDatesForSuites([suiteIdToSync]);
    return result;
  }

  // TODO move ==================================

  latestMemberActionPhaseDeadline(events: ActionEvent[]): Date | null {
    let latestMemberActionDate: Date | null = null;
    for (const event of events) {
      if (
        event.newStatus === ActionStatus.MemberAction &&
        (latestMemberActionDate === null || event.date > latestMemberActionDate)
      ) {
        latestMemberActionDate = event.date;
      }
    }
    if (!latestMemberActionDate) {
      return null;
    }

    let earliestDeadline: Date | null = null;
    for (const event of events) {
      if (
        event.newStatus !== ActionStatus.MemberAction &&
        event.date > latestMemberActionDate &&
        (earliestDeadline === null || event.date < earliestDeadline)
      ) {
        earliestDeadline = event.date;
      }
    }
    return earliestDeadline;
  }

  someMemberActionPhaseIsOver(params: {
    events: ActionEvent[];
    date: Date;
  }): boolean {
    const { events, date } = params;
    const deadline = this.latestMemberActionPhaseDeadline(events);
    if (!deadline) {
      return false;
    }
    return deadline <= date;
  }

  calculateDeadlineWeekNumber(events: ActionEvent[]): number | null {
    const deadline = this.latestMemberActionPhaseDeadline(events);
    if (!deadline) {
      return null;
    }
    return Math.floor(deadline.getTime() / MS_IN_WEEK);
  }

  async findActionRelationsForUsers(
    usersP: Promise<User[]>,
    actionLimit: number = 8,
  ): Promise<UserActionRelationsResponseDto> {
    const actionsP: Promise<Action[]> = run(async () => {
      const actions = await this.findAllSorted(
        { events: true, suite: true, participatingTags: true },
        actionLimit,
      );
      return actions.filter(
        (action) =>
          !action.archived &&
          action.status !== ActionStatus.Draft &&
          !action.publicOnly,
      );
    });

    const userIdsP = usersP.then((users) => users.map((user) => user.id));
    const userIdsSetP = userIdsP.then((userIds) => new Set(userIds));

    const joinedUsersP: Promise<Record<number, number[]>> = run(async () => {
      const actions = await actionsP;
      const joinedUsersPromises = await Promise.all(
        actions.map(async (action) => ({
          actionId: action.id,
          usersJoined: await this.findUsersJoinedForAction(action),
        })),
      );

      const userIdsSet = await userIdsSetP;
      const joinedUsers: Record<number, number[]> = {};
      for (const { actionId, usersJoined } of joinedUsersPromises) {
        joinedUsers[actionId] = usersJoined.filter((uid) =>
          userIdsSet.has(uid),
        );
      }
      return joinedUsers;
    });

    const suitesP: Promise<ActionSuiteSummaryDto[]> = run(async () => {
      const actions = await actionsP;
      return await this.actionSuiteRepository.find({
        where: { id: In(actions.map((a) => a.suite?.id)) },
      });
    });

    const activitiesP = run(async () => {
      const actions = await actionsP;
      const actionIds = actions.map((a) => a.id);
      return this.actionActivityRepository.find({
        where: { actionId: In(actionIds), userId: In(await userIdsP) },
        order: { createdAt: 'ASC' },
      });
    });

    const allMembersTagIdP: Promise<string | null> = run(async () => {
      const tag = await this.userService.findTagByName('All Members');
      return tag?.id ?? null;
    });

    // --- end of promise defs ---

    const now = new Date();
    const userCachedFilter = new CachedFilter(await usersP);
    const actions = await actionsP;

    const allMembersTagId = await allMembersTagIdP;
    const actionSummaries: UserActionSummaryDto[] = await actions.map(
      (action) => {
        return {
          id: action.id,
          name: action.name,
          status: action.status,
          weekNumber: action.deadlineWeekNumber,
          allMembersParticipating:
            allMembersTagId !== null &&
            !!action.participatingTags.find(
              (tag) => tag.id === allMembersTagId,
            ),
          suiteId: action.suite?.id,
          latestMemberActionDeadline:
            action.latestMemberActionEvent?.deadline?.getTime() ?? null,
        } satisfies UserActionSummaryDto;
      },
    );

    const actionIds = actions.map((a) => a.id);
    const actionOrder = new Map(actionIds.map((id, index) => [id, index]));

    const relationByUserThenAction = new Map<
      number,
      Map<
        number,
        Omit<UserActionRelationDetailDto, 'latestActivityAt'> & {
          latestActivityAt?: Date;
        }
      >
    >();
    function getDetail(params: { userId: number; actionId: number }) {
      const { userId, actionId } = params;
      if (!relationByUserThenAction.has(userId)) {
        relationByUserThenAction.set(userId, new Map());
      }
      if (!relationByUserThenAction.get(userId)!.has(actionId)) {
        relationByUserThenAction.get(userId)!.set(actionId, {
          actionId,
          status: UserActionRelationPillStatus.NotRequired,
          declineReason: undefined,
          isMoral: undefined,
          outOfTime: undefined,
        });
      }
      return relationByUserThenAction.get(userId)!.get(actionId)!;
    }

    // Initialize defaults if no action was taken
    for (const action of actions) {
      for (const userId of (await joinedUsersP)[action.id]) {
        const detail = getDetail({ userId, actionId: action.id });
        detail.status = action.optional
          ? UserActionRelationPillStatus.OptionalTask
          : action.latestMemberActionEvent?.deadline &&
              action.latestMemberActionEvent.deadline < now
            ? UserActionRelationPillStatus.MissedDeadline
            : UserActionRelationPillStatus.Todo;
      }
      for (const userId of await userIdsP) {
        const detail = getDetail({ userId, actionId: action.id });
        if (
          computeIsAwayDuringAnyOfLastMemberAction({
            user: userCachedFilter.filtered({ id: userId })[0]!,
            action,
          }) &&
          computeIsTaggedOrInManualCohortAction({
            action,
            user: userCachedFilter.filtered({ id: userId })[0]!,
            includeSuspended: false,
          })
        ) {
          detail.status = UserActionRelationPillStatus.Away;
        }
      }
    }

    function typeToStatus(
      activityType: ActionActivityType,
    ): UserActionRelationPillStatus | null {
      switch (activityType) {
        case ActionActivityType.USER_COMPLETED:
          return UserActionRelationPillStatus.Completed;
        case ActionActivityType.USER_WONT_COMPLETE:
          return UserActionRelationPillStatus.WontComplete;
        case ActionActivityType.USER_DECLINED:
          return UserActionRelationPillStatus.WontComplete;
        case ActionActivityType.USER_DISMISSED:
        case ActionActivityType.USER_JOINED:
          return null;
        default:
          throw new Error(
            `Invalid activity type: ${activityType satisfies never}`,
          );
      }
    }
    for (const activity of await activitiesP) {
      const detail = getDetail({
        userId: activity.userId,
        actionId: activity.actionId,
      });
      if (
        !detail.latestActivityAt ||
        detail.latestActivityAt < activity.createdAt
      ) {
        detail.latestActivityAt = activity.createdAt;
        detail.latestActivityType = activity.type;
        const status = typeToStatus(activity.type);
        if (status) {
          detail.status = status;
        }
        // Capture withdrawal reason details for wont_complete and declined activities
        if (
          activity.type === ActionActivityType.USER_WONT_COMPLETE ||
          activity.type === ActionActivityType.USER_DECLINED
        ) {
          detail.declineReason = activity.declineReason;
          detail.isMoral = activity.isMoral;
          detail.outOfTime = activity.outOfTime;
        }
      }
    }

    const suites = (await suitesP).map((suite) => ({
      id: suite.id,
      name: suite.name,
    }));

    const userRelations: UserActionRelationsForUserDto[] = Array.from(
      relationByUserThenAction.entries(),
    ).map(([userId, actionMap]) => {
      const relations: UserActionRelationDetailDto[] = Array.from(
        actionMap.entries(),
      )
        .map(([actionId, detail]) => ({
          actionId,
          status: detail.status,
          latestActivityType: detail.latestActivityType,
          latestActivityAt: detail.latestActivityAt?.toISOString(),
          declineReason: detail.declineReason,
          isMoral: detail.isMoral,
          outOfTime: detail.outOfTime,
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
      suites,
      users: userRelations,
    };
  }

  async findUserActionRelations(): Promise<UserActionRelationsResponseDto> {
    const usersPromise = this.userService.findAll({
      awayRanges: true,
      contractEvents: true,
      tags: true,
    });
    return this.findActionRelationsForUsers(usersPromise);
  }

  async findUserActionRelationsForUser(
    userId: number,
  ): Promise<UserActionRelationsResponseDto> {
    const userPromise = this.userService
      .findOneOrFail(userId, {
        awayRanges: true,
        contractEvents: true,
        tags: true,
      })
      .then((user) => [user]);
    return this.findActionRelationsForUsers(userPromise, 100);
  }

  async findMemberInfoByCommunityId(
    communityId: number,
  ): Promise<CommunityUserInfoDto> {
    const usersPromise = this.communityService
      .findOneOrFail(communityId, {
        users: { awayRanges: true, contractEvents: true, tags: true },
      })
      .then((community) => community.users);
    return this.findActionRelationsForUsers(usersPromise);
  }

  async findMemberInfo(
    userId: number,
    communityId: number,
  ): Promise<CommunityUserInfoDto> {
    const usersPromise = run(async () => {
      const community = await this.communityService.findOneOrFail(communityId, {
        users: { awayRanges: true, contractEvents: true, tags: true },
      });
      if (!community.users.some((user) => user.id === userId)) {
        throw new NotFoundException('User is not a member of this community');
      }

      return community.users;
    });

    return this.findActionRelationsForUsers(usersPromise);
  }

  async getFailedUsersForEvent(
    action: Action,
    event: ActionEvent,
  ): Promise<User[]> {
    const baseUsers =
      await this.actionEventRecipientService.findBaseUsersForEvent({
        action,
        eventId: event.id,
        eventStatus: ActionStatus.MemberAction,
      });

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

  isActionPast(action: Action, now: Date): boolean {
    return action.events.some(
      (event) =>
        event.newStatus === ActionStatus.MemberAction && event.date < now,
    );
  }

  private async buildSuspendPlanContext(
    actions: Action[],
    maxPastDate?: Date,
  ): Promise<SuspendPlanContext> {
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
      if (action.onboarding) continue;

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

    if (orderedSuites.length === 0) {
      return {
        orderedSuites: [],
        expectedBySuite: new Map(),
        failedBySuite: new Map(),
        idToUser: new Map(),
        allExpectedUsers: [],
      };
    }

    const memberActionEventByActionId = new Map<number, ActionEvent>();
    const memberActionMinDateByActionId = new Map<number, Date>();
    const deadlineDateByActionId = new Map<number, Date>();
    for (const suite of orderedSuites) {
      for (const action of suite.actions) {
        let minDate: Date | null = null;
        for (const event of action.events) {
          if (event.newStatus !== ActionStatus.MemberAction) continue;
          if (!memberActionEventByActionId.has(action.id)) {
            memberActionEventByActionId.set(action.id, event);
          }
          if (!minDate || event.date < minDate) {
            minDate = event.date;
          }
        }
        if (minDate) {
          memberActionMinDateByActionId.set(action.id, minDate);
        }
        const memberEvent = memberActionEventByActionId.get(action.id);
        if (memberEvent) {
          const deadlineEvent = this.actionEventRecipientService.getNextEvent({
            events: action.events,
            currentEventId: memberEvent.id,
          });
          if (deadlineEvent) {
            deadlineDateByActionId.set(action.id, deadlineEvent.date);
          }
        }
      }
    }

    const maxPastMs = maxPastDate?.getTime();
    const orderedSuiteMeta = orderedSuites.map((suite) => {
      let pastDate: Date | null = null;
      for (const action of suite.actions) {
        const deadline = deadlineDateByActionId.get(action.id);
        if (!deadline) {
          pastDate = null;
          break;
        }
        if (!pastDate || deadline > pastDate) {
          pastDate = deadline;
        }
      }
      return { suiteId: suite.suite.id, pastDate };
    });

    const suitesToProcess = orderedSuites.filter((_, index) => {
      const pastDate = orderedSuiteMeta[index].pastDate;
      if (!pastDate) return false;
      if (maxPastMs !== undefined && pastDate.getTime() > maxPastMs) {
        return false;
      }
      return true;
    });

    const orderedSuitesForContext = orderedSuiteMeta.filter((_, index) => {
      const pastDate = orderedSuiteMeta[index].pastDate;
      if (!pastDate) return false;
      if (maxPastMs !== undefined && pastDate.getTime() > maxPastMs) {
        return false;
      }
      return true;
    });

    if (suitesToProcess.length === 0) {
      return {
        orderedSuites: orderedSuitesForContext,
        expectedBySuite: new Map(),
        failedBySuite: new Map(),
        idToUser: new Map(),
        allExpectedUsers: [],
      };
    }

    const actionIds: number[] = [];
    let needsActiveUsers = false;
    for (const suite of suitesToProcess) {
      for (const action of suite.actions) {
        actionIds.push(action.id);
        if (action.commitmentless) {
          needsActiveUsers = true;
        }
      }
    }

    const [dismissedActivities, joinedActivities, completionActivities] =
      await Promise.all([
        this.actionActivityRepository.find({
          where: {
            actionId: In(actionIds),
            type: ActionActivityType.USER_DISMISSED,
          },
        }),
        this.actionActivityRepository.find({
          where: {
            actionId: In(actionIds),
            type: ActionActivityType.USER_JOINED,
          },
          relations: {
            user: { tags: true, awayRanges: true, contractEvents: true },
          },
        }),
        this.actionActivityRepository.find({
          where: {
            actionId: In(actionIds),
            type: In([
              ActionActivityType.USER_COMPLETED,
              ActionActivityType.USER_WONT_COMPLETE,
              ActionActivityType.USER_DECLINED,
            ]),
          },
        }),
      ]);

    const activeUsers = needsActiveUsers
      ? await this.userService.findActiveUsersWithTags()
      : [];

    const dismissedByAction = new Map<number, Set<number>>();
    for (const activity of dismissedActivities) {
      if (!dismissedByAction.has(activity.actionId)) {
        dismissedByAction.set(activity.actionId, new Set());
      }
      dismissedByAction.get(activity.actionId)!.add(activity.userId);
    }

    const joinedUsersByAction = new Map<number, User[]>();
    for (const activity of joinedActivities) {
      if (!joinedUsersByAction.has(activity.actionId)) {
        joinedUsersByAction.set(activity.actionId, []);
      }
      joinedUsersByAction.get(activity.actionId)!.push(activity.user);
    }

    const completedByAction = new Map<number, Set<number>>();
    for (const activity of completionActivities) {
      if (!completedByAction.has(activity.actionId)) {
        completedByAction.set(activity.actionId, new Set());
      }
      completedByAction.get(activity.actionId)!.add(activity.userId);
    }

    const baseUsersByAction = new Map<number, User[]>();
    for (const suite of suitesToProcess) {
      for (const action of suite.actions) {
        const event = memberActionEventByActionId.get(action.id);
        if (!event) continue;

        const targetTagIds = new Set(
          action.participatingTags.map((tag) => tag.id),
        );
        const manualCohortUserIds = action.manualCohortUserIds
          ? new Set(action.manualCohortUserIds)
          : undefined;
        const dismissedSet = dismissedByAction.get(action.id) ?? new Set();
        const deadlineEvent = this.actionEventRecipientService.getNextEvent({
          events: action.events,
          currentEventId: event.id,
        });

        const baseCandidates = action.commitmentless
          ? activeUsers
          : (joinedUsersByAction.get(action.id) ?? []);

        const baseUsers = baseCandidates.filter(
          (user) =>
            this.actionEventRecipientService.computeShouldParticipate({
              eventDate: event.date,
              deadlineDate: deadlineEvent?.date ?? null,
              everyoneShouldComplete: action.everyoneShouldComplete,
              manualCohortUserIds,
              targetTagIds,
              useManualCohort: action.useManualCohort,
              user,
              userDismissed: dismissedSet.has(user.id),
              onboarding: action.onboarding,
            }) &&
            !computeIsAwayInRange({
              user,
              startDate: event.date,
              endDate: deadlineEvent?.date,
            }),
        );

        baseUsersByAction.set(action.id, baseUsers);
      }
    }

    const expectedBySuite = new Map<number, Set<number>>();
    const failedBySuite = new Map<number, Set<number>>();
    const idToUser = new Map<number, User>();

    const getLastSignedDate = (user: User) => {
      return (
        user.contractEvents
          ?.filter((event) => event.type === ContractEventType.SIGNED)
          ?.sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date ??
        new Date(0)
      );
    };

    for (const suite of suitesToProcess) {
      const firstAction = suite.actions[0];
      const firstEvent = memberActionEventByActionId.get(firstAction.id);
      if (!firstEvent) {
        throw new Error(
          `Member action event not found for action ${firstAction.id}`,
        );
      }

      const baseCohort = baseUsersByAction.get(firstAction.id) ?? [];
      expectedBySuite.set(
        suite.suite.id,
        new Set(baseCohort.map((user) => user.id)),
      );

      for (const action of suite.actions) {
        const event = memberActionEventByActionId.get(action.id);
        if (!event) {
          continue;
        }

        const baseUsers = baseUsersByAction.get(action.id) ?? [];
        const completedSet = completedByAction.get(action.id) ?? new Set();
        const failed = baseUsers.filter((user) => !completedSet.has(user.id));
        const failedAndActive = failed.filter((user) => user.hasActiveContract);
        const signedBeforeFailed = failedAndActive.filter(
          (user) => getLastSignedDate(user) < event.date,
        );

        for (const user of signedBeforeFailed) {
          idToUser.set(user.id, user);
        }

        if (!failedBySuite.has(suite.suite.id)) {
          failedBySuite.set(suite.suite.id, new Set());
        }
        const suiteFailed = failedBySuite.get(suite.suite.id)!;
        for (const user of signedBeforeFailed) {
          suiteFailed.add(user.id);
        }
      }
    }

    const allExpectedUsers = new Set<number>();
    for (const s of expectedBySuite.values()) {
      for (const id of s) allExpectedUsers.add(id);
    }

    return {
      orderedSuites: orderedSuitesForContext,
      expectedBySuite,
      failedBySuite,
      idToUser,
      allExpectedUsers: Array.from(allExpectedUsers),
    };
  }

  private computeUsersToSuspendFromContext(
    now: Date,
    context: SuspendPlanContext,
  ) {
    const pastSuites = context.orderedSuites.filter(
      (suite) => suite.pastDate && suite.pastDate < now,
    );

    const usersToSuspend = new Set<number>();
    const suspendReasonKeys = new Map<number, string>();

    for (const userId of context.allExpectedUsers) {
      let streak = 0;
      const lastThreeSuiteIds: number[] = [];

      for (const suite of pastSuites) {
        const expectedSet = context.expectedBySuite.get(suite.suiteId);
        if (!expectedSet?.has(userId)) {
          continue; // skip suites they were not expected to complete
        }

        const failedSet =
          context.failedBySuite.get(suite.suiteId) ?? new Set<number>();
        const failed = failedSet.has(userId);

        if (failed) {
          streak += 1;
          lastThreeSuiteIds.push(suite.suiteId);
          if (lastThreeSuiteIds.length > 3) lastThreeSuiteIds.shift();
          if (streak >= 3) {
            usersToSuspend.add(userId);
            suspendReasonKeys.set(userId, `s-${lastThreeSuiteIds.join('-')}`);
            break;
          }
        } else {
          // they were expected and did not fail => streak broken
          streak = 0;
          lastThreeSuiteIds.length = 0;
        }
      }
    }

    return {
      usersToSuspend: Array.from(usersToSuspend).map(
        (userId) => context.idToUser.get(userId)!,
      ),
      suspendReasonKeys,
    };
  }

  async findUsersToSuspend(now: Date, preloadedActions?: Action[]) {
    const actions =
      preloadedActions ??
      (await this.findAllSorted({
        events: true,
        suite: true,
        participatingTags: true,
      }));

    const context = await this.buildSuspendPlanContext(actions, now);
    return this.computeUsersToSuspendFromContext(now, context);
  }

  async getSuspendPlans(
    rangeStart: Date,
    rangeEnd: Date,
    stepHours: number = 1,
  ): Promise<SuspensionPlanDto[]> {
    const actions = await this.findAllSorted({
      events: true,
      suite: true,
      participatingTags: true,
    });
    const context = await this.buildSuspendPlanContext(actions, rangeEnd);

    const plans: SuspensionPlanDto[] = [];
    let date = rangeStart;
    const suspendedUsers = new Set<number>();
    const rangeEndMs = rangeEnd.getTime();
    const stepMs = stepHours * 60 * 60 * 1000;

    while (date.getTime() <= rangeEndMs) {
      const { usersToSuspend } = this.computeUsersToSuspendFromContext(
        date,
        context,
      );
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
      date = new Date(date.getTime() + stepMs);
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
    const existing = await this.actionShareUrlRepository.findOne({
      where: {
        action: { id: actionId },
        user: { id: userId },
      },
    });
    if (existing) {
      return existing.url;
    }

    const sid = this.generateCIDForShareUrl();
    const url = withSid(actionUrl(actionId, true), sid);

    const action = await this.actionRepository.findOne({
      where: { id: actionId },
    });
    if (!action) {
      throw new BadRequestException('specified action not found');
    }

    const shareUrl = await this.actionShareUrlRepository.create({
      url,
      user: { id: userId },
      action,
      sid,
      data: {
        sid,
      },
    });

    await this.actionShareUrlRepository.save(shareUrl);
    return shareUrl.url;
  }

  async getShareLinksForForm(formId: number): Promise<ShareUrlDto[]> {
    const action = await this.actionRepository.findOneOrFail({
      where: { taskFormId: formId },
    });
    return this.actionShareUrlRepository
      .find({
        where: { action: { id: action.id } },
        relations: { user: true },
      })
      .then((shareUrls) =>
        shareUrls.map((shareUrl) => new ShareUrlDto(shareUrl)),
      );
  }

  async getShareUrlStats(
    actionId: number,
    questionId?: string,
  ): Promise<ShareUrlStatsDto[]> {
    // Get all share URLs for this action
    const shareUrls = await this.actionShareUrlRepository.find({
      where: { action: { id: actionId } },
      relations: ['user'],
    });

    if (shareUrls.length === 0) {
      return [];
    }

    // Get all sids
    const sids = shareUrls
      .map((su) => su.sid)
      .filter((sid): sid is string => !!sid);

    if (sids.length === 0) {
      return shareUrls.map(
        (su) => new ShareUrlStatsDto(new ProfileDto(su.user), 0, su.sid ?? ''),
      );
    }

    // Count form responses per sid
    const formResponseCounts = await this.formResponseRepository
      .createQueryBuilder('fr')
      .select('fr.sid', 'sid')
      .addSelect('COUNT(*)', 'count')
      .where('fr.sid IN (:...sids)', { sids })
      .groupBy('fr.sid')
      .getRawMany<{ sid: string; count: string }>();

    const countMap = new Map<string, number>();
    for (const row of formResponseCounts) {
      countMap.set(row.sid, parseInt(row.count, 10));
    }

    // Count yes answers per sid for the specified question
    const yesCountMap = new Map<string, number>();
    if (questionId) {
      const yesAnswerCounts = await this.formResponseRepository
        .createQueryBuilder('fr')
        .select('fr.sid', 'sid')
        .addSelect('COUNT(*)', 'count')
        .where('fr.sid IN (:...sids)', { sids })
        .andWhere(`fr.answers ->> :questionId = 'yes'`, { questionId })
        .groupBy('fr.sid')
        .getRawMany<{ sid: string; count: string }>();

      for (const row of yesAnswerCounts) {
        yesCountMap.set(row.sid, parseInt(row.count, 10));
      }
    }

    const results = shareUrls
      .map(
        (su) =>
          new ShareUrlStatsDto(
            new ProfileDto(su.user),
            countMap.get(su.sid ?? '') ?? 0,
            su.sid ?? '',
            yesCountMap.get(su.sid ?? '') ?? 0,
          ),
      )
      .filter((stat) => stat.inviteCount > 0);

    return results.sort((a, b) => b.inviteCount - a.inviteCount);
  }

  /**
   * Get a unified global feed that includes:
   * - Activity groups (e.g., "10 people completed [action]") - combined across all time
   * - Action updates
   * - New member joins
   * - Forum comments grouped by post
   */
  async getGlobalFeed(limit: number = 15): Promise<GlobalFeedItemDto[]> {
    const feedItems: GlobalFeedItemDto[] = [];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    // 1. Fetch recent activities (last week) and group by action + type (no day bucketing)
    const recentActivities = await this.actionActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.action', 'action')
      .select([
        'activity.id',
        'activity.type',
        'activity.actionId',
        'activity.createdAt',
        'user.id',
        'user.name',
        'user.profilePicture',
        'user.anonymous',
        'user.admin',
        'user.staff',
        'user.profileDescription',
        'action.id',
        'action.name',
        'action.onboarding',
      ])
      .loadRelationIdAndMap('user.leaderOfIds', 'user.leaderOf')
      .where('activity.type IN (:...types)', {
        types: [
          ActionActivityType.USER_JOINED,
          ActionActivityType.USER_COMPLETED,
        ],
      })
      .andWhere('action.onboarding = false')
      .andWhere('activity.createdAt > :oneWeekAgo', { oneWeekAgo })
      .orderBy('activity.createdAt', 'DESC')
      .getMany();

    // Group activities by action + type only (combine across all days)
    const activityGroups = new Map<
      string,
      {
        activities: ActionActivity[];
        actionId: number;
        actionName: string;
        type: ActionActivityType;
        latestDate: Date;
      }
    >();

    for (const activity of recentActivities) {
      // Key by action + type only (no date bucketing)
      const key = `${activity.actionId}-${activity.type}`;

      if (!activityGroups.has(key)) {
        activityGroups.set(key, {
          activities: [],
          actionId: activity.actionId,
          actionName: activity.action?.name || 'Unknown Action',
          type: activity.type,
          latestDate: activity.createdAt,
        });
      }
      const group = activityGroups.get(key)!;
      group.activities.push(activity);
      if (activity.createdAt > group.latestDate) {
        group.latestDate = activity.createdAt;
      }
    }

    // Convert activity groups to feed items
    for (const group of activityGroups.values()) {
      const uniqueUsers = new Map<number, ProfileDto>();
      for (const activity of group.activities) {
        if (activity.user && !uniqueUsers.has(activity.user.id)) {
          uniqueUsers.set(activity.user.id, new ProfileDto(activity.user));
        }
      }
      const users = Array.from(uniqueUsers.values()).slice(0, 8);

      const activityGroup: GlobalFeedActivityGroupDto = {
        users,
        actionId: group.actionId,
        actionName: group.actionName,
        activityType:
          group.type === ActionActivityType.USER_COMPLETED
            ? 'completed'
            : 'joined',
        count: uniqueUsers.size,
      };

      feedItems.push({
        type: GlobalFeedItemType.ActivityGroup,
        date: group.latestDate,
        activityGroup,
      });
    }

    const actionUpdates = await this.actionUpdateRepository.find({
      where: {
        visibleAt: MoreThan(oneWeekAgo),
      },
      relations: { action: true, content: true },
      order: { date: 'DESC' },
      take: 10,
    });

    for (const update of actionUpdates) {
      // Only show if visibleAt has passed
      if (update.visibleAt <= now) {
        const actionUpdateDto: GlobalFeedActionUpdateDto = {
          id: update.id,
          title: update.title,
          content: new EditableContentDto(update.content),
          date: update.date,
          actionId: update.actionId,
          actionName: update.action?.name || 'Unknown Action',
        };

        feedItems.push({
          type: GlobalFeedItemType.ActionUpdate,
          date: update.date,
          actionUpdate: actionUpdateDto,
        });
      }
    }

    const signedEvents = await this.contractEventRepository.find({
      where: {
        type: ContractEventType.SIGNED,
        date: MoreThan(oneWeekAgo),
      },
      relations: { user: { contractEvents: true } },
      order: { date: 'DESC' },
    });

    // Combine all new members into one feed item
    if (signedEvents.length > 0) {
      const uniqueNewMembers = new Map<number, ProfileDto>();
      let latestMemberDate: Date | null = null;

      for (const event of signedEvents) {
        const user = event.user;
        if (!user?.hasActiveContract) continue;
        if (!uniqueNewMembers.has(user.id)) {
          uniqueNewMembers.set(user.id, new ProfileDto(user));
        }
        if (!latestMemberDate || event.date > latestMemberDate) {
          latestMemberDate = event.date;
        }
      }

      if (uniqueNewMembers.size > 0 && latestMemberDate) {
        const newMembers: GlobalFeedNewMembersDto = {
          users: Array.from(uniqueNewMembers.values()).slice(0, 20),
          count: uniqueNewMembers.size,
        };

        feedItems.push({
          type: GlobalFeedItemType.NewMembers,
          date: latestMemberDate,
          newMembers,
        });
      }
    }

    // 4. Fetch recent forum comments grouped by post
    const recentComments = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .select([
        'comment.id',
        'comment.parentObjectId',
        'comment.parentObjectType',
        'comment.createdAt',
        'author.id',
        'author.name',
        'author.profilePicture',
        'author.anonymous',
        'author.admin',
        'author.staff',
        'author.profileDescription',
      ])
      .loadRelationIdAndMap('author.leaderOfIds', 'author.leaderOf')
      .where('comment.parentObjectType = :postType', {
        postType: CommentParentObject.Post,
      })
      .andWhere('comment.createdAt > :oneWeekAgo', { oneWeekAgo })
      .andWhere('comment.deleted = false')
      .orderBy('comment.createdAt', 'DESC')
      .getMany();

    // Group comments by post
    const commentGroups = new Map<
      number,
      {
        users: Map<number, { profile: ProfileDto; commentId: number }>;
        latestDate: Date;
        postId: number;
      }
    >();

    for (const comment of recentComments) {
      const postId = comment.parentObjectId;

      if (!commentGroups.has(postId)) {
        commentGroups.set(postId, {
          users: new Map(),
          latestDate: comment.createdAt,
          postId,
        });
      }
      const group = commentGroups.get(postId)!;
      if (comment.author && !group.users.has(comment.author.id)) {
        group.users.set(comment.author.id, {
          profile: new ProfileDto(comment.author),
          commentId: comment.id,
        });
      }
      if (comment.createdAt > group.latestDate) {
        group.latestDate = comment.createdAt;
      }
    }

    // Fetch post titles for the comment groups
    const postIds = Array.from(commentGroups.keys());
    if (postIds.length > 0) {
      const posts = await this.postRepository.find({
        where: { id: In(postIds), deleted: false },
        select: ['id', 'title'],
      });

      const postTitleMap = new Map<number, string>();
      for (const post of posts) {
        postTitleMap.set(post.id, post.title);
      }

      // Convert comment groups to feed items
      for (const group of commentGroups.values()) {
        const postTitle = postTitleMap.get(group.postId);
        if (!postTitle) continue; // Skip if post was deleted

        const usersArray = Array.from(group.users.values());
        const forumComments: GlobalFeedForumCommentsDto = {
          users: usersArray.slice(0, 8).map((u) => u.profile),
          postId: group.postId,
          postTitle,
          count: group.users.size,
          commentId:
            usersArray.length === 1 ? usersArray[0].commentId : undefined,
        };

        feedItems.push({
          type: GlobalFeedItemType.ForumComments,
          date: group.latestDate,
          forumComments,
        });
      }
    }

    feedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return feedItems.slice(0, limit);
  }
}

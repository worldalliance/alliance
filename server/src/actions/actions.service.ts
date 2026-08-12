import {
  ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
  ActionActivityType,
  WITHDRAWAL_OPTION_LABELS,
  withdrawalHasRequiredReason,
  withdrawalOptionFromFlags,
} from '@alliance/common/actionActivity';
import {
  cohortExpressionSchema,
  expressionReferencesTag,
  type CohortExpression,
} from '@alliance/common/cohort-expression';
import {
  displayOnlySchema,
  displayOnlySchemaError,
  emptyDisplayOnlySchema,
  type DisplayOnlySchema,
} from '@alliance/common/forms/display-only-schema';
import type { FormSchema } from '@alliance/common/forms/form-schema';
import { run } from '@alliance/common/run';
import { Assert } from '@alliance/common/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { LiveActivityService } from 'src/apns/live-activity.service';
import { CommunityService } from 'src/community/community.service';
import { Community } from 'src/community/entities/community.entity';
import { EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { CommentDto, CreateCommentDto } from 'src/forum/dto/comment.dto';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { Post } from 'src/forum/entities/post.entity';
import { ForumService } from 'src/forum/forum.service';
import { FacepileService } from 'src/likes/facepile.service';
import { SnapshotHistoryOwner } from 'src/tasks/entities/formsnapshot.entity';
import { displayOnlySchemaOf } from 'src/tasks/display-only-snapshot';
import {
  isActionUpdatePublished,
  publishedActionUpdateWhere,
} from './action-update-visibility';
import { SCHEMA_WRITE_TARGETS } from './schema-write-target';
import { FormSnapshotService } from 'src/tasks/formsnapshot.service';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import {
  ActionEventReminderService,
  assertExcludePreviouslyNotifiedAllowed,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
} from 'src/notifs/action-event-reminder.service';
import { CohortResolutionSession } from 'src/notifs/cohort-resolution-session';
import { PreviewNotificationPlanDto } from 'src/notifs/dto/notification-plan.dto';
import { LikeNotificationService } from 'src/notifs/like-notification.service';
import { NotificationChannel } from 'src/notifs/notif-utils';
import { NotifsService } from 'src/notifs/notifs.service';
import { actionActivityUrl } from 'src/search/approutes';
import { ShareUrl } from 'src/share-urls/entities/share-url.entity';
import { ShareUrlsService } from 'src/share-urls/share-urls.service';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import {
  UserActionRelationDetail,
  UserActionRelationPillStatus,
  UserActionRelations,
  UserActionRelationsForUser,
  UserActionSummary,
} from 'src/user/dto/user-action-relations.dto';
import { ProfileDto } from 'src/user/dto/user.dto';
import { ContractEventType } from 'src/user/entities/contract-event.entity';
import { Tag } from 'src/user/entities/tag.entity';
import {
  sqlUserHasActiveContractAt,
  User,
} from 'src/user/entities/user.entity';
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from 'src/user/user.utils';
import {
  computeIsAssignedAndPresent,
  computeIsAssignedToAction,
  computeIsAwayDuringWindow,
  computeIsTaggedOrInManualCohort,
  computeMemberActionAwayStatus,
} from 'src/utils/action-user';
import { CachedFilter } from 'src/utils/cached-filter';
import { yieldToEventLoop } from 'src/utils/event-loop';
import { startDatePriorityComparator } from 'src/utils/general-update';
import type { IsRelation, Relations } from 'src/utils/Repository';
import {
  DeepPartial,
  EntityManager,
  ILike,
  In,
  IsNull,
  LessThan,
  MoreThan,
  Not,
  Or,
  type Repository,
} from 'typeorm';
import type { Repository as TypedRepository } from 'src/utils/Repository';
import { UserService } from '../user/user.service';
import {
  findLatestTerminalActivity,
  resolveUserActionRelation,
} from './action-activity-status';
import { ActionFormVariantService } from './action-form-variant.service';
import {
  answerMatchesFormField,
  evaluateCohortExpression,
  singleUserCohortContext,
} from './cohort-expression.evaluator';
import {
  ActionActivityDto,
  ActionDto,
  ActionSharePreview,
  CreateActionActivityDto,
  CreateActionDto,
  CreateActionEventDto,
  CreateActionSuiteDto,
  CreateActionUpdateDto,
  CreateReminderGroupDto,
  ExportActionDto,
  GlobalFeedActionUpdateDto,
  GlobalFeedActivityGroupDto,
  GlobalFeedActivityType,
  GlobalFeedActivityTypes,
  GlobalFeedForumCommentsDto,
  GlobalFeedItemDto,
  GlobalFeedItemType,
  GlobalFeedNewMembersDto,
  HomeFeedItem,
  HomeFeedItemDto,
  HomeFeedItemType,
  ReminderAnchorCandidate,
  SetPriorityDto,
  SuspensionPlan,
  TimelineFeedItemDto,
  TimelineFeedItemType,
  UnwelcomedSignedContractMember,
  UpdateActionActivityDto,
  UpdateActionDto,
  UpdateActionEventDto,
  UpdateActionUpdateDto,
  UserActionRelation,
} from './dto/action.dto';
import {
  CreateFollowUpFormDto,
  UpdateFollowUpFormDto,
} from './dto/follow-up-form.dto';
import {
  CreateGeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from './dto/general-update.dto';
import { ShareUrlStats } from './dto/share-url.dto';
import {
  ActionActivity,
  ActivitySource,
  ALLOW_DUPLICATE,
} from './entities/action-activity.entity';
import { ActionEvent, ActionStatus } from './entities/action-event.entity';
import { ActionFormVariant } from './entities/action-form-variant.entity';
import { ActionSuite } from './entities/action-suite.entity';
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from './entities/action-update.entity';
import {
  Action,
  ActionTaskType,
  parseAction,
  VisibilityMode,
  type ParsedAction,
} from './entities/action.entity';
import {
  FollowUpForm,
  parseFollowUpForm,
  type ParsedFollowUpForm,
} from './entities/follow-up-form.entity';
import {
  GeneralUpdateActivity,
  GeneralUpdateActivityType,
} from './entities/general-update-activity.entity';
import { GeneralUpdate } from './entities/general-update.entity';
import {
  ReminderGroup,
  ReminderGroupTimingMode,
} from './entities/reminder-group.entity';
import { resolveUserActionPillStatus } from './user-action-pill-status';
import {
  computeCanCompleteAction,
  resolveUserActionStatus,
} from './user-action-status';

type SuspendPlanContext = {
  orderedSuites: Array<{ suiteId: number; pastDate: Date | null }>;
  expectedBySuite: Map<number, Set<number>>;
  failedBySuite: Map<number, Set<number>>;
  idToUser: Map<number, User>;
  allExpectedUsers: number[];
};

/**
 * A user due for automatic suspension, paired with the key identifying the
 * failure streak that triggered it. `ContractEvent`'s `(user, autoSuspendKey)`
 * unique constraint dedupes on it, so it is never absent for a candidate.
 */
export type SuspensionCandidate = { user: User; reasonKey: string };

/** Facepile preview size; member-list endpoints paginate full lists. */
const GLOBAL_FEED_FACEPILE_LIMIT = 8;

/** Feed/member-list rolling window. */
const GLOBAL_FEED_WINDOW_DAYS = 8;

/**
 * Withdrawal reasons longer than this are truncated in the opt-out event-log
 * message to keep the Slack copy readable; the full reason is still stored on
 * the activity row and in the event's blob.
 */
const OPT_OUT_REASON_PREVIEW_LENGTH = 300;

type FeedMemberPageRow = {
  userId: number | string;
  latestAt: Date | string;
  latestId: number | string;
};

type FeedMemberRankedQuery = {
  rankedSql: string;
  params: unknown[];
};

type FeedMemberSummaryRow = FeedMemberPageRow & {
  totalCount: number | string;
};

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
    private readonly editableContentRepository: TypedRepository<EditableContent>,
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
    @Inject(forwardRef(() => ShareUrlsService))
    private readonly shareUrlsService: ShareUrlsService,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(FollowUpForm)
    private readonly followUpFormRepository: Repository<FollowUpForm>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(ActionFormVariant)
    private readonly actionFormVariantRepository: Repository<ActionFormVariant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private userService: UserService,
    public eventEmitter: EventEmitter2,
    private readonly communityService: CommunityService,
    private readonly notifsService: NotifsService,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly likeNotificationService: LikeNotificationService,
    private readonly forumService: ForumService,
    private readonly liveActivityService: LiveActivityService,
    private readonly eventLogService: EventLogService,
    @Inject(forwardRef(() => ActionFormVariantService))
    private readonly actionFormVariantService: ActionFormVariantService,
    private readonly facepileService: FacepileService,
    private readonly formSnapshotService: FormSnapshotService,
  ) {}

  async applyAssignedFormIds(
    actions: Action[],
    userId: number | undefined,
  ): Promise<void> {
    if (!userId || actions.length === 0) return;
    const overrides =
      await this.actionFormVariantService.getOrCreateAssignedFormIdsForActions(
        actions.map((a) => a.id),
        userId,
      );
    if (overrides.size === 0) return;
    for (const action of actions) {
      const formId = overrides.get(action.id);
      if (formId !== undefined) {
        action.taskFormId = formId;
      }
    }
  }

  async findActionById(id: number): Promise<Action | null> {
    return this.actionRepository.findOne({ where: { id } });
  }

  async findActionByFormId(formId: number): Promise<Action | null> {
    const direct = await this.actionRepository.findOne({
      where: { taskFormId: formId },
    });
    if (direct) return direct;
    const variant = await this.actionFormVariantRepository.findOne({
      where: { formId },
    });
    if (!variant) return null;
    return this.actionRepository.findOne({ where: { id: variant.actionId } });
  }

  async assertFormIdNotUsedAsVariant(formId: number): Promise<void> {
    const variant = await this.actionFormVariantRepository.findOne({
      where: { formId },
    });
    if (variant) {
      throw new BadRequestException(
        `Form ${formId} is already used as a variant form for action ${variant.actionId}`,
      );
    }
  }

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

  /**
   * The jsonb-backed cohortExpression arrives from HTTP as arbitrary JSON —
   * class-validator can't express its recursive shape, so every handler that
   * accepts one must parse it here before it reaches the db.
   */
  private parseCohortExpressionOrThrow(value: unknown): CohortExpression {
    const parsed = cohortExpressionSchema.safeParse(value);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new BadRequestException(`Invalid cohort expression: ${issues}`);
    }
    return parsed.data;
  }

  async create(createActionDto: CreateActionDto): Promise<Action> {
    const { suiteId, authorIds, ...rest } = createActionDto;
    if (rest.cohortExpression != null) {
      rest.cohortExpression = this.parseCohortExpressionOrThrow(
        rest.cohortExpression,
      );
    }
    if (rest.taskFormId !== undefined) {
      await this.assertFormIdNotUsedAsVariant(rest.taskFormId);
    }
    const action = this.actionRepository.create(rest);

    if (suiteId) {
      const suite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: suiteId },
      });
      action.suite = suite;
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

  async findAll(): Promise<ParsedAction[]> {
    const actions = await this.actionRepository.find({
      relations: {
        events: true,
        activities: true,
        suite: true,
      },
    });
    return actions.map(parseAction);
  }

  async findAllSorted(
    relations:
      | Omit<Relations<Action>, 'usersCompleted' | 'status'>
      | undefined = undefined,
    limit?: number,
  ): Promise<ParsedAction[]> {
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
      return sortedActions.map(parseAction);
    }

    const actionIds = sortedActions.map((a) => a.id);
    const actionsWithRelations = await this.actionRepository.find({
      where: { id: In(actionIds) },
      relations,
    });

    const actionMap = new Map(actionsWithRelations.map((a) => [a.id, a]));
    return actionIds.map((id) => parseAction(actionMap.get(id)!));
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
    const usersJoined = (await this.findParticipantIdsForActionById(actionId))
      .length;
    await this.actionRepository.update(actionId, { usersJoined });
  }

  async findParticipantIdsForActionById(actionId: number): Promise<number[]> {
    const action = parseAction(
      await this.actionRepository.findOneOrFail({
        where: { id: actionId },
        relations: {
          events: true,
          activities: true,
        },
      }),
    );

    return this.findParticipantIdsForAction(action);
  }

  async findParticipantIdsForAction(action: ParsedAction): Promise<number[]> {
    const result = await this.findParticipantIdsForActions([action]);
    return result.get(action.id) ?? [];
  }

  /**
   * The "participants" of an action — source of the persisted
   * `Action.usersJoined` counter (which keeps its legacy wire/DB name for now).
   * The formula:
   *
   *   base recipients (assigned, INCLUDING dismissed)
   *   − away at any point during the member-action window
   *   − withdrawn (USER_WONT_COMPLETE)
   *   + everyone with a USER_COMPLETED activity
   *
   * i.e. "could this user have done it at all?" — note this is NOT the same
   * set as the reminder/suspension roster (computeIsAssignedAndPresent), which
   * excludes dismissed users.
   *
   * Batched: fetches the shared data in a handful of bulk queries instead of
   * per-action. Returns a map of actionId -> participant userIds.
   */
  async findParticipantIdsForActions(
    actions: ParsedAction[],
    session: CohortResolutionSession = new CohortResolutionSession(),
  ): Promise<Map<number, number[]>> {
    // Build entries for actions that have a MemberAction event
    const entries: Array<{ action: ParsedAction; event: ActionEvent }> = [];
    for (const action of actions) {
      const event = action.events.find(
        (e) => e.newStatus === ActionStatus.MemberAction,
      );
      if (event) {
        entries.push({ action, event });
      }
    }

    if (entries.length === 0) {
      return new Map(actions.map((a) => [a.id, []]));
    }

    const actionIds = entries.map((e) => e.action.id);

    // 1. Batched base users (1 user query, 1 dismissed query, deduplicated cohorts)
    const baseUsersByAction =
      await this.actionEventRecipientService.findBaseUsersForEvents({
        entries: entries.map((e) => ({
          action: e.action,
          eventId: e.event.id,
        })),
        includeDismissed: true,
        session,
      });

    // 2. One query: all completion + withdrawal activities for these actions
    const allActivities = await this.actionActivityRepository.find({
      where: {
        actionId: In(actionIds),
        type: In([
          ActionActivityType.USER_COMPLETED,
          ActionActivityType.USER_WONT_COMPLETE,
        ]),
      },
    });
    const completionsByAction = new Map<number, number[]>();
    const withdrawalsByAction = new Map<number, Set<number>>();
    for (const act of allActivities) {
      if (act.type === ActionActivityType.USER_COMPLETED) {
        if (!completionsByAction.has(act.actionId)) {
          completionsByAction.set(act.actionId, []);
        }
        completionsByAction.get(act.actionId)!.push(act.userId);
      } else {
        if (!withdrawalsByAction.has(act.actionId)) {
          withdrawalsByAction.set(act.actionId, new Set());
        }
        withdrawalsByAction.get(act.actionId)!.add(act.userId);
      }
    }

    // 3. Per-action assembly
    const result = new Map<number, number[]>();
    for (const action of actions) {
      const baseUsers = baseUsersByAction.get(action.id);
      if (!baseUsers) {
        result.set(action.id, []);
        continue;
      }

      const notAwayDuringMemberActionPhase = baseUsers.filter(
        (user) => !computeIsAwayDuringWindow({ action, user }),
      );

      const withdrawals = withdrawalsByAction.get(action.id) ?? new Set();
      const completions = completionsByAction.get(action.id) ?? [];

      const notAwayUsersMinusWithdrawals =
        notAwayDuringMemberActionPhase.filter(
          (user) => !withdrawals.has(user.id),
        );
      const set = new Set([
        ...notAwayUsersMinusWithdrawals.map((user) => user.id),
        ...completions,
      ]);

      result.set(action.id, Array.from(set));
    }

    return result;
  }

  async findIncompleteUsersForAction(actionId: number): Promise<User[]> {
    const action = parseAction(
      await this.actionRepository.findOneOrFail({
        where: { id: actionId },
        relations: {
          events: true,
          activities: true,
        },
      }),
    );

    const joinedUserIds = await this.findParticipantIdsForAction(action);

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

  async findCompletedUsersForAction(actionId: number): Promise<User[]> {
    const completedActivities = await this.actionActivityRepository.find({
      where: {
        actionId,
        type: ActionActivityType.USER_COMPLETED,
      },
      select: { userId: true },
    });
    const completedUserIds = completedActivities.map((a) => a.userId);

    if (completedUserIds.length === 0) {
      return [];
    }

    return this.userService.findByIds(completedUserIds);
  }

  async findUnwelcomedSignedContractMembers(): Promise<
    UnwelcomedSignedContractMember[]
  > {
    const rows = await this.actionActivityRepository.query<
      {
        userId: number | string;
        actionId: number | string;
        activityId: number | string;
        completedAt: Date | string;
        signedAt: Date | string;
        staffLikeCount: number | string;
      }[]
    >(
      `
        SELECT
          activity."userId" AS "userId",
          action.id AS "actionId",
          activity.id AS "activityId",
          activity."createdAt" AS "completedAt",
          MAX(contract_event.date) AS "signedAt",
          COUNT(DISTINCT staff_liker.id) AS "staffLikeCount"
        FROM action_activity activity
        INNER JOIN action
          ON action.id = activity."actionId"
          AND action."isContractSigningAction" = true
        INNER JOIN contract_event
          ON contract_event."userId" = activity."userId"
          AND contract_event.type = $1
        LEFT JOIN comment staff_comment
          ON staff_comment."parentObjectType" = $2
          AND staff_comment."parentObjectId" = activity.id
          AND staff_comment.deleted = false
        LEFT JOIN "user" staff_comment_author
          ON staff_comment_author.id = staff_comment."authorId"
          AND staff_comment_author.staff = true
        LEFT JOIN action_activity_likes_user activity_like
          ON activity_like."actionActivityId" = activity.id
        LEFT JOIN "user" staff_liker
          ON staff_liker.id = activity_like."userId"
          AND staff_liker.staff = true
        WHERE activity.type = $3
        GROUP BY activity.id, activity."userId", action.id
        HAVING COUNT(staff_comment_author.id) = 0
        ORDER BY MAX(contract_event.date) DESC
      `,
      [
        ContractEventType.SIGNED,
        CommentParentObject.Activity,
        ActionActivityType.USER_COMPLETED,
      ],
    );

    const users = await this.userService.findByIds(
      rows.map((row) => Number(row.userId)),
      { contractEvents: true },
    );
    const usersById = new Map(users.map((user) => [user.id, user]));

    return rows.flatMap((row) => {
      const user = usersById.get(Number(row.userId));
      if (!user) return [];
      return {
        user,
        actionId: Number(row.actionId),
        activityId: Number(row.activityId),
        signedAt: new Date(row.signedAt),
        completedAt: new Date(row.completedAt),
        staffLikeCount: Number(row.staffLikeCount),
      };
    });
  }

  /**
   * Cohort-expression result for the viewer on one action — the single
   * evaluation feeding `canParticipate`/`viewer.canComplete`,
   * `shouldParticipate`, and `viewer`. No member-action-phase gate: the
   * completion rule (unlike assignment) applies to actions whose phase isn't
   * scheduled yet, and gating here made `viewer.canComplete` disagree with
   * `isCompletionAllowed` (which the complete mutation enforces). Dismissal
   * deliberately does not skip it either: `viewer.assigned` treats dismissal
   * as an overlay, so it needs the real cohort result.
   */
  private async computeViewerInCohort(params: {
    action: ParsedAction;
    user: User | null;
  }): Promise<boolean> {
    const { action, user } = params;
    return user
      ? await this.computeIsInCohortExpression({
          user,
          cohortExpression: action.cohortExpression,
        })
      : false;
  }

  async findMemberPublic(
    userId?: number,
    sorted?: boolean,
  ): Promise<ActionDto[]> {
    const relations: Omit<Relations<Action>, 'usersCompleted' | 'status'> = {
      events: true,
      followUpForms: true,
    };
    const actions = sorted
      ? await this.findAllSorted(relations)
      : await this.actionRepository
          .find({ relations })
          .then((rows) => rows.map(parseAction));

    const user = userId
      ? await this.userService.findOne(userId, {
          tags: true,
          awayRanges: true,
          contractEvents: true,
          activities: true,
        })
      : null;

    const filtered: ParsedAction[] = [];
    for (const action of actions) {
      if ((await this.userCanSeeAction(action, user)) && !action.publicOnly) {
        filtered.push(action);
      }
    }

    await this.applyAssignedFormIds(filtered, user?.id);

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

    // Index viewer's activities once, rather than rescanning per action.
    const userActivities = user ? new CachedFilter(user.activities!) : null;

    const now = new Date();

    return await Promise.all(
      filtered.map(async (action) => {
        const inCohort = await this.computeViewerInCohort({ action, user });
        const shouldParticipate = computeIsAssignedToAction({
          action,
          user,
          inCohort,
          dismissed: actionsDismissed.has(action.id),
        });

        if (user && action.followUpForms) {
          action.followUpForms = await this.filterFollowUpFormsByCohort(
            action.followUpForms.map(parseFollowUpForm),
            user,
          );
        }

        return new ActionDto(action, {
          canParticipate: user
            ? computeCanCompleteAction({ action, user, inCohort })
            : false,
          shouldParticipate,
          userRelation:
            user && userActivities
              ? resolveUserActionRelation({
                  activities: userActivities,
                  userId: user.id,
                  actionId: action.id,
                })
              : undefined,
          awayStatus: user
            ? computeMemberActionAwayStatus({ action, user, now })
            : undefined,
          viewer:
            user && userActivities
              ? resolveUserActionStatus({
                  action,
                  user,
                  inCohort,
                  activities: userActivities.filtered({
                    userId: user.id,
                    actionId: action.id,
                  }),
                  now,
                })
              : undefined,
          reqAuthenticated: !!user,
        });
      }),
    );
  }

  async findPublicOnly(): Promise<ActionDto[]> {
    const relations: Omit<Relations<Action>, 'usersCompleted' | 'status'> = {
      events: true,
      followUpForms: true,
    };

    const filterActions = (action: Action) =>
      action.visibilityMode === VisibilityMode.Public &&
      action.status !== ActionStatus.Draft &&
      !action.onboarding &&
      !action.archived;

    const actions = await this.findAllSorted(relations);

    const filteredActions = actions.filter(filterActions);

    return filteredActions.map(
      (action) =>
        new ActionDto(action, {
          canParticipate: false,
          shouldParticipate: false,
          reqAuthenticated: false,
        }),
    );
  }

  async userCanSeeAction(
    action: ParsedAction,
    user: User | null,
  ): Promise<boolean> {
    if (user?.admin) {
      return true;
    }
    if (action.status === ActionStatus.Draft || action.archived) {
      return false;
    }
    if (action.visibilityMode === VisibilityMode.Public) {
      return true;
    }

    if (!user) {
      return false;
    }
    if (action.visibilityMode === VisibilityMode.AllMembers) {
      return true;
    }

    if (!action.cohortExpression) {
      return false;
    }

    return this.computeIsInCohortExpression({
      user,
      cohortExpression: action.cohortExpression,
    });
  }

  async findOneOrFail(params: {
    id: number;
    userId?: number;
    serverSide?: boolean;
    /**
     * Admin surfaces need the unpublished updates they are about to write —
     * everything else gets the member-visible set, so a new caller is safe by
     * default rather than by remembering to filter.
     */
    includeUnpublishedUpdates?: boolean;
  }): Promise<ParsedAction> {
    const {
      id,
      userId,
      serverSide = false,
      includeUnpublishedUpdates = false,
    } = params;

    const user = userId
      ? await this.userService.findOne(userId, {
          tags: true,
          contractEvents: true,
          awayRanges: true,
        })
      : null;
    const fetched = await this.actionRepository.findOne({
      where: { id },
      relations: {
        events: true,
        activities: true,
        updates: { schemaSnapshot: true },
        suite: true,
        authors: true,
        followUpForms: { form: true },
      },
    });
    const action = fetched ? parseAction(fetched) : null;

    if (action && !includeUnpublishedUpdates) {
      const now = new Date();
      action.updates = action.updates?.filter((update) =>
        isActionUpdatePublished(update, now),
      );
    }

    if (action?.publicOnly) {
      return action;
    }

    if (
      !action ||
      !((await this.userCanSeeAction(action, user)) || serverSide)
    ) {
      throw new NotFoundException('Action not found');
    }
    return action;
  }

  async findOneDto(
    id: number,
    userId?: number,
    serverSide = false,
  ): Promise<ActionDto> {
    const action = await this.findOneOrFail({ id, userId, serverSide });
    const user = userId
      ? await this.userService.findOne(userId, {
          tags: true,
          contractEvents: true,
          awayRanges: true,
        })
      : null;
    if (user && action.followUpForms) {
      action.followUpForms = await this.filterFollowUpFormsByCohort(
        action.followUpForms.map(parseFollowUpForm),
        user,
      );
    }
    if (userId) {
      await this.applyAssignedFormIds([action], userId);
    }

    const activities = user
      ? await this.actionActivityRepository.find({
          where: { action: { id: action.id }, user: { id: user.id } },
        })
      : [];
    const dismissed = activities.some(
      (activity) => activity.type === ActionActivityType.USER_DISMISSED,
    );
    const inCohort = await this.computeViewerInCohort({ action, user });
    const now = new Date();

    return new ActionDto(action, {
      canParticipate: user
        ? computeCanCompleteAction({ action, user, inCohort })
        : false,
      shouldParticipate: computeIsAssignedToAction({
        action,
        user,
        inCohort,
        dismissed,
      }),
      userRelation: user
        ? resolveUserActionRelation({
            activities: new CachedFilter(activities),
            userId: user.id,
            actionId: action.id,
          })
        : undefined,
      awayStatus: user
        ? computeMemberActionAwayStatus({ action, user, now })
        : undefined,
      viewer: user
        ? resolveUserActionStatus({ action, user, inCohort, activities, now })
        : undefined,
      reqAuthenticated: !!user,
    });
  }

  async getSharePreview(
    actionId: number,
    shareCode?: string,
  ): Promise<ActionSharePreview> {
    // Match public action visibility before exposing referrer completion state.
    await this.findOneOrFail({ id: actionId });

    const trimmedCode = shareCode?.trim();
    if (!trimmedCode) {
      return { completedByReferrer: false, validReferral: false };
    }

    const shareUrl = await this.shareUrlsService.findActionShareByActionAndSid(
      actionId,
      trimmedCode,
    );

    // Campaign-owned action share links have no referring user.
    if (shareUrl?.campaign) {
      return {
        firstName: shareUrl.campaign.name,
        completedByReferrer: false,
        validReferral: true,
      };
    }

    if (!shareUrl?.user) {
      return { completedByReferrer: false, validReferral: false };
    }

    return {
      firstName: this.getFirstNameForSharePreview(shareUrl.user),
      completedByReferrer:
        (await this.getActionRelation(actionId, shareUrl.user.id)) ===
        UserActionRelation.Completed,
      validReferral: true,
    };
  }

  async getOrCreateActionReferralCode(
    actionId: number,
    userId: number,
  ): Promise<string> {
    const shareUrl = await this.shareUrlsService.getOrCreateForAction(
      actionId,
      {
        type: 'user',
        userId,
      },
    );
    if (!shareUrl.sid) {
      throw new BadRequestException('Unable to create share code');
    }
    return shareUrl.sid;
  }

  private getFirstNameForSharePreview(
    user: Pick<User, 'anonymous' | 'name'>,
  ): string {
    if (user.anonymous) {
      return 'Someone';
    }

    return user.name.trim().split(/\s+/)[0] || 'Someone';
  }

  async findAllGeneralUpdates(): Promise<GeneralUpdate[]> {
    const now = new Date();
    return (
      await this.generalUpdateRepository.find({
        where: {
          startDate: LessThan(now),
        },
        relations: { schemaSnapshot: true },
      })
    ).sort(startDatePriorityComparator);
  }

  async findAllGeneralUpdatesAdmin(): Promise<GeneralUpdate[]> {
    return (
      await this.generalUpdateRepository.find({
        relations: { schemaSnapshot: true, tags: true, suites: true },
      })
    ).sort(startDatePriorityComparator);
  }

  async findOneGeneralUpdate(
    id: number,
    em?: EntityManager,
  ): Promise<GeneralUpdate> {
    const manager = em ?? this.generalUpdateRepository.manager;
    return await manager.findOneOrFail(GeneralUpdate, {
      where: { id },
      relations: { schemaSnapshot: true, tags: true, suites: true },
    });
  }

  private parseDisplayOnlySchemaOrThrow(schema: unknown): DisplayOnlySchema {
    const parsed = displayOnlySchema.safeParse(schema);
    if (!parsed.success) {
      throw new BadRequestException(displayOnlySchemaError(parsed.error));
    }
    return parsed.data;
  }

  // The expected snapshot id is required, not optional: an unguarded schema
  // write is exactly the silent overwrite this path exists to reject.
  private async writeSchemaOrThrow(params: {
    owner: SnapshotHistoryOwner;
    id: number;
    schema: unknown;
    expectedSchemaSnapshotId: number;
    em: EntityManager;
  }): Promise<{ snapshotId: number; schema: DisplayOnlySchema }> {
    const { owner, id, expectedSchemaSnapshotId, em } = params;
    const target = SCHEMA_WRITE_TARGETS[owner];
    if (!target) {
      throw new Error(`${owner} has no editable display-only schema`);
    }
    const schema = this.parseDisplayOnlySchemaOrThrow(params.schema);
    const snapshot = await this.formSnapshotService.findOrCreate(schema, em);

    const result = await em
      .createQueryBuilder()
      .update(target.entity)
      .set({ schemaSnapshotId: snapshot.id })
      .where('id = :id', { id })
      .andWhere('"schemaSnapshotId" = :expectedSchemaSnapshotId', {
        expectedSchemaSnapshotId,
      })
      .execute();

    if (result.affected === 0) {
      throw new ConflictException(target.conflictMessage);
    }

    await this.formSnapshotService.recordHistorical({
      owner,
      ownerId: id,
      snapshotId: snapshot.id,
      em,
    });

    return { snapshotId: snapshot.id, schema };
  }

  async createGeneralUpdate(
    dto: CreateGeneralUpdateDto,
  ): Promise<GeneralUpdate> {
    const { tagIds, suiteIds, ...rest } = dto;
    const emptySnapshot = await this.formSnapshotService.findOrCreate(
      emptyDisplayOnlySchema(),
    );
    const generalUpdate = this.generalUpdateRepository.create({
      ...rest,
      schemaSnapshotId: emptySnapshot.id,
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

    await this.formSnapshotService.recordHistorical({
      owner: SnapshotHistoryOwner.GeneralUpdate,
      ownerId: saved.id,
      snapshotId: emptySnapshot.id,
    });

    await this.shiftPrioritiesAfterInsertion();
    if (generalUpdate.suites) {
      await this.syncGeneralUpdateDatesForSuites(
        generalUpdate.suites.map((suite) => suite.id),
      );
    }

    return this.findOneGeneralUpdate(saved.id);
  }

  async updateGeneralUpdate(
    id: number,
    dto: UpdateGeneralUpdateDto,
  ): Promise<GeneralUpdate> {
    const { tagIds, suiteIds, schema, expectedSchemaSnapshotId, ...rest } = dto;

    // Guards non-HTTP callers too, where the DTO's `@ValidateIf` never runs.
    const schemaWrite = run(() => {
      if (schema === undefined) return null;
      if (expectedSchemaSnapshotId === undefined) {
        throw new BadRequestException(
          'expectedSchemaSnapshotId is required when writing schema',
        );
      }
      return { schema, expectedSchemaSnapshotId };
    });

    // Keep the entity, relation, and guarded schema writes atomic. The row lock
    // is taken before the read and covers metadata-only writes too: `save`
    // below re-reads the row and writes back every column that differs from the
    // entity loaded here, so an unlocked read-modify-write would revert a
    // concurrent schema save. Locking here rather than in `writeSchemaOrThrow`
    // is what makes that read current. (`findOneOrFail` can't take the lock
    // itself — its `relations` become LEFT JOINs, and Postgres rejects FOR
    // UPDATE on the nullable side of an outer join.)
    const affectedSuiteIds =
      await this.generalUpdateRepository.manager.transaction(async (em) => {
        await em.query(
          'SELECT id FROM general_update WHERE id = $1 FOR UPDATE',
          [id],
        );
        const generalUpdate = await this.findOneGeneralUpdate(id, em);

        if (schemaWrite) {
          const written = await this.writeSchemaOrThrow({
            owner: SnapshotHistoryOwner.GeneralUpdate,
            id,
            ...schemaWrite,
            em,
          });
          generalUpdate.schemaSnapshotId = written.snapshotId;
          // The loaded relation still holds the previous snapshot, and TypeORM
          // lets a relation object win over the FK column — leaving it set would
          // make the `save` below write the old id straight back over the one
          // just written.
          generalUpdate.schemaSnapshot = undefined;
        }

        Object.assign(generalUpdate, rest);

        if (tagIds !== undefined) {
          generalUpdate.tags =
            tagIds.length > 0 ? await em.findBy(Tag, { id: In(tagIds) }) : [];
        }

        if (suiteIds !== undefined) {
          generalUpdate.suites =
            suiteIds.length > 0
              ? await em.findBy(ActionSuite, { id: In(suiteIds) })
              : [];
        }

        await em.save(generalUpdate);

        return generalUpdate.suites?.map((suite) => suite.id) ?? [];
      });

    // Deliberately after the commit: this rewrites every general update in the
    // suite, and holding those rows alongside the one the transaction already
    // locked lets two admins editing the same suite take the same locks in
    // opposite orders and deadlock. The dates are derived from the suite's
    // events, so they don't need to land atomically with the save.
    await this.syncGeneralUpdateDatesForSuites(affectedSuiteIds);

    return this.findOneGeneralUpdate(id);
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

    const isDateChanged = (current?: Date, next?: Date): boolean =>
      next !== undefined && current?.getTime() !== next.getTime();

    const dateUpdates = generalUpdates.flatMap((generalUpdate) => {
      const action = generalUpdate.suites![0]?.actions![0];
      if (!action) {
        return [];
      }
      const startDate = action.memberActionPhase.event?.date;
      const endDate = action.memberActionPhase.deadlineEvent?.date;
      if (
        !isDateChanged(generalUpdate.startDate, startDate) &&
        !isDateChanged(generalUpdate.endDate, endDate)
      ) {
        return [];
      }
      return [{ id: generalUpdate.id, startDate, endDate }];
    });

    // Writes only the two date columns rather than saving the whole entity: a
    // concurrent editor may have replaced `schemaSnapshotId` since the read
    // above, and `save` diffs against the entity loaded here, so it would write
    // the stale id back over theirs.
    await Promise.all(
      dateUpdates.map(({ id, ...dates }) =>
        this.generalUpdateRepository.update(id, dates),
      ),
    );
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
        schemaSnapshot: true,
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
          onboarding: false,
          memberActionEventDate: update.startDate,
          memberActionEventDeadline: update.endDate,
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

  async getActionRelation(
    actionId: number,
    userId: number,
  ): Promise<UserActionRelation> {
    const activities = await this.actionActivityRepository.find({
      where: { action: { id: actionId }, user: { id: userId } },
    });
    return resolveUserActionRelation({
      activities: new CachedFilter(activities),
      userId,
      actionId,
    });
  }

  async dismissAction(
    userId: number,
    actionId: number,
  ): Promise<ActionActivity> {
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
    isMoral?: boolean;
    adminCreated?: boolean;
  }): Promise<ActionActivity> {
    const {
      actionId,
      userId,
      type,
      taskFormResponse,
      declineReason,
      isOutOfTime,
      isMoral,
      adminCreated,
    } = options;
    const action = await this.findOneOrFail({ id: actionId, userId });

    if (
      type === ActionActivityType.USER_WONT_COMPLETE &&
      action.isContractSigningAction &&
      !adminCreated
    ) {
      throw new BadRequestException(
        'Contract signing actions cannot be withdrawn from',
      );
    }

    if (type === ActionActivityType.USER_COMPLETED && !adminCreated) {
      await this.ensureCompletionAllowed(action, userId);
    }

    const user = await this.userService.findOneOrFail(userId);

    if (!ALLOW_DUPLICATE[type]) {
      const existingActivity = await this.actionActivityRepository.findOne({
        where: { actionId, userId, type },
      });
      if (existingActivity) {
        throw new BadRequestException('Activity already exists');
      }
    }

    const activity = this.actionActivityRepository.create({
      type: type,
      actionId: actionId,
      userId: userId,
      action: action,
      user: user,
      taskFormResponse,
      declineReason,
      outOfTime: isOutOfTime,
      isMoral,
      source: adminCreated
        ? ActivitySource.ADMIN_OVERRIDE
        : ActivitySource.USER,
    });
    const savedActivity = await this.actionActivityRepository.save(activity);

    if (type === ActionActivityType.USER_WONT_COMPLETE) {
      const option = withdrawalOptionFromFlags({
        outOfTime: isOutOfTime ?? false,
        isMoral: isMoral ?? false,
      });
      const trimmedReason = declineReason?.trim();
      // Spread to code points so truncation can't split a surrogate pair
      // (e.g. an emoji) at the boundary.
      const reasonChars = trimmedReason ? [...trimmedReason] : [];
      const reason =
        reasonChars.length > OPT_OUT_REASON_PREVIEW_LENGTH
          ? `${reasonChars.slice(0, OPT_OUT_REASON_PREVIEW_LENGTH).join('')}...`
          : trimmedReason;
      const label = adminCreated
        ? 'admin-created'
        : WITHDRAWAL_OPTION_LABELS[option];
      const detail = reason ? `${label}: ${reason}` : label;
      this.eventLogService.sendMessage({
        type: EventType.ActionOptOut,
        message: `${user.name} opted out of action ${action.name} (${detail})`,
        userId,
        blob: {
          actionId,
          declineReason,
          outOfTime: isOutOfTime,
          isMoral,
          adminCreated: adminCreated ?? false,
        },
      });
    }

    this.eventEmitter.emit('action.activity', {
      actionId,
      activity: new ActionActivityDto(savedActivity),
    });

    await this.reloadUsersJoinedForAction(actionId);
    if (type === ActionActivityType.USER_COMPLETED) {
      await this.reloadUsersCompletedForAction(actionId);
      await this.liveActivityService.updateCompletionCount(actionId);
    }

    return savedActivity;
  }

  async withdrawFromAction(
    actionId: number,
    userId: number,
    withdrawal: { reason: string; outOfTime: boolean; isMoral: boolean },
  ): Promise<ActionActivity> {
    if (!withdrawalHasRequiredReason(withdrawal)) {
      throw new BadRequestException('A withdrawal reason is required');
    }
    return this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_WONT_COMPLETE,
      declineReason: withdrawal.reason,
      isOutOfTime: withdrawal.outOfTime,
      isMoral: withdrawal.isMoral,
    });
  }

  async completeAction(
    actionId: number,
    userId: number,
    options: {
      taskFormResponse?: FormResponse;
      adminCreated?: boolean;
    } = {},
  ): Promise<ActionActivity> {
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
  ): Promise<Action> {
    const action: DeepPartial<Action> | null =
      await this.actionRepository.findOne({
        where: { id },
        relations: {
          authors: true,
          suite: true,
        },
      });

    if (!action) {
      throw new NotFoundException('Action not found');
    }
    const oldSuiteId = action.suite?.id;

    const { suiteId, authorIds, ...rest } = updateActionDto;
    if (rest.cohortExpression != null) {
      rest.cohortExpression = this.parseCohortExpressionOrThrow(
        rest.cohortExpression,
      );
    }

    if (
      rest.taskFormId !== undefined &&
      rest.taskFormId !== action.taskFormId
    ) {
      await this.assertFormIdNotUsedAsVariant(rest.taskFormId);
    }

    action.suite = {
      id: suiteId ?? undefined,
    };

    if (authorIds !== undefined) {
      action.authors = authorIds.length
        ? await this.userService.findByIds(authorIds)
        : [];
    }

    Object.assign(action, rest);

    await this.actionRepository.save(action);
    const newSuiteId = action.suite?.id;
    await this.syncGeneralUpdateDatesForSuites([oldSuiteId, newSuiteId]);

    return this.findOneOrFail({ id, userId });
  }

  async addEvent(
    actionId: number,
    actionEventDto: CreateActionEventDto,
    userId?: number,
  ): Promise<ActionEvent> {
    const action = await this.findOneOrFail({ id: actionId, userId });
    const [savedEvent] = await this.addEventToActions({
      actions: [action],
      event: actionEventDto,
    });
    return savedEvent;
  }

  private async addEventToActions(params: {
    actions: Action[];
    event: CreateActionEventDto;
    overrides?: Partial<ActionEvent>;
    suiteIds?: number[];
  }): Promise<ActionEvent[]> {
    const { actions, event, overrides, suiteIds } = params;
    let saved: ActionEvent[];
    try {
      saved = await this.actionEventRepository.manager.transaction(
        async (manager) => {
          const events: ActionEvent[] = [];
          for (const action of actions) {
            const newEvent = manager.create(ActionEvent, {
              ...event,
              ...overrides,
              action,
            });
            events.push(await manager.save(newEvent));
          }
          return events;
        },
      );
    } catch (err) {
      if (
        err?.code === '23505' &&
        err?.constraint === 'UQ_action_event_one_member_action'
      ) {
        throw new BadRequestException(
          'An action can only have one member_action event',
        );
      }
      throw err;
    }

    for (const action of actions) {
      await this.reloadUsersJoinedForAction(action.id);
    }

    await this.syncGeneralUpdateDatesForSuites(
      suiteIds ?? [
        ...new Set(
          actions.map((a) => a.suite?.id).filter((id) => id !== undefined),
        ),
      ],
    );

    return saved;
  }

  async remove(id: number) {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: { suite: true },
    });
    await this.actionRepository.delete(id);
    await this.syncGeneralUpdateDatesForSuites([action?.suite?.id]);
  }

  async createFollowUpForm(
    actionId: number,
    dto: CreateFollowUpFormDto,
  ): Promise<FollowUpForm> {
    if (dto.cohortExpression != null) {
      dto.cohortExpression = this.parseCohortExpressionOrThrow(
        dto.cohortExpression,
      );
    }
    const action = await this.findOneOrFail({ id: actionId, serverSide: true });
    const form = await this.formRepository.findOneOrFail({
      where: { id: dto.formId },
    });
    const followUpForm = this.followUpFormRepository.create({
      action,
      form,
      ...dto,
      actionId,
    });
    return this.followUpFormRepository.save(followUpForm);
  }

  async updateFollowUpForm(
    followUpFormId: number,
    dto: UpdateFollowUpFormDto,
  ): Promise<FollowUpForm> {
    if (dto.cohortExpression != null) {
      dto.cohortExpression = this.parseCohortExpressionOrThrow(
        dto.cohortExpression,
      );
    }
    const followUpForm = await this.followUpFormRepository.findOneOrFail({
      where: { id: followUpFormId },
      relations: { form: true, action: true },
    });
    Object.assign(followUpForm, dto);
    return this.followUpFormRepository.save(followUpForm);
  }

  async deleteFollowUpForm(followUpFormId: number): Promise<void> {
    const followUpForm = await this.followUpFormRepository.findOne({
      where: { id: followUpFormId },
    });
    if (followUpForm) {
      await this.followUpFormRepository.remove(followUpForm);
    }
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
      where: {
        userId,
        type: In([
          ActionActivityType.USER_COMPLETED,
          ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM,
        ]),
      },
      relations: {
        action: true,
        user: true,
        editableContent: true,
        taskFormResponse: { formSnapshot: true },
      },
    });

    return this.toActivityDtos({ activities, requestingUserId, comments });
  }

  buildOutputFormResponse(activity: ActionActivity): FormResponse | undefined {
    if (!activity.taskFormResponse) {
      return undefined;
    }

    const schema = activity.taskFormResponse.formSnapshot
      .schema as unknown as FormSchema;

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

    return Object.assign(new FormResponse(), {
      ...activity.taskFormResponse,
      answers,
    });
  }

  async getActionActivities(
    actionId: number,
    limit?: number,
    comments?: boolean,
    requestingUserId?: number,
    before?: Date,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.fetchActivityFeed({
      limit: limit ?? 20,
      actionId,
      before,
    });

    return this.toActivityDtos({ activities, requestingUserId, comments });
  }

  /**
   * Adds public form response output on top of {@link toActivityDtos}, and
   * comments when `comments` is set. Used by the feeds that render activity
   * cards in full.
   */
  private async toDetailedActivityDtos(params: {
    activities: ActionActivity[];
    requestingUserId?: number;
    comments: boolean;
  }): Promise<ActionActivityDto[]> {
    const { activities, requestingUserId, comments: includeComments } = params;
    const activityIds = activities.map((activity) => activity.id);
    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(activityIds, requestingUserId)
      : new Set<number>();
    const facepiles = await this.facepileService.loadFacepiles(
      ActionActivity,
      activityIds,
    );

    const commentsByActivity = includeComments
      ? await this.forumService.findCommentsForActivities(activityIds)
      : null;

    return activities.map((activity) => {
      const comments = commentsByActivity?.get(activity.id) ?? [];
      return new ActionActivityDto(activity, {
        comments,
        formResponseOutput: activity.taskFormResponse
          ? this.buildOutputFormResponse(activity)
          : undefined,
        likedByMe: likedIds.has(activity.id),
        requestingUserId,
        facepile: facepiles(activity.id),
      });
    });
  }

  /** Feed activities with their bounded liker facepiles and liked-by-me state. */
  private async toActivityDtos(params: {
    activities: ActionActivity[];
    requestingUserId?: number;
    comments?: boolean;
  }): Promise<ActionActivityDto[]> {
    const { activities, requestingUserId, comments } = params;
    if (activities.length === 0) {
      return [];
    }
    if (comments) {
      return this.toDetailedActivityDtos({
        activities,
        requestingUserId,
        comments: true,
      });
    }

    const activityIds = activities.map((activity) => activity.id);
    const likedIds = requestingUserId
      ? await this.getLikedActivityIds(activityIds, requestingUserId)
      : new Set<number>();
    const facepiles = await this.facepileService.loadFacepiles(
      ActionActivity,
      activityIds,
    );

    return activities.map(
      (activity) =>
        new ActionActivityDto(activity, {
          likedByMe: likedIds.has(activity.id),
          facepile: facepiles(activity.id),
        }),
    );
  }

  /**
   * Shared helper to run optimized activity feed queries.
   * Only selects the fields needed for ActionActivityDto to minimize data transfer.
   */
  private fetchActivityFeed(options: {
    limit: number;
    before?: Date;
    userIds?: number[];
    actionId?: number;
    communityId?: number;
    requireFormResponse?: boolean;
  }) {
    const qb = this.actionActivityRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.action', 'action')
      .leftJoinAndSelect('activity.editableContent', 'editableContent')
      .leftJoinAndSelect('activity.taskFormResponse', 'taskFormResponse')
      .leftJoinAndSelect('taskFormResponse.formSnapshot', 'taskFormSnapshot')
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
        'taskFormResponse.formSnapshotId',
        'taskFormResponse.visibilityValidatorResults',
        'taskFormResponse.deviceType',
        'taskFormSnapshot.id',
        'taskFormSnapshot.schema',
      ])
      .loadRelationIdAndMap('user.leaderOfIds', 'user.leaderOf')
      .where('activity.type IN (:...types)', {
        types: ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
      })
      .orderBy('activity.createdAt', 'DESC')
      .take(options.limit);

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

    if (options.requireFormResponse) {
      qb.andWhere('taskFormResponse.id IS NOT NULL');
    }

    return qb.getMany();
  }

  async getActivityFeed(
    limit: number = 20,
    before?: Date,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const activities = await this.fetchActivityFeed({
      limit,
      before,
    });

    return this.toActivityDtos({ activities, requestingUserId, comments });
  }

  async isCompletionAllowed(
    action: ParsedAction,
    user: User,
  ): Promise<boolean> {
    // preventCompletion short-circuits before the DB-hitting cohort
    // evaluation; the rule itself lives in computeCanCompleteAction.
    if (action.preventCompletion) {
      return false;
    }

    const inCohort = await this.computeIsInCohortExpression({
      user,
      cohortExpression: action.cohortExpression,
    });

    return computeCanCompleteAction({ action, user, inCohort });
  }

  async ensureCompletionAllowed(action: ParsedAction, userId: number) {
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      contractEvents: true,
      awayRanges: true,
    });
    if (!(await this.isCompletionAllowed(action, user))) {
      throw new ForbiddenException('This action is not available to you');
    }
  }

  async clearDb() {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    await this.actionActivityRepository.delete({});
    await this.actionEventRepository.delete({});
    await this.actionRepository.delete({});
  }

  async getActivityForUser(userId: number): Promise<ActionActivity[]> {
    return this.actionActivityRepository.find({
      where: {
        user: { id: userId },
      },
      relations: { action: true, user: true, editableContent: true },
    });
  }

  async friendActivity(
    userId: number,
    comments?: boolean,
    limit?: number,
    before?: Date,
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

    const friendActivities = await this.fetchActivityFeed({
      limit: limit ?? 20,
      before,
      userIds: friends.map((f) => f.id),
    });

    return this.toActivityDtos({
      activities: friendActivities,
      requestingUserId: userId,
      comments,
    });
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

    const friendActivities = await this.fetchActivityFeed({
      limit: limit ?? 20,
      userIds: friends.map((f) => f.id),
      actionId,
    });

    return this.toActivityDtos({
      activities: friendActivities,
      requestingUserId: userId,
      comments,
    });
  }

  async communityActivity(
    limitNum: number = 20,
    beforeDate: Date | undefined,
    communityId: number,
    comments?: boolean,
    requestingUserId?: number,
  ): Promise<ActionActivityDto[]> {
    const community = await this.communityService.findOneOrFail(communityId);

    const members = community.users ?? [];

    if (members.length === 0) {
      return [];
    }

    const memberActivities = await this.fetchActivityFeed({
      limit: limitNum,
      before: beforeDate,
      userIds: members.map((m) => m.id),
    });

    return this.toActivityDtos({
      activities: memberActivities,
      requestingUserId,
      comments,
    });
  }

  async countCommunityCompletedActions(
    userId: number,
    communityId: number,
  ): Promise<number> {
    const memberRow = await this.communityRepository
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .innerJoin(
        'community_users_user',
        'cuu',
        'cuu."communityId" = c.id AND cuu."userId" = :userId',
        { userId },
      )
      .where('c.id = :communityId', { communityId })
      .getRawOne<{ id: number }>();

    if (!memberRow) {
      await this.communityRepository.findOneOrFail({
        where: { id: communityId },
        select: { id: true },
      });
      throw new NotFoundException('User is not a member of this community');
    }

    return this.actionActivityRepository
      .createQueryBuilder('activity')
      .innerJoin(
        'community_users_user',
        'cuu',
        'cuu."userId" = activity.userId AND cuu."communityId" = :communityId',
        { communityId },
      )
      .where('activity.type = :type', {
        type: ActionActivityType.USER_COMPLETED,
      })
      .getCount();
  }

  async homeFeed(
    userId: number,
    limit: number = 20,
    before?: Date,
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const [friends, user] = await Promise.all([
      this.userService.findFriends(userId),
      this.userService.findOne(userId, { communities: true }),
    ]);
    if (!user) throw new NotFoundException('User not found');

    const friendIds = friends.map((f) => f.id);
    const communityIds = (user.communities ?? []).map((c) => c.id);
    const userClusterId = user.clusterId;

    // Get community member IDs in batch
    const communityMemberIds = new Set<number>();
    if (communityIds.length > 0) {
      const communities = await Promise.all(
        communityIds.map((id) => this.communityService.findOneOrFail(id)),
      );
      for (const community of communities) {
        for (const member of community.users ?? []) {
          communityMemberIds.add(member.id);
        }
      }
    }

    const allUserIds = [
      ...new Set([...friendIds, ...communityMemberIds, userId]),
    ];

    const forumComments = await this.forumService.findForumCommentsForFeed({
      userId,
      userClusterId,
      friendAndGroupMemberIds: allUserIds,
      limit,
      before,
    });
    const forumCommentItems: HomeFeedItem[] = forumComments.map((fc) => ({
      type: HomeFeedItemType.ForumComment,
      date: fc.comment.createdAt,
      forumComment: fc,
    }));
    const forumCommentDateMs = forumCommentItems
      .map((c) => c.date.getTime())
      .sort((a, b) => b - a);

    const batchSize = limit * 2;
    const contentful: ActionActivity[] = [];
    let cursor = before;

    while (contentful.length < limit && allUserIds.length > 0) {
      const batch = await this.fetchActivityFeed({
        limit: batchSize,
        before: cursor,
        userIds: allUserIds,
        requireFormResponse: true,
      });

      for (const a of batch) {
        if (this.buildOutputFormResponse(a) !== undefined) {
          contentful.push(a);
          if (contentful.length >= limit) break;
        }
      }

      if (batch.length < batchSize) break;

      cursor = batch[batch.length - 1].createdAt;

      const cursorMs = cursor.getTime();
      const commentsNewerThanCursor = forumCommentDateMs.filter(
        (d) => d > cursorMs,
      ).length;
      if (contentful.length + commentsNewerThanCursor >= limit) break;
    }

    const activityDtos = await this.toDetailedActivityDtos({
      activities: contentful,
      requestingUserId: userId,
      comments: !!comments,
    });

    const activityItems = activityDtos.map(
      (activity): HomeFeedItem => ({
        type: HomeFeedItemType.Activity,
        date: activity.createdAt,
        activity,
      }),
    );

    const merged: HomeFeedItem[] = [...activityItems, ...forumCommentItems];
    merged.sort((a, b) => b.date.getTime() - a.date.getTime());

    return merged.slice(0, limit).map((item) => new HomeFeedItemDto(item));
  }

  async userFeed(
    userId: number,
    requestingUserId?: number,
    limit: number = 20,
    before?: Date,
    comments?: boolean,
  ): Promise<HomeFeedItemDto[]> {
    const [activities, forumComments] = await Promise.all([
      this.actionActivityRepository.find({
        where: {
          userId,
          type: In([
            ActionActivityType.USER_COMPLETED,
            ActionActivityType.USER_SUBMITTED_FOLLOW_UP_FORM,
          ]),
          ...(before ? { createdAt: LessThan(before) } : {}),
        },
        relations: {
          action: true,
          user: true,
          taskFormResponse: { formSnapshot: true },
        },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.forumService.findForumCommentsByUserForFeed({
        authorId: userId,
        requestingUserId,
        limit,
        before,
      }),
    ]);

    const activityDtos = await this.toDetailedActivityDtos({
      activities,
      requestingUserId,
      comments: !!comments,
    });

    const activityItems = activityDtos.map(
      (activity): HomeFeedItem => ({
        type: HomeFeedItemType.Activity,
        date: activity.createdAt,
        activity,
      }),
    );
    const forumCommentItems: HomeFeedItem[] = forumComments.map((fc) => ({
      type: HomeFeedItemType.ForumComment,
      date: fc.comment.createdAt,
      forumComment: fc,
    }));

    const merged: HomeFeedItem[] = [...activityItems, ...forumCommentItems];
    merged.sort((a, b) => b.date.getTime() - a.date.getTime());

    return merged.slice(0, limit).map((item) => new HomeFeedItemDto(item));
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
        editableContent: true,
        taskFormResponse: { formSnapshot: true },
      },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return new ActionActivityDto(activity, {
      formResponseOutput: this.buildOutputFormResponse(activity),
      likedByMe: requestingUserId
        ? activity.likes?.some((like) => like.id === requestingUserId)
        : undefined,
    });
  }

  async getEvent(id: number): Promise<ActionEvent> {
    const event = await this.actionEventRepository.findOne({
      where: { id },
      relations: { action: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async likeActivity(
    id: number,
    userId: number,
    unlike = false,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: {
        user: true,
        action: true,
        likes: true,
        editableContent: true,
      },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    if (
      !GlobalFeedActivityTypes.includes(activity.type as GlobalFeedActivityType)
    ) {
      throw new BadRequestException('Activity type is not supported');
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
      relations: {
        user: true,
        action: true,
        likes: true,
        editableContent: true,
      },
    });
    if (!updatedActivity) {
      throw new NotFoundException('Activity not found');
    }

    if (createdLike && updatedActivity.user) {
      await this.likeNotificationService.createOrUpdate({
        owner: updatedActivity.user,
        liker: user,
        targetType: `activity:${updatedActivity.type as GlobalFeedActivityType}`,
        targetContent: updatedActivity.action.name,
        targetId: updatedActivity.id,
        webAppLocation: actionActivityUrl(
          updatedActivity.action?.id ?? updatedActivity.actionId,
          updatedActivity.id,
        ),
      });
    }

    if (removedLike && updatedActivity.user) {
      await this.likeNotificationService.removeOnUnlike({
        ownerId: updatedActivity.user.id,
        unlikerId: user.id,
        targetType: `activity:${updatedActivity.type as GlobalFeedActivityType}`,
        targetId: updatedActivity.id,
      });
    }

    return new ActionActivityDto(updatedActivity, {
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
    return new CommentDto(savedComment, { requestingUserId: userId });
  }

  async updateActivity(
    id: number,
    updateActivityDto: UpdateActionActivityDto,
    userId: number,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: {
        editableContent: true,
        taskFormResponse: {
          formSnapshot: true,
        },
      },
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
    const action = await this.findOneOrFail({ id, serverSide: true });
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
  ): Promise<ActionActivity> {
    return this.createActionActivity({
      actionId: activityDto.actionId,
      userId: activityDto.userId,
      type: activityDto.type,
      adminCreated: true,
    });
  }

  async archive(id: number): Promise<Action> {
    const action = await this.actionRepository.findOneOrFail({ where: { id } });
    action.archived = true;
    return this.actionRepository.save(action);
  }

  async unarchive(id: number): Promise<Action> {
    const action = await this.actionRepository.findOneOrFail({ where: { id } });
    action.archived = false;
    return this.actionRepository.save(action);
  }

  async createActionUpdate(
    id: number,
    createActionUpdateDto: CreateActionUpdateDto,
  ): Promise<ActionUpdate> {
    const action = await this.actionRepository.findOneOrFail({
      where: { id },
    });
    const emptySnapshot = await this.formSnapshotService.findOrCreate(
      emptyDisplayOnlySchema(),
    );

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
        schemaSnapshotId: emptySnapshot.id,
        visibleAt: null,
        action,
        tag,
        associatedEvent,
      }),
    );

    await this.formSnapshotService.recordHistorical({
      owner: SnapshotHistoryOwner.ActionUpdate,
      ownerId: actionUpdate.id,
      snapshotId: emptySnapshot.id,
    });

    // `notifyType` is only the plan here — the update is created empty, so
    // dispatching now would notify members about a body nobody has written yet.
    // It stays unpublished (`visibleAt` null) until the body is written, and
    // `notifyActionUpdate` sends it from the editor after that.
    return this.findOneActionUpdate(actionUpdate.id);
  }

  /**
   * Sends the notification an update was created with, after its body exists.
   * Once-only: the claim on `notifiedAt` is what makes a double-click, or two
   * admins on the same update, send one notification rather than two.
   */
  async notifyActionUpdate(id: number): Promise<ActionUpdate> {
    const actionUpdate = await this.findOneActionUpdate(id);
    const schema = displayOnlySchemaOf({
      owner: 'ActionUpdate',
      ownerId: actionUpdate.id,
      snapshot: actionUpdate.schemaSnapshot,
    });

    if (actionUpdate.notifyType === ActionUpdateNotifyType.None) {
      throw new BadRequestException(
        'This update has no notification audience set.',
      );
    }
    if (schema.blocks.length === 0) {
      throw new BadRequestException(
        'Write the update body before sending the notification.',
      );
    }
    if (actionUpdate.notifiedAt) {
      throw new ConflictException(
        'This update has already been notified about.',
      );
    }

    // Resolve the audience before claiming: a failure here (a deleted tag, say)
    // has sent nothing, and leaving the claim unset keeps the retry open.
    const recipients = await this.findActionUpdateNotifRecipients(actionUpdate);

    // The claim and the sends commit together. The claim is the only thing
    // standing between a retry and a second notification, so committing it
    // before the rows exist would let a crash partway through leave most of the
    // audience unnotified and unreachable: the retry would see the claim and
    // conflict.
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      const claimed = await em
        .createQueryBuilder()
        .update(ActionUpdate)
        .set({ notifiedAt: new Date() })
        .where('id = :id', { id })
        .andWhere('"notifiedAt" IS NULL')
        .execute();

      if (claimed.affected === 0) {
        throw new ConflictException(
          'This update has already been notified about.',
        );
      }

      await this.notifsService.createActionUpdateNotifs({
        actionUpdate,
        users: recipients,
        em,
      });
    });

    return this.findOneActionUpdate(id);
  }

  async findOneActionUpdate(
    id: number,
    em?: EntityManager,
  ): Promise<ActionUpdate> {
    const manager = em ?? this.actionUpdateRepository.manager;
    return manager.findOneOrFail(ActionUpdate, {
      where: { id },
      relations: {
        schemaSnapshot: true,
        action: true,
        tag: true,
        associatedEvent: true,
      },
    });
  }

  async updateActionUpdate(
    id: number,
    dto: UpdateActionUpdateDto,
  ): Promise<ActionUpdate> {
    const {
      schema,
      expectedSchemaSnapshotId,
      tagId,
      associatedEventId,
      ...rest
    } = dto;

    // Guards non-HTTP callers too, where the DTO's `@ValidateIf` never runs.
    const schemaWrite = run(() => {
      if (schema === undefined) return null;
      if (expectedSchemaSnapshotId === undefined) {
        throw new BadRequestException(
          'expectedSchemaSnapshotId is required when writing schema',
        );
      }
      return { schema, expectedSchemaSnapshotId };
    });

    // Same locking rationale as `updateGeneralUpdate`: `save` writes back every
    // column that differs from the entity read here, so an unlocked
    // read-modify-write would revert a concurrent schema save.
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      await em.query('SELECT id FROM action_update WHERE id = $1 FOR UPDATE', [
        id,
      ]);
      const actionUpdate = await this.findOneActionUpdate(id, em);

      if (schemaWrite) {
        const written = await this.writeSchemaOrThrow({
          owner: SnapshotHistoryOwner.ActionUpdate,
          id,
          ...schemaWrite,
          em,
        });
        actionUpdate.schemaSnapshotId = written.snapshotId;
        // The loaded relation still holds the previous snapshot, and TypeORM
        // lets a relation object win over the FK column — leaving it set would
        // make the `save` below write the old id straight back over the one
        // just written.
        actionUpdate.schemaSnapshot = undefined;

        // Writing a body is what publishes the update. Emptying one again
        // deliberately does not retract it: members may already have seen or
        // been notified about it, so unpublishing is an explicit act, not a
        // side effect of clearing the editor.
        if (actionUpdate.visibleAt === null && written.schema.blocks.length) {
          actionUpdate.visibleAt = new Date();
        }
      }

      Object.assign(actionUpdate, rest);

      if (tagId !== undefined) {
        actionUpdate.tag =
          tagId === null ? null : await em.findOneByOrFail(Tag, { id: tagId });
      }

      if (associatedEventId !== undefined) {
        actionUpdate.associatedEvent =
          associatedEventId === null
            ? null
            : await em.findOneByOrFail(ActionEvent, { id: associatedEventId });
      }

      await em.save(actionUpdate);
    });

    return this.findOneActionUpdate(id);
  }

  /**
   * Hides a published update again until its displayed date. Publishing stamps
   * `visibleAt` at the first body save, which is too early for an update
   * written ahead of the date it is about; moving `visibleAt` up to `date`
   * lets the `visibleAt <= now` gate republish it when that date arrives.
   */
  async unpublishActionUpdateUntilDate(id: number): Promise<ActionUpdate> {
    const actionUpdate = await this.findOneActionUpdate(id);
    const now = new Date();

    if (actionUpdate.visibleAt === null) {
      throw new BadRequestException('This update has not been published yet.');
    }
    if (actionUpdate.date <= now) {
      throw new BadRequestException(
        'The displayed date has already passed, so hiding the update until then would leave it visible.',
      );
    }

    // A targeted column write rather than a `save` of the entity read above,
    // so a concurrent schema save isn't written back over.
    await this.actionUpdateRepository.update(id, {
      visibleAt: actionUpdate.date,
    });

    return this.findOneActionUpdate(id);
  }

  /** Undoes `unpublishActionUpdateUntilDate` before the date it waits for. */
  async publishActionUpdateNow(id: number): Promise<ActionUpdate> {
    const actionUpdate = await this.findOneActionUpdate(id);
    const now = new Date();

    if (actionUpdate.visibleAt === null || actionUpdate.visibleAt <= now) {
      throw new BadRequestException(
        'This update is not waiting on a future date.',
      );
    }

    await this.actionUpdateRepository.update(id, { visibleAt: now });

    return this.findOneActionUpdate(id);
  }

  async deleteActionUpdate(id: number) {
    const actionUpdate = await this.actionUpdateRepository.findOneOrFail({
      where: { id },
    });
    await this.actionUpdateRepository.delete(id);
    return actionUpdate;
  }

  async getActionUpdates(limit?: number): Promise<ActionUpdate[]> {
    return this.actionUpdateRepository.find({
      take: limit,
      where: publishedActionUpdateWhere(new Date()),
      order: { date: 'DESC' },
      relations: { action: true, schemaSnapshot: true },
      select: {
        action: {
          name: true,
        },
      },
    });
  }

  private async findActionUpdateNotifRecipients(
    actionUpdate: ActionUpdate,
  ): Promise<User[]> {
    switch (actionUpdate.notifyType) {
      case ActionUpdateNotifyType.None:
        return [];
      case ActionUpdateNotifyType.ActionCohort: {
        const userIds = await this.findParticipantIdsForActionById(
          actionUpdate.actionId,
        );
        return this.userService.findByIds(userIds);
      }
      case ActionUpdateNotifyType.Tag: {
        if (!actionUpdate.tag) {
          throw new BadRequestException('Tag is required');
        }
        return (await this.userService.findTagOrFail(actionUpdate.tag.id))
          .users;
      }
      case ActionUpdateNotifyType.AllMembers:
        return this.userService.findAllUsers();
      default:
        throw new Error(
          `unknown notifyType: ${actionUpdate.notifyType satisfies never}`,
        );
    }
  }

  async findSuites(): Promise<ActionSuite[]> {
    return this.actionSuiteRepository.find();
  }

  async findSuite(id: number): Promise<ActionSuite> {
    return this.actionSuiteRepository.findOneOrFail({
      where: { id },
      relations: {
        actions: { events: true, activities: true },
        reminderGroups: { memberActionEvent: true, deadlineEvent: true },
        generalUpdates: { schemaSnapshot: true },
      },
      relationLoadStrategy: 'query',
    });
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
    return this.findSuite(suiteId);
  }

  async addSuiteEvent(suiteId: number, actionEventDto: CreateActionEventDto) {
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: true },
    });

    await this.addEventToActions({
      actions: suite.actions,
      event: actionEventDto,
      overrides: { suiteManaged: true },
      suiteIds: [suiteId],
    });
    return this.findSuite(suiteId);
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
    return this.findSuite(suiteId);
  }

  async tentativePlansForGroup(
    eventId: number,
    body: CreateReminderGroupDto,
  ): Promise<PreviewNotificationPlanDto[]> {
    assertExcludePreviouslyNotifiedAllowed(body);
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: {
        action: {
          events: true,
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

    // Loaded with actions so the tentative group previews with the real suite
    // scope: cohort selection and the excludePreviouslyNotified coverage check
    // (groupTaskScopeActionIds) otherwise fall back to the single member
    // action and over-exclude — showing no recipients for a suite catch-up
    // group whose real send would notify.
    let actionSuite: ActionSuite | undefined = undefined;
    if (body.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: body.suiteId },
        relations: { actions: true },
      });
    }

    const timingAnchorEvent =
      await this.actionEventReminderService.resolveTimingAnchorEvent(
        body,
        event,
      );

    const { timingAnchorEventId: _timingAnchorEventId, ...bodyRest } = body;
    const fakeGroup = {
      ...bodyRest,
      id: 0,
      name: 'Tentative Reminder Group',
      memberActionEvent: event,
      notifications: [],
      users,
      userTag: tag,
      allSent: false,
      actionSuite,
      timingAnchorEvent,
    } satisfies ReminderGroup;

    const withDeadlineEvent =
      await this.actionEventReminderService.attachDeadlineEvent(fakeGroup);

    if (
      fakeGroup.timingMode === ReminderGroupTimingMode.FromDeadline ||
      fakeGroup.timingMode === ReminderGroupTimingMode.WithinRelativeRange
    ) {
      if (
        !withDeadlineEvent.deadlineEvent &&
        !withDeadlineEvent.timingAnchorEvent
      ) {
        throw new BadRequestException(
          'Deadline or anchor event is required for relative timing modes',
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

    return plans.map((plan) => {
      const channels: NotificationChannel[] = [];
      if (userActionNotifsEnabled_push(plan.user))
        channels.push(NotificationChannel.Push);
      if (userActionNotifsEnabled_text(plan.user))
        channels.push(NotificationChannel.Text);
      if (userActionNotifsEnabled_email(plan.user))
        channels.push(NotificationChannel.Email);
      return new PreviewNotificationPlanDto(plan, channels);
    });
  }

  async findReminderAnchorCandidates(
    eventId: number,
  ): Promise<ReminderAnchorCandidate[]> {
    return this.actionEventReminderService.findReminderAnchorCandidates(
      eventId,
    );
  }

  async findUncompletedTasks(
    userId: number,
    suiteId?: number,
  ): Promise<ActionDto[]> {
    const actions = (await this.findMemberPublic(userId))
      .filter(
        (action) =>
          action.shouldParticipate &&
          action.userRelation !== UserActionRelation.Completed,
      )
      .sort((a, b) => b.priority - a.priority);
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
      authors: true,
      events: events || undefined,
      suite: suite || undefined,
    };

    const action = await this.actionRepository.findOneOrFail({
      where: { id },
      relations,
    });

    const taskFormEntity = taskForm
      ? await this.formRepository.findOneOrFail({
          where: { id: action.taskFormId },
          relations: { formSnapshot: true },
        })
      : undefined;

    const reminderGroups = reminders
      ? await this.actionEventReminderService.getReminderGroupsForEvent(
          action.id,
        )
      : undefined;

    return new ExportActionDto(action, {
      taskForm: taskFormEntity,
      reminderGroups,
    });
  }

  async importAction(json: string): Promise<Action> {
    const importaction = JSON.parse(json) as ExportActionDto;

    const {
      taskForm,
      reminderGroups: _reminderGroups,
      suite,
      events,
      activities: _activities,
      authors,
      updates: _updates,
      followUpForms: _followUpForms,
      ...actionCols
    } = importaction;

    // typecheck to ensure that we don't override any relations in prod
    type _actionCols_relations = {
      [K in keyof typeof actionCols as K extends keyof Action
        ? K
        : never]: IsRelation<(typeof actionCols)[K]> extends true
        ? K
        : undefined;
    }[keyof typeof actionCols];
    type _ensure_ImportActionDto_noRelations = Assert<
      _actionCols_relations extends undefined ? true : false
    >;

    let suiteIdToSync: number | undefined;
    const result = await this.actionRepository.manager.transaction(
      async (em) => {
        const actionRepo = em.getRepository(Action);
        const suiteRepo = em.getRepository(ActionSuite);
        const formRepo = em.getRepository(Form);
        const eventRepo = em.getRepository(ActionEvent);

        const inserted = await actionRepo.insert({
          ...actionCols,
          cohortExpression:
            actionCols.cohortExpression == null
              ? undefined
              : this.parseCohortExpressionOrThrow(actionCols.cohortExpression),
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

        return actionRepo.findOneOrFail({
          where: { id: actionId },
        });
      },
    );
    await this.syncGeneralUpdateDatesForSuites([suiteIdToSync]);
    return result;
  }

  // TODO move ==================================

  async findActionRelationsForUsers(
    usersP: Promise<User[]>,
    actionLimit: number = 8,
    session: CohortResolutionSession = new CohortResolutionSession(),
  ): Promise<UserActionRelations> {
    const actionsP: Promise<ParsedAction[]> = run(async () => {
      const actions = await this.findAllSorted(
        { events: true, suite: true },
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
      const joinedUsersMap = await this.findParticipantIdsForActions(
        actions,
        session,
      );

      const userIdsSet = await userIdsSetP;
      const joinedUsers: Record<number, number[]> = {};
      for (const action of actions) {
        joinedUsers[action.id] = (joinedUsersMap.get(action.id) ?? []).filter(
          (uid) => userIdsSet.has(uid),
        );
      }
      return joinedUsers;
    });

    const suitesP: Promise<ActionSuite[]> = run(async () => {
      const actions = await actionsP;
      return await this.actionSuiteRepository.find({
        where: { id: In(actions.map((a) => a.suite?.id)) },
      });
    });

    /** oldest activity first */
    const temporallySortedActivitiesP = run(async () => {
      const actions = await actionsP;
      const actionIds = actions.map((a) => a.id);
      return this.actionActivityRepository.find({
        where: { actionId: In(actionIds), userId: In(await userIdsP) },
        order: { createdAt: 'ASC' },
      });
    });

    const allMembersTagIdP: Promise<string | null> = run(async () => {
      const tag = await this.userService.findAllMembersTag();
      return tag?.id ?? null;
    });

    // --- end of promise defs ---

    const now = new Date();
    const users = await usersP;
    const userById = new Map(users.map((user) => [user.id, user]));
    const actions = await actionsP;

    const allMembersTagId = await allMembersTagIdP;
    const actionSummaries: UserActionSummary[] = actions.map((action) => {
      return {
        id: action.id,
        name: action.name,
        status: action.status,
        weekNumber: action.deadlineWeekNumber,
        allMembersParticipating:
          allMembersTagId !== null &&
          expressionReferencesTag(action.cohortExpression, allMembersTagId),
        suiteId: action.suite?.id,
        memberActionDeadline:
          action.memberActionPhase?.deadlineEvent?.date?.getTime() ?? null,
      } satisfies UserActionSummary;
    });

    const actionIds = actions.map((a) => a.id);
    const actionOrder = new Map(actionIds.map((id, index) => [id, index]));

    const relationByUserThenAction = new Map<
      number,
      Map<
        number,
        Omit<UserActionRelationDetail, 'latestActivityAt'> & {
          latestActivityAt?: Date;
          // Transient resolver inputs; not serialized (see final mapping below).
          isJoined: boolean;
          isAway: boolean;
          activities: ActionActivity[];
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
          isJoined: false,
          isAway: false,
          activities: [],
        });
      }
      return relationByUserThenAction.get(userId)!.get(actionId)!;
    }

    // Status is resolved in one pass below, not in this gather loop.
    const actionById = new Map(actions.map((action) => [action.id, action]));
    const joinedUsers = await joinedUsersP;
    const userIds = await userIdsP;
    for (const action of actions) {
      // This users × actions pass is pure CPU; yield so concurrent requests
      // aren't starved for the whole matrix.
      await yieldToEventLoop();
      for (const userId of joinedUsers[action.id]) {
        getDetail({ userId, actionId: action.id }).isJoined = true;
      }
      // Set-based membership from the shared session (already resolved for
      // this expression by findParticipantIdsForActions) instead of the
      // per-user expression walk, whose action leaves each hit the DB.
      const cohortMemberIds =
        await this.actionEventRecipientService.resolveCohortMemberIds(
          action.cohortExpression,
          session,
        );
      for (const userId of userIds) {
        const detail = getDetail({ userId, actionId: action.id });
        if (
          cohortMemberIds.has(userId) &&
          computeIsAwayDuringWindow({
            user: userById.get(userId)!,
            action,
          })
        ) {
          detail.isAway = true;
        }
      }
    }

    for (const activity of await temporallySortedActivitiesP) {
      const detail = getDetail({
        userId: activity.userId,
        actionId: activity.actionId,
      });
      // latestActivity* track the last activity of *any* type; the terminal
      // (status-bearing) one is resolved in the pass below.
      detail.latestActivityAt = activity.createdAt;
      detail.latestActivityType = activity.type;
      detail.activities.push(activity);
    }

    for (const actionMap of relationByUserThenAction.values()) {
      for (const [actionId, detail] of actionMap) {
        const action = actionById.get(actionId)!;
        const terminal = findLatestTerminalActivity(detail.activities);

        let activityStatus: UserActionRelationPillStatus | null = null;
        if (terminal) {
          switch (terminal.type) {
            case ActionActivityType.USER_COMPLETED:
              activityStatus = UserActionRelationPillStatus.Completed;
              break;
            case ActionActivityType.USER_WONT_COMPLETE:
              activityStatus = UserActionRelationPillStatus.WontComplete;
              // Surface withdrawal reason for the leader view.
              detail.declineReason = terminal.declineReason;
              detail.isMoral = terminal.isMoral;
              detail.outOfTime = terminal.outOfTime;
              break;
            default:
              throw new Error(
                `unknown terminal activity type: ${terminal.type satisfies never}`,
              );
          }
        }

        detail.status = resolveUserActionPillStatus({
          isJoined: detail.isJoined,
          isAway: detail.isAway,
          optional: action.optional,
          deadlinePassed:
            !!action.memberActionPhase?.deadlineEvent?.date &&
            action.memberActionPhase.deadlineEvent.date <= now,
          activityStatus,
        });
      }
    }

    const userRelations: UserActionRelationsForUser[] = Array.from(
      relationByUserThenAction.entries(),
    ).map(([userId, actionMap]) => {
      const relations: UserActionRelationDetail[] = Array.from(
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
      } satisfies UserActionRelationsForUser;
    });

    return {
      actions: actionSummaries,
      suites: await suitesP,
      users: userRelations,
    };
  }

  async getWithdrawalsForForm(formId: number): Promise<ActionActivity[]> {
    const action = await this.findActionByFormId(formId);
    if (!action) {
      return [];
    }
    const activities = await this.actionActivityRepository.find({
      where: {
        actionId: action.id,
        type: ActionActivityType.USER_WONT_COMPLETE,
      },
      order: { createdAt: 'DESC' },
    });
    const seen = new Set<number>();
    const results: ActionActivity[] = [];
    for (const a of activities) {
      if (seen.has(a.userId)) {
        continue;
      }
      seen.add(a.userId);
      results.push(a);
    }
    return results;
  }

  async findUserActionRelations(): Promise<UserActionRelations> {
    // One user load for the whole request: the roster projection claims the
    // session's active-user snapshot, so the base-user resolution inside
    // findParticipantIdsForActions reuses it instead of re-hydrating every
    // user. The relations matrix only reads what the projection carries.
    const session = new CohortResolutionSession();
    const usersPromise = this.actionEventRecipientService.primeActiveUsers(
      session,
      () => this.userService.findActiveUsersForRoster(),
    );
    return this.findActionRelationsForUsers(usersPromise, undefined, session);
  }

  async findUserActionRelationsForUser(
    userId: number,
  ): Promise<UserActionRelations> {
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
  ): Promise<UserActionRelations> {
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
  ): Promise<UserActionRelations> {
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

  private async buildSuspendPlanContext(
    actions: ParsedAction[],
    maxPastDate?: Date,
  ): Promise<SuspendPlanContext> {
    const suiteMap = new Map<
      number,
      {
        suite: ActionSuite;
        actions: ParsedAction[];
        orderIndex: number;
      }
    >();

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action.suite) continue;
      if (action.onboarding) continue;
      if (action.optional) continue;

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
          const deadlineDate = action.memberActionPhase.deadlineEvent?.date;
          if (deadlineDate) {
            deadlineDateByActionId.set(action.id, deadlineDate);
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
    for (const suite of suitesToProcess) {
      for (const action of suite.actions) {
        actionIds.push(action.id);
      }
    }

    const [dismissedActivities, completionActivities] = await Promise.all([
      this.actionActivityRepository.find({
        where: {
          actionId: In(actionIds),
          type: ActionActivityType.USER_DISMISSED,
        },
      }),
      this.actionActivityRepository.find({
        where: {
          actionId: In(actionIds),
          type: In([
            ActionActivityType.USER_COMPLETED,
            ActionActivityType.USER_WONT_COMPLETE,
          ]),
        },
      }),
    ]);

    // Share the active-user load and per-leaf cohort queries across every
    // action in the batch (see CohortResolutionSession).
    const session = new CohortResolutionSession();
    const activeUsers =
      await this.actionEventRecipientService.getActiveUsers(session);
    const activeUsersById = new Map(activeUsers.map((user) => [user.id, user]));

    const dismissedByAction = new Map<number, Set<number>>();
    for (const activity of dismissedActivities) {
      if (!dismissedByAction.has(activity.actionId)) {
        dismissedByAction.set(activity.actionId, new Set());
      }
      dismissedByAction.get(activity.actionId)!.add(activity.userId);
    }

    const completedByAction = new Map<number, Set<number>>();
    for (const activity of completionActivities) {
      if (!completedByAction.has(activity.actionId)) {
        completedByAction.set(activity.actionId, new Set());
      }
      completedByAction.get(activity.actionId)!.add(activity.userId);
    }

    const cohortByAction = new Map<number, Promise<Set<number>>>();
    for (const suite of suitesToProcess) {
      for (const action of suite.actions) {
        if (!memberActionEventByActionId.has(action.id)) continue;
        cohortByAction.set(
          action.id,
          this.actionEventRecipientService.resolveCohortMemberIds(
            action.cohortExpression,
            session,
          ),
        );
      }
    }
    await Promise.all(cohortByAction.values());

    const baseUsersByAction = new Map<number, User[]>();
    for (const suite of suitesToProcess) {
      for (const action of suite.actions) {
        const event = memberActionEventByActionId.get(action.id);
        if (!event) continue;

        const dismissedSet = dismissedByAction.get(action.id) ?? new Set();
        const deadlineDate =
          action.memberActionPhase.deadlineEvent?.date ?? null;

        const baseCandidates = activeUsers;

        const cohortMemberIds = await cohortByAction.get(action.id)!;

        const baseUsers = baseCandidates.filter((user) =>
          computeIsAssignedAndPresent({
            eventDate: event.date,
            deadlineDate: deadlineDate,
            cohortMemberIds,
            user,
            userDismissed: dismissedSet.has(user.id),
            onboarding: action.onboarding,
          }),
        );

        baseUsersByAction.set(action.id, baseUsers);
      }
    }

    const expectedBySuite = new Map<number, Set<number>>();
    const failedBySuite = new Map<number, Set<number>>();
    const idToUser = new Map<number, User>();

    const lastSignedDateByUser = new Map<number, Date>();
    const getLastSignedDate = (user: User) => {
      const cached = lastSignedDateByUser.get(user.id);
      if (cached) {
        return cached;
      }
      const lastSignedDate =
        user.contractEvents
          ?.filter((event) => event.type === ContractEventType.SIGNED)
          ?.sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.date ??
        new Date(0);
      lastSignedDateByUser.set(user.id, lastSignedDate);
      return lastSignedDate;
    };

    for (const suite of suitesToProcess) {
      // A user fails a suite only when every non-optional action assigned to
      // them in that suite is missed. Each action can have a different cohort.
      const expectedUserIds = new Set<number>();
      const usersWhoCompletedAnAssignedAction = new Set<number>();
      const usersWithAnAssignmentSinceLastSigning = new Set<number>();

      for (const action of suite.actions) {
        const event = memberActionEventByActionId.get(action.id);
        if (!event) {
          continue;
        }

        const baseUsers = baseUsersByAction.get(action.id) ?? [];
        const completedSet = completedByAction.get(action.id) ?? new Set();

        for (const user of baseUsers) {
          expectedUserIds.add(user.id);
          if (completedSet.has(user.id)) {
            usersWhoCompletedAnAssignedAction.add(user.id);
          }
          if (getLastSignedDate(user) < event.date) {
            usersWithAnAssignmentSinceLastSigning.add(user.id);
          }
        }
      }

      expectedBySuite.set(suite.suite.id, expectedUserIds);

      const suiteFailed = new Set<number>();
      for (const userId of expectedUserIds) {
        if (
          !usersWhoCompletedAnAssignedAction.has(userId) &&
          usersWithAnAssignmentSinceLastSigning.has(userId)
        ) {
          const user = activeUsersById.get(userId)!;
          if (user.hasActiveContract) {
            suiteFailed.add(userId);
            idToUser.set(user.id, user);
          }
        }
      }
      failedBySuite.set(suite.suite.id, suiteFailed);
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
  ): SuspensionCandidate[] {
    const pastSuites = context.orderedSuites.filter(
      (suite) => suite.pastDate && suite.pastDate < now,
    );

    const candidates: SuspensionCandidate[] = [];

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
            candidates.push({
              user: context.idToUser.get(userId)!,
              reasonKey: `s-${lastThreeSuiteIds.join('-')}`,
            });
            break;
          }
        } else {
          // they were expected and did not fail => streak broken
          streak = 0;
          lastThreeSuiteIds.length = 0;
        }
      }
    }

    return candidates;
  }

  async findUsersToSuspend(now: Date, preloadedActions?: ParsedAction[]) {
    const actions =
      preloadedActions ??
      (await this.findAllSorted({
        events: true,
        suite: true,
      }));

    const context = await this.buildSuspendPlanContext(actions, now);
    return this.computeUsersToSuspendFromContext(now, context);
  }

  async getSuspendPlans(
    rangeStart: Date,
    rangeEnd: Date,
    stepHours: number = 1,
  ): Promise<SuspensionPlan[]> {
    const actions = await this.findAllSorted({
      events: true,
      suite: true,
    });
    const context = await this.buildSuspendPlanContext(actions, rangeEnd);

    const plans: SuspensionPlan[] = [];
    let date = rangeStart;
    const suspendedUsers = new Set<number>();
    const rangeEndMs = rangeEnd.getTime();
    const stepMs = stepHours * 60 * 60 * 1000;

    while (date.getTime() <= rangeEndMs) {
      const notAlreadySuspended = this.computeUsersToSuspendFromContext(
        date,
        context,
      )
        .map((candidate) => candidate.user)
        .filter((user) => !suspendedUsers.has(user.id));
      if (notAlreadySuspended.length > 0) {
        for (const user of notAlreadySuspended) {
          suspendedUsers.add(user.id);
        }
        plans.push({ date, users: notAlreadySuspended });
      }
      date = new Date(date.getTime() + stepMs);
    }
    return plans;
  }

  async getShareLinksForForm(formId: number): Promise<ShareUrl[]> {
    const action = await this.findActionByFormId(formId);
    if (!action) {
      throw new NotFoundException('No action found for this form');
    }
    // This is a per-user view (ShareUrlDto requires a user); campaign-owned
    // links have no user and are managed via the admin campaign view instead.
    return this.shareUrlsService.findUserOwnedForAction(action.id);
  }

  async getShareUrlStats(
    actionId: number,
    questionId?: string,
  ): Promise<ShareUrlStats[]> {
    // Per-user referral leaderboard (ShareUrlStats.user is non-null); exclude
    // campaign-owned links, which have no referring user.
    const shareUrls =
      await this.shareUrlsService.findUserOwnedForAction(actionId);

    if (shareUrls.length === 0) {
      return [];
    }

    // Get all sids
    const sids = shareUrls
      .map((su) => su.sid)
      .filter((sid): sid is string => !!sid);

    if (sids.length === 0) {
      return shareUrls.map((su) => ({
        user: su.user!,
        inviteCount: 0,
        sid: su.sid ?? '',
        yesCount: 0,
      }));
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
      .map((su) => ({
        user: su.user!,
        inviteCount: countMap.get(su.sid ?? '') ?? 0,
        sid: su.sid ?? '',
        yesCount: yesCountMap.get(su.sid ?? '') ?? 0,
      }))
      .filter((stat) => stat.inviteCount > 0);

    return results.sort((a, b) => b.inviteCount - a.inviteCount);
  }

  /** Unified feed of recent activity groups, action updates, joins, and comments. */
  async getGlobalFeed(limit: number = 15): Promise<GlobalFeedItemDto[]> {
    const feedItems: GlobalFeedItemDto[] = [];
    const now = new Date();
    const oneWeekAgo = this.globalFeedWindowStart();

    const recentActivities = (await this.actionActivityRepository
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
        types: GlobalFeedActivityTypes,
      })
      .andWhere('action.onboarding = false')
      .andWhere('activity.createdAt > :oneWeekAgo', { oneWeekAgo })
      .orderBy('activity.createdAt', 'DESC')
      .getMany()) as (ActionActivity & {
      type: GlobalFeedActivityType;
    })[];

    // Activity groups are action + type, not day buckets.
    const activityGroups = new Map<
      string,
      {
        activities: ActionActivity[];
        actionId: number;
        actionName: string;
        type: GlobalFeedActivityType;
        latestDate: Date;
      }
    >();

    for (const activity of recentActivities) {
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

    for (const group of activityGroups.values()) {
      const uniqueUsers = new Map<number, ProfileDto>();
      for (const activity of group.activities) {
        if (activity.user && !uniqueUsers.has(activity.user.id)) {
          uniqueUsers.set(activity.user.id, new ProfileDto(activity.user));
        }
      }
      const users = Array.from(uniqueUsers.values());

      const activityGroup: GlobalFeedActivityGroupDto = {
        users: users.slice(0, GLOBAL_FEED_FACEPILE_LIMIT),
        actionId: group.actionId,
        actionName: group.actionName,
        activityType: group.type,
        count: uniqueUsers.size,
      };

      feedItems.push(
        new GlobalFeedItemDto({
          type: GlobalFeedItemType.ActivityGroup,
          date: group.latestDate,
          activityGroup,
        }),
      );
    }

    // The recency window runs on `visibleAt`, not `date`: an update backdated to
    // when its subject happened would fall outside a one-week window on the day
    // it was published.
    const actionUpdates = await this.actionUpdateRepository.find({
      where: {
        visibleAt: MoreThan(oneWeekAgo),
      },
      relations: { action: true, schemaSnapshot: true },
      order: { date: 'DESC' },
      take: 10,
    });

    for (const update of actionUpdates) {
      if (isActionUpdatePublished(update, now) && update.schemaSnapshot) {
        const actionUpdateDto: GlobalFeedActionUpdateDto = {
          id: update.id,
          title: update.title,
          schema: displayOnlySchemaOf({
            owner: 'ActionUpdate',
            ownerId: update.id,
            snapshot: update.schemaSnapshot,
          }),
          date: update.date,
          actionId: update.actionId,
          actionName: update.action?.name || 'Unknown Action',
        };

        feedItems.push(
          new GlobalFeedItemDto({
            type: GlobalFeedItemType.ActionUpdate,
            date: update.date,
            actionUpdate: actionUpdateDto,
          }),
        );
      }
    }

    const {
      users: newMemberUsers,
      count: newMemberCount,
      latestDate: latestMemberDate,
    } = await this.computeRecentNewMembers(oneWeekAgo, now);

    if (newMemberCount > 0 && latestMemberDate) {
      const newMembers: GlobalFeedNewMembersDto = {
        users: newMemberUsers,
        count: newMemberCount,
      };

      feedItems.push(
        new GlobalFeedItemDto({
          type: GlobalFeedItemType.NewMembers,
          date: latestMemberDate,
          newMembers,
        }),
      );
    }

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

      for (const group of commentGroups.values()) {
        const postTitle = postTitleMap.get(group.postId);
        if (!postTitle) continue;

        const usersArray = Array.from(group.users.values());
        const forumComments: GlobalFeedForumCommentsDto = {
          users: usersArray
            .slice(0, GLOBAL_FEED_FACEPILE_LIMIT)
            .map((u) => u.profile),
          postId: group.postId,
          postTitle,
          count: group.users.size,
          commentId:
            usersArray.length === 1 ? usersArray[0].commentId : undefined,
        };

        feedItems.push(
          new GlobalFeedItemDto({
            type: GlobalFeedItemType.ForumComments,
            date: group.latestDate,
            forumComments,
          }),
        );
      }
    }

    feedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return feedItems.slice(0, limit);
  }

  private globalFeedWindowStart(): Date {
    return new Date(Date.now() - GLOBAL_FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }

  private buildRecentNewMembersRankedQuery(
    oneWeekAgo: Date,
    now: Date,
  ): FeedMemberRankedQuery {
    return {
      rankedSql: `
        SELECT "userId", "latestAt", "latestId"
        FROM (
          SELECT DISTINCT ON (signed_event."userId")
            signed_event."userId" AS "userId",
            signed_event.date AS "latestAt",
            signed_event.id AS "latestId"
          FROM "contract_event" signed_event
          LEFT JOIN LATERAL (
            SELECT previous_event.type
            FROM "contract_event" previous_event
            WHERE previous_event."userId" = signed_event."userId"
              AND (
                previous_event.date < signed_event.date
                OR (
                  previous_event.date = signed_event.date
                  AND previous_event.id < signed_event.id
                )
              )
            ORDER BY previous_event.date DESC, previous_event.id DESC
            LIMIT 1
          ) previous_event ON true
          WHERE signed_event.type = $1
            AND signed_event.date > $2
            AND (
              previous_event.type IS NULL
              OR previous_event.type = $3
            )
            AND ${sqlUserHasActiveContractAt('signed_event."userId"', '$4')}
          ORDER BY signed_event."userId" ASC, signed_event.date DESC, signed_event.id DESC
        ) ranked`,
      params: [
        ContractEventType.SIGNED,
        oneWeekAgo,
        ContractEventType.SUSPENDED,
        now,
      ],
    };
  }

  /** Recent active-contract members whose SIGNED event starts/resumes a contract. */
  private async computeRecentNewMembers(
    oneWeekAgo: Date,
    now: Date,
  ): Promise<{ users: ProfileDto[]; count: number; latestDate: Date | null }> {
    const { rankedSql, params } = this.buildRecentNewMembersRankedQuery(
      oneWeekAgo,
      now,
    );
    return this.queryFeedMemberSummary({
      rankedSql,
      params,
      limit: GLOBAL_FEED_FACEPILE_LIMIT,
    });
  }

  private async queryFeedMemberPageIds({
    rankedSql,
    params,
    limit,
    afterId,
  }: {
    rankedSql: string;
    params: unknown[];
    limit: number;
    afterId?: number;
  }): Promise<number[]> {
    const pageParams = [...params];

    if (afterId === undefined) {
      const limitParam = pageParams.length + 1;
      pageParams.push(limit);
      const rows = await this.userRepository.query<FeedMemberPageRow[]>(
        `WITH ranked_members AS (${rankedSql})
        SELECT "userId", "latestAt", "latestId" FROM ranked_members
        ORDER BY "latestAt" DESC, "latestId" DESC
        LIMIT $${limitParam}`,
        pageParams,
      );
      return rows.map((row) => Number(row.userId));
    }

    // Share one materialized ranking; unknown cursors produce no page.
    const afterParam = pageParams.length + 1;
    pageParams.push(afterId);
    const limitParam = pageParams.length + 1;
    pageParams.push(limit);
    const rows = await this.userRepository.query<FeedMemberPageRow[]>(
      `WITH ranked_members AS MATERIALIZED (${rankedSql}),
      cursor_row AS (
        SELECT "latestAt", "latestId" FROM ranked_members WHERE "userId" = $${afterParam}
      )
      SELECT rm."userId", rm."latestAt", rm."latestId"
      FROM ranked_members rm, cursor_row c
      WHERE rm."latestAt" < c."latestAt"
        OR (rm."latestAt" = c."latestAt" AND rm."latestId" < c."latestId")
      ORDER BY rm."latestAt" DESC, rm."latestId" DESC
      LIMIT $${limitParam}`,
      pageParams,
    );

    return rows.map((row) => Number(row.userId));
  }

  private async hydrateFeedMemberProfiles(
    orderedIds: number[],
  ): Promise<ProfileDto[]> {
    if (orderedIds.length === 0) return [];

    // Hydrate only needed relations: `leaderOf` powers `isCommunityLeader`;
    // load `contractEvents`/`cluster` for accurate
    // `hasActiveContract`/`lastContractEvent`/`cluster`.
    const users = await this.userRepository.find({
      where: { id: In(orderedIds) },
      relations: { leaderOf: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((user): user is User => user !== undefined)
      .map((user) => new ProfileDto(user));
  }

  private async queryFeedMemberSummary({
    rankedSql,
    params,
    limit,
  }: {
    rankedSql: string;
    params: unknown[];
    limit: number;
  }): Promise<{ users: ProfileDto[]; count: number; latestDate: Date | null }> {
    const limitParam = params.length + 1;
    const rows = await this.userRepository.query<FeedMemberSummaryRow[]>(
      `SELECT "userId", "latestAt", "latestId", COUNT(*) OVER() AS "totalCount"
      FROM (${rankedSql}) feed_members
      ORDER BY "latestAt" DESC, "latestId" DESC
      LIMIT $${limitParam}`,
      [...params, limit],
    );

    const users = await this.hydrateFeedMemberProfiles(
      rows.map((row) => Number(row.userId)),
    );

    return {
      users,
      count: rows.length === 0 ? 0 : Number(rows[0].totalCount),
      latestDate: rows[0]?.latestAt ? new Date(rows[0].latestAt) : null,
    };
  }

  async getActivityGroupMembers(
    actionId: number,
    activityType: GlobalFeedActivityType,
    limit: number,
    afterId?: number,
  ): Promise<ProfileDto[]> {
    const oneWeekAgo = this.globalFeedWindowStart();
    const rankedSql = `
      SELECT "userId", "latestAt", "latestId"
      FROM (
        SELECT DISTINCT ON (activity."userId")
          activity."userId" AS "userId",
          activity."createdAt" AS "latestAt",
          activity.id AS "latestId"
        FROM "action_activity" activity
        INNER JOIN "action" action_entity ON action_entity.id = activity."actionId"
        WHERE activity."actionId" = $1
          AND activity.type = $2
          AND action_entity.onboarding = false
          AND activity."createdAt" > $3
        ORDER BY activity."userId" ASC, activity."createdAt" DESC, activity.id DESC
      ) ranked`;

    const pageIds = await this.queryFeedMemberPageIds({
      rankedSql,
      params: [actionId, activityType, oneWeekAgo],
      limit,
      afterId,
    });
    return this.hydrateFeedMemberProfiles(pageIds);
  }

  async getNewMembers(limit: number, afterId?: number): Promise<ProfileDto[]> {
    const oneWeekAgo = this.globalFeedWindowStart();
    const { rankedSql, params } = this.buildRecentNewMembersRankedQuery(
      oneWeekAgo,
      new Date(),
    );

    const pageIds = await this.queryFeedMemberPageIds({
      rankedSql,
      params,
      limit,
      afterId,
    });
    return this.hydrateFeedMemberProfiles(pageIds);
  }

  async getForumCommentMembers(
    postId: number,
    limit: number,
    afterId?: number,
    requestingUserId?: number,
  ): Promise<ProfileDto[]> {
    const oneWeekAgo = this.globalFeedWindowStart();
    await this.forumService.findOnePost(postId, requestingUserId);
    const rankedSql = `
      SELECT "userId", "latestAt", "latestId"
      FROM (
        SELECT DISTINCT ON (comment."authorId")
          comment."authorId" AS "userId",
          comment."createdAt" AS "latestAt",
          comment.id AS "latestId"
        FROM "comment" comment
        WHERE comment."parentObjectType" = $1
          AND comment."parentObjectId" = $2
          AND comment."createdAt" > $3
          AND comment.deleted = false
        ORDER BY comment."authorId" ASC, comment."createdAt" DESC, comment.id DESC
      ) ranked`;

    const pageIds = await this.queryFeedMemberPageIds({
      rankedSql,
      params: [CommentParentObject.Post, postId, oneWeekAgo],
      limit,
      afterId,
    });
    return this.hydrateFeedMemberProfiles(pageIds);
  }

  async getTimelineFeed(limit: number = 15): Promise<TimelineFeedItemDto[]> {
    const feedItems: TimelineFeedItemDto[] = [];

    const now = new Date();

    const eventsQuery = this.actionEventRepository.find({
      relations: { action: true },
      where: { newStatus: Not(ActionStatus.MemberAction) },
      order: { date: 'DESC' },
      take: 10,
    });

    const actionUpdatesQuery = this.actionUpdateRepository.find({
      relations: { action: true, schemaSnapshot: true },
      where: publishedActionUpdateWhere(now),
      order: { date: 'DESC' },
      take: 10,
    });

    const [events, actionUpdates] = await Promise.all([
      eventsQuery,
      actionUpdatesQuery,
    ]);

    for (const event of events) {
      feedItems.push(
        new TimelineFeedItemDto({
          type: TimelineFeedItemType.ActionEvent,
          date: event.date,
          action: event.action,
          actionEvent: event,
        }),
      );
    }

    for (const actionUpdate of actionUpdates) {
      feedItems.push(
        new TimelineFeedItemDto({
          type: TimelineFeedItemType.ActionUpdate,
          date: actionUpdate.date,
          action: actionUpdate.action,
          actionUpdate,
        }),
      );
    }

    feedItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return feedItems.slice(0, limit);
  }

  async evaluateCohortExpressionBatch(expression: unknown): Promise<number[]> {
    const parsed = this.parseCohortExpressionOrThrow(expression);
    const result =
      await this.actionEventRecipientService.resolveCohortMemberIds(parsed);
    return Array.from(result);
  }

  /**
   * Filter follow-up forms by cohort expression for a given user.
   * A null/absent cohortExpression targets no members, so the form is
   * filtered out (consistent with action cohort semantics).
   */
  async filterFollowUpFormsByCohort(
    followUpForms: ParsedFollowUpForm[],
    user: User,
  ): Promise<ParsedFollowUpForm[]> {
    const results = await Promise.all(
      followUpForms.map((form) =>
        this.computeIsInCohortExpression({
          user,
          cohortExpression: form.cohortExpression,
        }),
      ),
    );
    return followUpForms.filter((_, i) => results[i]);
  }

  /**
   * Check if a user is in a cohort expression's target set.
   */
  async computeIsInCohortExpression(params: {
    user: User;
    cohortExpression: CohortExpression | null | undefined;
    visitedActionIds?: Set<number>;
  }): Promise<boolean> {
    const { user, cohortExpression } = params;
    const visitedActionIds = params.visitedActionIds ?? new Set<number>();

    if (!cohortExpression) {
      return false;
    }

    const ctx = singleUserCohortContext({
      userId: user.id,
      // Mirror findActiveUsersWithTags' universe filter so NOT() agrees across both paths.
      isCandidate: !user.isNotSignedUpPartialProfile,
      hasTag: (tagId: string) =>
        (user.tags || []).some((tag) => tag.id === tagId),
      completedAction: async (actionId: number) => {
        const activity = await this.actionActivityRepository.findOne({
          where: {
            userId: user.id,
            actionId,
            type: ActionActivityType.USER_COMPLETED,
          },
        });
        return !!activity;
      },
      inProgressAction: async (actionId: number) => {
        if (visitedActionIds.has(actionId)) return false;
        const fetched = await this.actionRepository.findOne({
          where: { id: actionId },
          relations: { events: true },
        });
        if (!fetched) return false;
        const action = parseAction(fetched);

        const inCohort = await this.computeIsInCohortExpression({
          user,
          cohortExpression: action.cohortExpression,
          visitedActionIds: new Set(visitedActionIds).add(actionId),
        });
        if (action.status !== ActionStatus.MemberAction) return false;

        if (!inCohort) return false;
        const terminal = await this.actionActivityRepository.findOne({
          where: [
            {
              userId: user.id,
              actionId,
              type: ActionActivityType.USER_COMPLETED,
            },
            {
              userId: user.id,
              actionId,
              type: ActionActivityType.USER_WONT_COMPLETE,
            },
          ],
        });
        return !terminal;
      },
      missedActionDeadline: async (actionId: number) => {
        if (visitedActionIds.has(actionId)) return false;
        const fetched = await this.actionRepository.findOne({
          where: { id: actionId },
          relations: { events: true },
        });
        if (!fetched) return false;
        const action = parseAction(fetched);

        // Mirror the missed_deadline pill: optional actions show
        // optional_task and away users show away, so neither can miss a
        // deadline. The batch path gets both via `loadMissedActionDeadlineUserIds`
        // and the roster's `computeIsAssignedAndPresent` filter.
        if (action.optional) return false;
        if (computeIsAwayDuringWindow({ action, user })) return false;

        const deadline = action.memberActionPhase.deadlineEvent?.date ?? null;
        if (!deadline || deadline >= new Date()) return false;

        // A completion or withdrawal means the deadline wasn't missed.
        // Dismissal deliberately does NOT disqualify: it's a view-only
        // "mark as seen" overlay (see ActionActivityType.USER_DISMISSED)
        // offered on past-deadline cards, so dismissed users are still in
        // this set.
        const terminal = await this.actionActivityRepository.findOne({
          where: [
            {
              userId: user.id,
              actionId,
              type: ActionActivityType.USER_COMPLETED,
            },
            {
              userId: user.id,
              actionId,
              type: ActionActivityType.USER_WONT_COMPLETE,
            },
          ],
        });
        if (terminal) return false;

        const inCohort = await this.computeIsInCohortExpression({
          user,
          cohortExpression: action.cohortExpression,
          visitedActionIds: new Set(visitedActionIds).add(actionId),
        });
        // Shared assignment rule (cohort membership + contract requirement),
        // so this agrees with the batch roster. `user` must have
        // `contractEvents` and `awayRanges` loaded — both degrade silently
        // to wrong answers when absent (hasActiveContractInFullRange -> false,
        // isAwayAtAnyPointInRange -> false), so every
        // computeIsInCohortExpression caller has to load them. `dismissed:
        // false` because dismissal is an overlay, not an assignment input
        // (same as resolveUserActionStatus).
        return computeIsAssignedToAction({
          action,
          user,
          inCohort,
          dismissed: false,
        });
      },
      matchesFormField: async (fieldParams: {
        formId: number;
        fieldId: string;
        responseEqualTo?: string;
        responseAny?: boolean;
      }) => {
        const responses = await this.formResponseRepository.find({
          where: {
            formId: fieldParams.formId,
            user: { id: user.id },
          },
        });
        return responses.some((r) =>
          answerMatchesFormField(
            r.answers as Record<string, unknown>,
            fieldParams,
          ),
        );
      },
      isGroupLead: async () => {
        const count = await this.communityRepository
          .createQueryBuilder('community')
          .innerJoin('community.leaders', 'leader')
          .where('leader.id = :userId', { userId: user.id })
          .getCount();
        return count > 0;
      },
    });

    const memberIds = await evaluateCohortExpression(
      cohortExpression,
      ctx,
      visitedActionIds,
    );
    return memberIds.has(user.id);
  }
}

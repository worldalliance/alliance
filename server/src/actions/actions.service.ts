/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  ActionActivityType,
  MEMBER_ACTION_DEADLINE_PASSED,
  WITHDRAWAL_OPTION_LABELS,
  withdrawalOptionFromFlags,
} from "@alliance/common/actionActivity";
import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  cohortExpressionSchema,
  expressionHasLeaf,
  type CohortExpression,
} from "@alliance/common/cohort-expression";
import { emptyDisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { echoesStoredKey } from "@alliance/common/image-src";
import { run } from "@alliance/common/run";
import { Assert } from "@alliance/common/types";
import { describeSchemaIssues } from "@alliance/common/zod-issues";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { max, milliseconds } from "date-fns";
import { groupBy } from "es-toolkit";
import { CommunityService } from "src/community/community.service";
import {
  Community,
  loadedCommunityUsers,
} from "src/community/entities/community.entity";
import {
  assertLive,
  softDeleteCascade,
  softDeleteWhere,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { EventType } from "src/eventlog/event-log.entity";
import { EventLogService } from "src/eventlog/eventlog.service";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { renderedImageKey } from "src/images/images.service";
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
} from "src/notifs/action-event-reminder.service";
import { NotificationPlan } from "src/notifs/dto/notification-plan.dto";
import { NotifsService } from "src/notifs/notifs.service";
import { ReminderGroupService } from "src/notifs/reminder-group.service";
import { PosthogService } from "src/posthog/posthog.service";
import { displayOnlySchemaOf } from "src/tasks/display-only-snapshot";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import {
  UserActionRelationDetail,
  UserActionRelationPillStatus,
  UserActionRelations,
  UserActionRelationsForUser,
  UserActionSummary,
} from "src/user/dto/user-action-relations.dto";
import { sqlUserHasEverSigned } from "src/user/entities/contract-event.entity";
import { loadedTagUsers, Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import {
  ActionAssignment,
  computeActionAssignment,
  computeIsAwayDuringWindow,
  computeIsTaggedOrInManualCohort,
  computeMemberActionAwayStatus,
  hasMemberActionDeadlinePassed,
} from "src/utils/action-user";
import { CachedFilter } from "src/utils/cached-filter";
import { yieldToEventLoop } from "src/utils/event-loop";
import { startDatePriorityComparator } from "src/utils/general-update";
import type {
  IsRelation,
  Relations,
  Repository as TypedRepository,
} from "src/utils/Repository";
import {
  DeepPartial,
  EntityManager,
  ILike,
  In,
  IsNull,
  LessThan,
  MoreThan,
  Or,
  type Repository,
} from "typeorm";
import { TagService } from "../user/tag.service";
import { UserService } from "../user/user.service";
import {
  findLatestTerminalActivity,
  isTerminalActivity,
  resolveUserActionRelation,
  sqlIsLatestCompletion,
  sqlIsLatestWithdrawal,
} from "./action-activity-status";
import { ActionFormVariantService } from "./action-form-variant.service";
import { ActionParticipantsService } from "./action-participants.service";
import { replaceReviewers } from "./action-reviewers";
import {
  readRecognitionConfig,
  usesRecognition,
  type RecognitionPreviewCounts,
} from "./action-update-recognition";
import { ActionUpdateRecognitionPreviewService } from "./action-update-recognition-preview.service";
import { ActionUpdateRecognitionService } from "./action-update-recognition.service";
import {
  actionUpdateEntrySendTime,
  checkActionShowsWhenEntriesArrive,
  isActionUpdatePublished,
  publishedActionUpdateWhere,
} from "./action-update-visibility";
import { ActionVisibilityService } from "./action-visibility.service";
import { CohortAdmissionService } from "./cohort-admission.service";
import { readsSavedDecisions } from "./cohort-decision";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import { CohortDecisionService } from "./cohort-decision.service";
import {
  assertNotInACohort,
  assertTagsExist,
} from "./cohort-reference-validation";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import {
  ActionActivityDto,
  CreateActionActivityDto,
  WelcomeQueue,
} from "./dto/action-activity.dto";
import {
  CreateActionEventDto,
  UpdateActionEventDto,
} from "./dto/action-event.dto";
import { ActionReviewerDto } from "./dto/action-reviewer.dto";
import { CreateActionSuiteDto } from "./dto/action-suite.dto";
import {
  CreateActionUpdateDto,
  UpdateActionUpdateDto,
} from "./dto/action-update.dto";
import {
  ActionDto,
  CreateActionDto,
  ExportActionDto,
  SetPriorityDto,
  UpdateActionDto,
  UserActionRelation,
} from "./dto/action.dto";
import {
  CreateFollowUpFormDto,
  UpdateFollowUpFormDto,
} from "./dto/follow-up-form.dto";
import {
  CreateGeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from "./dto/general-update.dto";
import { CreateReminderGroupDto } from "./dto/reminder-group.dto";
import {
  ActionActivity,
  ActivitySource,
  ALLOW_DUPLICATE,
} from "./entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
  loadedActionEventAction,
} from "./entities/action-event.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { ActionReviewer } from "./entities/action-reviewer.entity";
import {
  ActionSuite,
  loadedActionSuiteActions,
  parseActionSuite,
  type ParsedActionSuite,
} from "./entities/action-suite.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
  lockActionUpdateRow,
} from "./entities/action-update.entity";
import {
  Action,
  loadedActionEvents,
  loadedActionFollowUpForms,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import {
  FollowUpForm,
  parseFollowUpForm,
  type ParsedFollowUpForm,
} from "./entities/follow-up-form.entity";
import {
  GeneralUpdateActivity,
  GeneralUpdateActivityType,
} from "./entities/general-update-activity.entity";
import {
  GeneralUpdate,
  loadedGeneralUpdateTags,
} from "./entities/general-update.entity";
import { ReminderGroup } from "./entities/reminder-group.entity";
import { lockLiveTagsAndSuites } from "./general-update-locks";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";
import {
  assertNotAPrerequisite,
  assertPrerequisitesValid,
} from "./prerequisite-validation";
import { SchemaWriteService } from "./schema-write.service";
import { SingleMemberCohortService } from "./single-member-cohort.service";
import { assertNotInStaffPreview } from "./staff-preview";
import { resolveUserActionPillStatus } from "./user-action-pill-status";
import {
  CompletionBlock,
  computeCanCompleteAction,
  computeCompletionBlock,
  resolveUserActionStatus,
  type ViewerCohort,
} from "./user-action-status";

/**
 * All anything resolving a form back to its action reads. A partially selected
 * `Action` would type as a whole one with most columns silently undefined, so
 * the narrow reads hand back a narrow type instead.
 */
export type LinkedAction = Pick<Action, "id" | "name">;

/**
 * Withdrawal reasons longer than this are truncated in the opt-out event-log
 * message to keep the Slack copy readable; the full reason is still stored on
 * the activity row and in the event's blob.
 */
const OPT_OUT_REASON_PREVIEW_LENGTH = 300;

const COMPLETION_UNAVAILABLE = "This action is not available to you";

const ACTION_PARENT_GONE = "That suite, author or form is gone";

const COMPLETION_BLOCK_MESSAGE: Record<CompletionBlock, string> = {
  [CompletionBlock.PreventCompletion]: COMPLETION_UNAVAILABLE,
  [CompletionBlock.NotInCohort]: COMPLETION_UNAVAILABLE,
  [CompletionBlock.DeadlinePassed]: MEMBER_ACTION_DEADLINE_PASSED,
  [CompletionBlock.OnboardingContractUnsigned]: COMPLETION_UNAVAILABLE,
};

const MEMBER_FEED_RELATIONS = {
  events: true,
  followUpForms: true,
  reviewers: true,
} satisfies Omit<Relations<Action>, "usersCompleted" | "status">;

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(ActionReviewer)
    private readonly actionReviewerRepository: Repository<ActionReviewer>,
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
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
    @InjectRepository(FollowUpForm)
    private readonly followUpFormRepository: Repository<FollowUpForm>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(ActionFormVariant)
    private readonly actionFormVariantRepository: Repository<ActionFormVariant>,
    private userService: UserService,
    private readonly tagService: TagService,
    public eventEmitter: EventEmitter2,
    private readonly communityService: CommunityService,
    private readonly notifsService: NotifsService,
    private readonly recognitionService: ActionUpdateRecognitionService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly reminderGroupService: ReminderGroupService,
    private readonly eventLogService: EventLogService,
    @Inject(forwardRef(() => ActionFormVariantService))
    private readonly actionFormVariantService: ActionFormVariantService,
    private readonly formSnapshotService: FormSnapshotService,
    private readonly posthogService: PosthogService,
    private readonly cohortDecisionStaffService: CohortDecisionStaffService,
    private readonly singleMemberCohortService: SingleMemberCohortService,
    private readonly cohortDecisionService: CohortDecisionService,
    private readonly cohortAdmissionService: CohortAdmissionService,
    private readonly actionVisibility: ActionVisibilityService,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
    private readonly participants: ActionParticipantsService,
    private readonly recognitionPreview: ActionUpdateRecognitionPreviewService,
    private readonly schemaWrite: SchemaWriteService,
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

  async findActionByFormId(formId: number): Promise<LinkedAction | null> {
    const byFormId = await this.findActionsByFormIds([formId]);
    return byFormId.get(formId) ?? null;
  }

  /** Resolves all form IDs in at most three queries. Direct task forms take
   * precedence over variants. Narrow because listing every form would
   * otherwise materialize every linked action's markdown and image columns. */
  async findActionsByFormIds(
    formIds: number[],
  ): Promise<Map<number, LinkedAction>> {
    const byFormId = new Map<number, LinkedAction>();
    if (formIds.length === 0) {
      return byFormId;
    }
    const direct = await this.actionRepository.find({
      where: { taskFormId: In(formIds) },
      select: { id: true, name: true, taskFormId: true },
    });
    for (const action of direct) {
      if (action.taskFormId != null) {
        byFormId.set(action.taskFormId, { id: action.id, name: action.name });
      }
    }
    const remaining = formIds.filter((formId) => !byFormId.has(formId));
    if (remaining.length === 0) {
      return byFormId;
    }
    const variants = await this.actionFormVariantRepository.find({
      where: { formId: In(remaining) },
      select: { formId: true, actionId: true },
    });
    if (variants.length === 0) {
      return byFormId;
    }
    const actions = await this.actionRepository.find({
      where: { id: In(variants.map((variant) => variant.actionId)) },
      select: { id: true, name: true },
    });
    const actionById = new Map(
      actions.map((action) => [
        action.id,
        { id: action.id, name: action.name },
      ]),
    );
    for (const variant of variants) {
      const action = actionById.get(variant.actionId);
      if (action) {
        byFormId.set(variant.formId, action);
      }
    }
    return byFormId;
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
        .set({ priority: () => "priority + 1" })
        .where("priority >= :min", { min: 0 })
        .execute();
      await manager
        .createQueryBuilder()
        .update(GeneralUpdate)
        .set({ priority: () => "priority + 1" })
        .where("priority >= :min", { min: 0 })
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
      const issues = describeSchemaIssues(parsed.error).join("; ");
      throw new BadRequestException(`Invalid cohort expression: ${issues}`);
    }
    return parsed.data;
  }

  private async parseCohortExpressionForSaveOrThrow(
    value: unknown,
    stored?: unknown,
  ): Promise<CohortExpression> {
    const expression = this.parseCohortExpressionOrThrow(value);
    await assertTagsExist({
      em: this.actionRepository.manager,
      expression,
      previous: cohortExpressionSchema.safeParse(stored).data,
    });
    return expression;
  }

  /** Reviewers are ordered by the position the admin sent them in. */
  private reviewerRows(reviewers: ActionReviewerDto[]): ActionReviewer[] {
    return reviewers.map((reviewer, position) =>
      this.actionReviewerRepository.create({
        name: reviewer.name,
        url: reviewer.url ?? null,
        icon: reviewer.icon ?? null,
        position,
      }),
    );
  }

  /**
   * A new action has no stored value to compare against, so a url counts as one
   * this api rendered only when it renders back to itself. Keeping the key it
   * names rather than dropping the field is what a duplicate wants, since the
   * copy then points at the same upload as the original.
   */
  private rewriteRenderedImages(
    next: Pick<CreateActionDto, "image" | "squareThumbnailImage">,
  ): void {
    for (const column of ["image", "squareThumbnailImage"] as const) {
      const value = next[column];
      if (typeof value !== "string") {
        continue;
      }
      const key = renderedImageKey(value);
      if (key) {
        this.logger.warn(
          `Rewrote an action ${column} url back to its upload key: ${value.slice(0, 100)}`,
        );
        next[column] = key;
      }
    }
  }

  async create(createActionDto: CreateActionDto): Promise<ParsedAction> {
    const { suiteId, authorIds, reviewers, ...rest } = createActionDto;
    this.rewriteRenderedImages(rest);
    if (rest.cohortExpression != null) {
      rest.cohortExpression = await this.parseCohortExpressionForSaveOrThrow(
        rest.cohortExpression,
      );
    }
    if (rest.taskFormId !== undefined) {
      await this.assertFormIdNotUsedAsVariant(rest.taskFormId);
    }
    const action = this.actionRepository.create(rest);
    action.reviewers = this.reviewerRows(reviewers ?? []);
    action.followUpForms = [];
    action.events = [];

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

    const saved = await writeUnderLive(this.actionRepository.manager, {
      parents: [
        ...(action.suite ? [{ target: ActionSuite, id: action.suite.id }] : []),
        ...(action.authors ?? []).map(({ id }) => ({ target: User, id })),
        ...(rest.taskFormId == null
          ? []
          : [{ target: Form, id: rest.taskFormId }]),
      ],
      notFound: ACTION_PARENT_GONE,
      write: async (em) => {
        const inserted = await em.save(Action, action);
        await assertPrerequisitesValid({ em, actionIds: [inserted.id] });
        return inserted;
      },
    });
    await this.shiftPrioritiesAfterInsertion();
    await this.syncGeneralUpdateDatesForSuites([saved.suite?.id]);
    return parseAction(saved);
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
      | Omit<Relations<Action>, "usersCompleted" | "status">
      | undefined = undefined,
    limit?: number,
  ): Promise<ParsedAction[]> {
    // Sort by:
    // 1. Soonest upcoming event (sooner first)
    // 2. Latest past member action event (later first)
    // 3. Priority (higher priority first)

    const qb = this.actionRepository
      .createQueryBuilder("a")
      .select("a.id", "id")
      .leftJoin("a.events", "e")
      .addSelect(
        `
    MIN(CASE WHEN e.date > NOW() THEN e.date END)
  `,
        "soonest_future_event_date",
      )
      .addSelect(
        `
    MAX(CASE
      WHEN e.newStatus = :memberAction THEN e.date
    END)
  `,
        "latest_memberaction_event_date",
      )
      .setParameter("memberAction", ActionStatus.MemberAction)
      .groupBy("a.id")
      .orderBy(
        "CASE WHEN MIN(CASE WHEN e.date > NOW() THEN e.date END) IS NULL THEN 1 ELSE 0 END",
        "ASC",
      ) // actions with future events first
      .addOrderBy("soonest_future_event_date", "ASC") // earliest future event first
      .addOrderBy(
        "CASE WHEN MAX(CASE WHEN e.newStatus = :memberAction THEN e.date END) IS NULL THEN 1 ELSE 0 END",
        "ASC",
      ) // actions with past member-action events next
      .addOrderBy("latest_memberaction_event_date", "DESC") // latest member-action event first
      .addOrderBy("a.priority", "ASC"); // higher priority first

    if (limit) {
      qb.limit(limit);
    }
    const actionIds = (await qb.getRawMany<{ id: number }>()).map(
      (row) => row.id,
    );

    if (actionIds.length === 0) {
      return [];
    }

    const actionsWithRelations = await this.actionRepository.find({
      where: { id: In(actionIds) },
      relations,
      relationLoadStrategy: "query",
    });

    const actionMap = new Map(actionsWithRelations.map((a) => [a.id, a]));
    return actionIds.map((id) => parseAction(actionMap.get(id)!));
  }

  async findUsersCompletedForAction(actionId: number): Promise<number> {
    const completions = await this.prerequisiteProgressService.loadCompletions({
      actionId,
    });
    return completions.length;
  }

  async reloadUsersCompletedForAction(actionId: number): Promise<void> {
    const usersCompleted = await this.findUsersCompletedForAction(actionId);
    await this.actionRepository.update(actionId, { usersCompleted });
  }

  async reloadAllActionUsersJoined(): Promise<void> {
    const actions = await this.actionRepository.find();
    for (const action of actions) {
      await this.reloadUsersJoinedForAction(action.id);
    }
  }

  async reloadUsersJoinedForAction(actionId: number): Promise<void> {
    const usersJoined = (
      await this.participants.findParticipantIdsForActionById(actionId)
    ).length;
    await this.actionRepository.update(actionId, { usersJoined });
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

    const joinedUserIds =
      await this.participants.findParticipantIdsForAction(action);

    const completions = await this.prerequisiteProgressService.loadCompletions({
      actionId,
    });
    const completedUserIds = new Set(completions.map((a) => a.userId));

    const incompleteUserIds = joinedUserIds.filter(
      (id) => !completedUserIds.has(id),
    );

    if (incompleteUserIds.length === 0) {
      return [];
    }

    return this.userService.findByIds(incompleteUserIds);
  }

  async findWelcomeQueue(): Promise<WelcomeQueue> {
    const onboardingActions = await this.actionRepository.find({
      where: {
        onboarding: true,
        optional: false,
        archived: false,
        preventCompletion: false,
      },
      relations: { events: true },
    });
    const requiredActions = onboardingActions
      .filter((action) => action.status === ActionStatus.MemberAction)
      .map(parseAction);
    const actionIds = requiredActions.map((action) => action.id);
    const requiredActionCount = actionIds.length;
    if (!requiredActionCount) return { requiredActionCount, members: [] };

    const rows = await this.actionActivityRepository.query<
      {
        userId: number;
        actionId: number;
        activityId: number;
        completedAt: Date;
        staffLikeCount: string;
      }[]
    >(
      `
        SELECT activity."userId", activity."actionId", activity.id AS "activityId",
          activity."createdAt" AS "completedAt", COUNT(staff_liker.id) AS "staffLikeCount"
        FROM action_activity activity
        LEFT JOIN action_activity_likes_user activity_like
          ON activity_like."actionActivityId" = activity.id
        LEFT JOIN "user" staff_liker
          ON staff_liker.id = activity_like."userId" AND staff_liker.staff = true
          AND staff_liker."deletedAt" IS NULL
        WHERE activity."actionId" = ANY($1::int[])
        AND ${sqlIsLatestCompletion("activity")}
        AND ${sqlUserHasEverSigned('activity."userId"')}
        AND NOT EXISTS (
          SELECT 1
          FROM action_activity completion
          INNER JOIN action ON action.id = completion."actionId" AND action.onboarding = true
            AND action."deletedAt" IS NULL
          INNER JOIN comment ON comment."parentObjectType" = $3
            AND comment."parentObjectId" = completion.id AND comment."deletedAt" IS NULL
          INNER JOIN "user" author ON author.id = comment."authorId" AND author.staff = true
            AND author."deletedAt" IS NULL
          WHERE completion."userId" = activity."userId" AND completion.type = $2
            AND completion."deletedAt" IS NULL
        )
        GROUP BY activity.id, activity."userId", activity."actionId", activity."createdAt"
        ORDER BY activity."createdAt" DESC, activity.id DESC
      `,
      [
        actionIds,
        ActionActivityType.USER_COMPLETED,
        CommentParentObject.Activity,
      ],
    );
    const rowsByUser = groupBy(rows, (row) => row.userId);
    const users = await this.userService.findByIds(
      Object.keys(rowsByUser).map(Number),
      { contractEvents: true },
    );
    const session = new CohortResolutionSession();
    session.candidateUserIds = Promise.resolve(
      new Set(users.map((user) => user.id)),
    );
    const cohorts = await Promise.all(
      requiredActions.map((action) =>
        this.cohortResolverService.resolveDecidedCohort({
          action,
          session,
        }),
      ),
    );

    const now = new Date();
    return {
      requiredActionCount,
      members: users
        .flatMap((user) => {
          const applicableActions = requiredActions.filter((action, index) =>
            computeCanCompleteAction({
              action,
              user,
              inCohort: cohorts[index].has(user.id),
              now,
            }),
          );
          const applicableIds = new Set(
            applicableActions.map((action) => action.id),
          );
          const completions = rowsByUser[user.id].filter((row) =>
            applicableIds.has(row.actionId),
          );
          const latest = completions[0];
          if (!latest || completions.length !== applicableIds.size) return [];
          return [
            {
              user,
              actionId: latest.actionId,
              activityId: latest.activityId,
              completedAt: latest.completedAt,
              staffLikeCount: Number(latest.staffLikeCount),
            },
          ];
        })
        .sort(
          (a, b) =>
            b.completedAt.getTime() - a.completedAt.getTime() ||
            b.activityId - a.activityId,
        ),
    };
  }

  /**
   * The viewer's {@link ViewerCohort} on one action — the single evaluation
   * feeding `canParticipate`/`viewer.canComplete`, `shouldParticipate`, and
   * `viewer`. No member-action-phase gate: the completion rule (unlike
   * assignment) applies to actions whose phase isn't scheduled yet, and
   * gating here made `viewer.canComplete` disagree with `findCompletionBlock`
   * (which the complete mutation enforces).
   */
  private async computeViewerCohort(params: {
    action: ParsedAction;
    user: User | null;
    session: CohortResolutionSession;
    now: Date;
    /** Actions to read from the live cohort; see `reconcileForUser`. */
    undecidedActionIds: ReadonlySet<number>;
  }): Promise<ViewerCohort> {
    const { action, user, session, now, undecidedActionIds } = params;
    if (!user) {
      return { admitted: false, eligible: false };
    }
    const [live, admittedActionIds] = await Promise.all([
      this.singleMemberCohortService.computeIsInActionCohort({
        user,
        action,
        session,
      }),
      this.cohortAdmissionService.loadAdmittedActionIds(user.id, session),
    ]);
    const admitted =
      readsSavedDecisions(action, now) && !undecidedActionIds.has(action.id)
        ? admittedActionIds.has(action.id)
        : live;
    return { admitted, eligible: admitted || live };
  }

  async findMemberPublic(
    userId?: number,
    sorted?: boolean,
  ): Promise<ActionDto[]> {
    const actions = sorted
      ? await this.findAllSorted(MEMBER_FEED_RELATIONS)
      : await this.actionRepository
          .find({
            relations: MEMBER_FEED_RELATIONS,
            relationLoadStrategy: "query",
          })
          .then((rows) => rows.map(parseAction));
    return this.buildMemberFeed(actions, userId);
  }

  /** The actions in their member-action phase, the only ones the task badge counts. */
  async findOpenActionIds(): Promise<number[]> {
    const actions = await this.actionRepository.find({
      select: { id: true, events: { id: true, date: true, newStatus: true } },
      relations: { events: true },
    });
    return actions
      .filter((action) => action.status === ActionStatus.MemberAction)
      .map((action) => action.id);
  }

  /** The member feed for the given actions, keeping those still open. */
  async findMemberOpen(params: {
    userId: number;
    openActionIds: number[];
  }): Promise<ActionDto[]> {
    const actions = await this.actionRepository
      .find({
        where: { id: In(params.openActionIds) },
        relations: MEMBER_FEED_RELATIONS,
        relationLoadStrategy: "query",
      })
      .then((rows) => rows.map(parseAction));
    return this.buildMemberFeed(
      actions.filter((action) => action.status === ActionStatus.MemberAction),
      params.userId,
    );
  }

  private async buildMemberFeed(
    actions: ParsedAction[],
    userId?: number,
  ): Promise<ActionDto[]> {
    const user = userId
      ? await this.userService.findOne(userId, {
          tags: true,
          awayRanges: true,
          contractEvents: true,
          activities: true,
        })
      : null;

    const now = new Date();
    const undecidedActionIds = user
      ? await this.cohortDecisionService.reconcileForUser({
          user,
          actions,
          now,
        })
      : new Set<number>();

    // One session for the whole feed: every action re-asks the same per-user
    // leaf questions, and the answers can't change mid-request.
    const session = new CohortResolutionSession();

    const filtered = await this.actionVisibility.listableActions({
      actions,
      user,
      session,
    });

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

    return await Promise.all(
      filtered.map(async (action) => {
        const cohort = await this.computeViewerCohort({
          action,
          user,
          session,
          now,
          undecidedActionIds,
        });
        const shouldParticipate =
          computeActionAssignment({
            action,
            user,
            inCohort: cohort.admitted,
            dismissed: actionsDismissed.has(action.id),
            now,
          }) !== ActionAssignment.Unassigned;

        action.followUpForms = await this.filterFollowUpFormsByCohort({
          followUpForms: loadedActionFollowUpForms(action),
          user,
          session,
        });

        return new ActionDto(action, {
          canParticipate: user
            ? computeCanCompleteAction({
                action,
                user,
                inCohort: cohort.eligible,
                now,
              })
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
                  cohort,
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
    /** Share per-user leaf lookups; see SingleMemberCohortService.computeIsInCohortExpression. */
    session?: CohortResolutionSession;
  }): Promise<ParsedAction> {
    const {
      id,
      userId,
      serverSide = false,
      includeUnpublishedUpdates = false,
      session,
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
        project: true,
        authors: true,
        followUpForms: { form: true },
        reviewers: true,
      },
      relationLoadStrategy: "query",
    });
    const action = fetched ? parseAction(fetched) : null;

    if (action && !includeUnpublishedUpdates) {
      const now = new Date();
      action.updates = action.updates?.filter((update) =>
        isActionUpdatePublished(update, now),
      );
    }

    if (
      !action ||
      !(
        (await this.actionVisibility.userCanOpenAction({
          action,
          user,
          session,
        })) || serverSide
      )
    ) {
      throw new NotFoundException("Action not found");
    }
    return action;
  }

  async findOneDto(
    id: number,
    userId?: number,
    serverSide = false,
  ): Promise<ActionDto> {
    const user = userId
      ? await this.userService.findOne(userId, {
          tags: true,
          contractEvents: true,
          awayRanges: true,
        })
      : null;
    const now = new Date();
    const target = user
      ? await this.actionRepository.findOne({
          where: { id },
          relations: { events: true },
        })
      : null;
    const undecidedActionIds =
      user && target
        ? await this.cohortDecisionService.reconcileForUser({
            user,
            actions: [parseAction(target)],
            now,
          })
        : new Set<number>();
    const session = new CohortResolutionSession();
    const action = await this.findOneOrFail({
      id,
      userId,
      serverSide,
      session,
    });
    action.followUpForms = await this.filterFollowUpFormsByCohort({
      followUpForms: loadedActionFollowUpForms(action),
      user,
      session,
    });
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
    const cohort = await this.computeViewerCohort({
      action,
      user,
      session,
      now,
      undecidedActionIds,
    });

    return new ActionDto(action, {
      canParticipate: user
        ? computeCanCompleteAction({
            action,
            user,
            inCohort: cohort.eligible,
            now,
          })
        : false,
      shouldParticipate:
        computeActionAssignment({
          action,
          user,
          inCohort: cohort.admitted,
          dismissed,
          now,
        }) !== ActionAssignment.Unassigned,
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
        ? resolveUserActionStatus({ action, user, cohort, activities, now })
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

    const saved = await this.generalUpdateRepository.manager.transaction(
      async (em) => {
        await lockLiveTagsAndSuites(em, generalUpdate);
        return em.save(generalUpdate);
      },
    );

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
          "expectedSchemaSnapshotId is required when writing schema",
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
          "SELECT id FROM general_update WHERE id = $1 FOR UPDATE",
          [id],
        );
        const generalUpdate = await this.findOneGeneralUpdate(id, em);

        if (schemaWrite) {
          const written = await this.schemaWrite.writeSchemaOrThrow({
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

        await lockLiveTagsAndSuites(em, generalUpdate);
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
    await softDeleteWhere(this.generalUpdateRepository.manager, {
      target: GeneralUpdate,
      where: { id },
    });
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

    const isDateChanged = (current: Date | null, next?: Date): boolean =>
      next !== undefined && current?.getTime() !== next.getTime();

    const dateUpdates = generalUpdates.flatMap((generalUpdate) => {
      const suite = generalUpdate.suites![0];
      const action = suite && loadedActionSuiteActions(suite)[0];
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
          participatingTagIdSet: new Set(
            loadedGeneralUpdateTags(update).map((tag) => tag.id),
          ),
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
        "General update not found or already dismissed",
      );
    }

    await writeUnderLive(this.generalUpdateActivityRepository.manager, {
      parents: [
        { target: User, id: userId },
        { target: GeneralUpdate, id: generalUpdateId },
      ],
      write: (em) =>
        em.save(
          em.create(GeneralUpdateActivity, {
            generalUpdate: { id: generalUpdateId },
            user: { id: userId },
            type: GeneralUpdateActivityType.DISMISSED,
            createdAt: new Date(),
          }),
        ),
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
    now?: Date;
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
      now = new Date(),
    } = options;
    const action = await this.findOneOrFail({ id: actionId, userId });

    if (!adminCreated) {
      assertNotInStaffPreview(action);
    }

    if (
      type === ActionActivityType.USER_WONT_COMPLETE &&
      action.isContractSigningAction &&
      !adminCreated
    ) {
      throw new BadRequestException(
        "Contract signing actions cannot be withdrawn from",
      );
    }

    if (type === ActionActivityType.USER_COMPLETED && !adminCreated) {
      await this.ensureCompletionAllowed({ action, userId, now });
    }

    const user = await this.userService.findOneOrFail(userId);

    if (!ALLOW_DUPLICATE[type]) {
      const existingActivity = await this.actionActivityRepository.findOne({
        where: { actionId, userId, type },
      });
      if (existingActivity) {
        throw new BadRequestException("Activity already exists");
      }
    }

    const activity = this.actionActivityRepository.create({
      type: type,
      actionId: actionId,
      userId: userId,
      action: action,
      user: user,
      taskFormResponse,
      declineReason: declineReason ?? null,
      outOfTime: isOutOfTime,
      isMoral,
      source: adminCreated
        ? ActivitySource.ADMIN_OVERRIDE
        : ActivitySource.USER,
    });
    const savedActivity = await writeUnderLive(
      this.actionActivityRepository.manager,
      {
        parents: [
          {
            target: Action,
            id: actionId,
            notFound: "That action is no longer here",
          },
          { target: User, id: userId },
          ...(taskFormResponse
            ? [
                {
                  target: FormResponse,
                  id: taskFormResponse.id,
                  notFound: "That form response is no longer here",
                },
              ]
            : []),
        ],
        write: (manager) => manager.save(activity),
      },
    );

    if (type === ActionActivityType.USER_WONT_COMPLETE) {
      const option = withdrawalOptionFromFlags({
        outOfTime: isOutOfTime,
        isMoral,
      });
      const trimmedReason = declineReason?.trim();
      // Spread to code points so truncation can't split a surrogate pair
      // (e.g. an emoji) at the boundary.
      const reasonChars = trimmedReason ? [...trimmedReason] : [];
      const reason =
        reasonChars.length > OPT_OUT_REASON_PREVIEW_LENGTH
          ? `${reasonChars.slice(0, OPT_OUT_REASON_PREVIEW_LENGTH).join("")}...`
          : trimmedReason;
      const label = adminCreated
        ? "admin-created"
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

    this.eventEmitter.emit("action.activity", {
      actionId,
      activity: new ActionActivityDto(savedActivity),
    });

    await this.reloadUsersJoinedForAction(actionId);
    if (isTerminalActivity(savedActivity)) {
      await this.reloadUsersCompletedForAction(actionId);
    }
    if (type === ActionActivityType.USER_COMPLETED) {
      if (!adminCreated) {
        this.posthogService.capture({
          event: AnalyticsEvent.ActionCompleted,
          distinctId: String(userId),
          properties: { actionId, actionName: action.name },
        });
      }
    }

    return savedActivity;
  }

  async completeAction(
    actionId: number,
    userId: number,
    options: {
      taskFormResponse?: FormResponse;
      adminCreated?: boolean;
      now?: Date;
    } = {},
  ): Promise<ActionActivity> {
    return this.createActionActivity({
      actionId,
      userId,
      type: ActionActivityType.USER_COMPLETED,
      taskFormResponse: options.taskFormResponse,
      adminCreated: options.adminCreated,
      now: options.now,
    });
  }

  /**
   * Both image columns are served as urls, so an editor seeded from the api
   * sends one back on its next save. Dropping the echo keeps the upload key,
   * which renders correctly in every environment.
   */
  private dropEchoedImages(
    next: Pick<UpdateActionDto, "image" | "squareThumbnailImage">,
    stored: Pick<Action, "image" | "squareThumbnailImage">,
  ): void {
    for (const column of ["image", "squareThumbnailImage"] as const) {
      const value = next[column];
      // null clears the column, so only a string can be an echo.
      if (typeof value !== "string") {
        continue;
      }
      if (echoesStoredKey({ next: value, stored: stored[column] })) {
        this.logger.warn(
          `Ignored an action ${column} that echoes the stored key: ${value.slice(0, 100)}`,
        );
        delete next[column];
      }
    }
  }

  async update(
    id: number,
    updateActionDto: UpdateActionDto,
    userId: number,
  ): Promise<ParsedAction> {
    const action: DeepPartial<Action> | null =
      await this.actionRepository.findOne({
        where: { id },
        relations: {
          authors: true,
          suite: true,
        },
      });

    if (!action) {
      throw new NotFoundException("Action not found");
    }
    const oldSuiteId = action.suite?.id;

    const { suiteId, authorIds, reviewers, ...rest } = updateActionDto;
    this.dropEchoedImages(rest, action);
    if (rest.cohortExpression != null) {
      rest.cohortExpression = await this.parseCohortExpressionForSaveOrThrow(
        rest.cohortExpression,
        action.cohortExpression,
      );
    }

    if (
      rest.optional === false &&
      action.optional === true &&
      (await this.cohortDecisionStaffService.hasDecisions(id))
    ) {
      throw new BadRequestException(
        "Optional can't change to mandatory once members have cohort decisions for this action.",
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

    const previousTaskFormId = action.taskFormId;
    Object.assign(action, rest);

    // Replacing reviewers soft-deletes the dropped ones before the save;
    // without one transaction a failed save still drops them.
    await writeUnderLive(this.actionRepository.manager, {
      parents: [
        ...(suiteId == null ? [] : [{ target: ActionSuite, id: suiteId }]),
        ...(action.authors ?? []).flatMap((author) =>
          author.id === undefined ? [] : [{ target: User, id: author.id }],
        ),
        ...(rest.taskFormId == null || rest.taskFormId === previousTaskFormId
          ? []
          : [{ target: Form, id: rest.taskFormId }]),
      ],
      notFound: ACTION_PARENT_GONE,
      saved: {
        target: Action,
        id,
        notFound: "Action not found",
      },
      write: async (em) => {
        if (reviewers !== undefined) {
          action.reviewers = await replaceReviewers({
            em,
            actionId: id,
            rows: this.reviewerRows(reviewers),
          });
        }
        await em.save(Action, action);
        if (rest.prerequisiteActionIds !== undefined) {
          await assertPrerequisitesValid({ em, actionIds: [id] });
        }
      },
    });
    const newSuiteId = action.suite?.id;
    await this.syncGeneralUpdateDatesForSuites([oldSuiteId, newSuiteId]);

    return this.findOneOrFail({ id, userId });
  }

  async addEvent(params: {
    actionId: number;
    event: CreateActionEventDto;
    userId?: number;
    acknowledgeDeadlineShortening: boolean;
  }): Promise<ActionEvent> {
    const { actionId, event, userId, acknowledgeDeadlineShortening } = params;
    const action = await this.findOneOrFail({ id: actionId, userId });
    const [savedEvent] = await this.addEventToActions({
      actions: [action],
      event,
      acknowledgeDeadlineShortening,
    });
    return savedEvent;
  }

  private async addEventToActions(params: {
    actions: Action[];
    event: CreateActionEventDto;
    overrides?: Partial<ActionEvent>;
    suiteIds?: number[];
    acknowledgeDeadlineShortening: boolean;
  }): Promise<ActionEvent[]> {
    const { actions, event, overrides, suiteIds } = params;
    let saved: ActionEvent[];
    try {
      saved = await this.cohortDecisionStaffService.guardDeadlineShortening({
        actionIds: actions.map((action) => action.id),
        acknowledged: params.acknowledgeDeadlineShortening,
        change: async (manager) => {
          await assertLive(manager, {
            rows: actions.map((action) => ({ target: Action, id: action.id })),
            gone: () => new NotFoundException("Action not found"),
          });
          const events: ActionEvent[] = [];
          for (const action of actions) {
            const newEvent = manager.create(ActionEvent, {
              ...event,
              ...overrides,
              action,
            });
            events.push(await manager.save(newEvent));
          }
          await assertPrerequisitesValid({
            em: manager,
            actionIds: actions.map((action) => action.id),
          });
          return events;
        },
      });
    } catch (err) {
      if (
        err?.code === "23505" &&
        err?.constraint === "UQ_action_event_one_member_action"
      ) {
        throw new BadRequestException(
          "An action can only have one member_action event",
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
    await this.actionRepository.manager.transaction(async (em) => {
      await softDeleteWhere(em, { target: Action, where: { id } });
      await assertNotAPrerequisite({ em, actionId: id });
      await assertNotInACohort({ em, actionId: id });
    });
    await this.syncGeneralUpdateDatesForSuites([action?.suite?.id]);
  }

  async createFollowUpForm(
    actionId: number,
    dto: CreateFollowUpFormDto,
  ): Promise<ParsedFollowUpForm> {
    if (dto.cohortExpression != null) {
      dto.cohortExpression = await this.parseCohortExpressionForSaveOrThrow(
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
    return writeUnderLive(this.followUpFormRepository.manager, {
      parents: [
        { target: Action, id: actionId },
        { target: Form, id: form.id },
      ],
      notFound: "Action or form not found",
      write: async (em) => parseFollowUpForm(await em.save(followUpForm)),
    });
  }

  async updateFollowUpForm(
    followUpFormId: number,
    dto: UpdateFollowUpFormDto,
  ): Promise<ParsedFollowUpForm> {
    const followUpForm = await this.followUpFormRepository.findOneByOrFail({
      id: followUpFormId,
    });
    if (dto.cohortExpression != null) {
      dto.cohortExpression = await this.parseCohortExpressionForSaveOrThrow(
        dto.cohortExpression,
        followUpForm.cohortExpression,
      );
    }
    Object.assign(followUpForm, dto);
    return writeUnderLive(this.followUpFormRepository.manager, {
      parents:
        dto.formId === undefined ? [] : [{ target: Form, id: dto.formId }],
      saved: {
        target: FollowUpForm,
        id: followUpFormId,
        notFound: "Follow-up form not found",
      },
      write: async (em) => parseFollowUpForm(await em.save(followUpForm)),
    });
  }

  async deleteFollowUpForm(followUpFormId: number): Promise<void> {
    const followUpForm = await this.followUpFormRepository.findOne({
      where: { id: followUpFormId },
    });
    if (followUpForm) {
      await softDeleteCascade(this.followUpFormRepository.manager, {
        target: FollowUpForm,
        ids: [followUpForm.id],
      });
    }
  }

  async findCompletionBlock(params: {
    action: ParsedAction;
    user: User;
    now: Date;
  }): Promise<CompletionBlock | null> {
    const { action, user, now } = params;
    // preventCompletion short-circuits before the DB-hitting cohort
    // evaluation; the rule itself lives in computeCompletionBlock.
    if (action.preventCompletion) {
      return CompletionBlock.PreventCompletion;
    }

    const cohort = await this.computeViewerCohort({
      action,
      user,
      session: new CohortResolutionSession(),
      now,
      undecidedActionIds: new Set(),
    });

    return computeCompletionBlock({
      action,
      user,
      inCohort: cohort.eligible,
      now,
    });
  }

  async ensureCompletionAllowed(params: {
    action: ParsedAction;
    userId: number;
    now: Date;
  }) {
    const { action, userId, now } = params;
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      contractEvents: true,
      awayRanges: true,
    });
    const block = await this.findCompletionBlock({ action, user, now });
    if (block !== null) {
      throw new ForbiddenException(COMPLETION_BLOCK_MESSAGE[block]);
    }
  }

  async countCommunityCompletedActions(
    userId: number,
    communityId: number,
  ): Promise<number> {
    const memberRow = await this.communityRepository
      .createQueryBuilder("c")
      .select("c.id", "id")
      .innerJoin(
        "community_users_user",
        "cuu",
        'cuu."communityId" = c.id AND cuu."userId" = :userId',
        { userId },
      )
      .where("c.id = :communityId", { communityId })
      .getRawOne<{ id: number }>();

    if (!memberRow) {
      await this.communityRepository.findOneOrFail({
        where: { id: communityId },
        select: { id: true },
      });
      throw new NotFoundException("User is not a member of this community");
    }

    return this.actionActivityRepository
      .createQueryBuilder("activity")
      .innerJoin(
        "community_users_user",
        "cuu",
        'cuu."userId" = activity.userId AND cuu."communityId" = :communityId',
        { communityId },
      )
      .where(sqlIsLatestCompletion("activity"))
      .getCount();
  }

  async findByName(
    name: string,
    requestingUserId: number,
  ): Promise<ParsedAction[]> {
    const [actions, user] = await Promise.all([
      this.actionRepository.find({
        where: { name: ILike(`%${name}%`) },
        relations: { events: true },
      }),
      this.actionVisibility.loadUserForActionVisibility(requestingUserId),
    ]);
    return this.actionVisibility.listableActions({
      actions: actions.map(parseAction),
      user,
    });
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

  archive(id: number): Promise<ParsedAction> {
    return this.setArchived({ id, archived: true });
  }

  unarchive(id: number): Promise<ParsedAction> {
    return this.setArchived({ id, archived: false });
  }

  // updateLive() rather than save(): saving the loaded action would also diff
  // its relations, unlinking any follow-up form added since the load.
  private async setArchived(params: {
    id: number;
    archived: boolean;
  }): Promise<ParsedAction> {
    const { id, archived } = params;
    await updateLive(this.actionRepository.manager, {
      target: Action,
      id,
      changes: { archived },
      notFound: "Action not found",
    });
    return parseAction(
      await this.actionRepository.findOneOrFail({
        where: { id },
        relations: { reviewers: true, events: true, followUpForms: true },
      }),
    );
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

    const actionUpdate = await writeUnderLive(
      this.actionUpdateRepository.manager,
      {
        parents: [
          { target: Action, id: action.id, notFound: "Action not found" },
          ...(tag ? [{ target: Tag, id: tag.id }] : []),
          ...(associatedEvent
            ? [{ target: ActionEvent, id: associatedEvent.id }]
            : []),
        ],
        write: (em) =>
          em.save(
            em.create(ActionUpdate, {
              ...createActionUpdateDto,
              notificationMode: ActionUpdateNotificationMode.Normal,
              schemaSnapshotId: emptySnapshot.id,
              visibleAt: null,
              action,
              tag,
              associatedEvent,
            }),
          ),
      },
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
      owner: "ActionUpdate",
      ownerId: actionUpdate.id,
      snapshot: actionUpdate.schemaSnapshot,
    });

    if (actionUpdate.notifyType === ActionUpdateNotifyType.None) {
      throw new BadRequestException(
        "This update has no notification audience set.",
      );
    }
    if (schema.blocks.length === 0) {
      throw new BadRequestException(
        "Write the update body before sending the notification.",
      );
    }
    if (actionUpdate.notifiedAt) {
      throw new ConflictException(
        "This update has already been notified about.",
      );
    }
    await this.assertActionShowsWhenEntriesArrive(actionUpdate);

    // Resolve the audience before claiming: a failure here (a deleted tag, say)
    // has sent nothing, and leaving the claim unset keeps the retry open.
    const recipients = await this.findActionUpdateNotifRecipients(actionUpdate);
    const recognition = usesRecognition(actionUpdate.notificationMode);
    if (recognition) {
      const config = readRecognitionConfig(actionUpdate);
      if (!config.ok) throw new BadRequestException(config.error);
    }

    // The claim and the sends commit together. The claim is the only thing
    // standing between a retry and a second notification, so committing it
    // before the rows exist would let a crash partway through leave most of the
    // audience unnotified and unreachable: the retry would see the claim and
    // conflict.
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      // An archive of the action waits until the sends commit. Locking the
      // action before the update matches the order deleting an action takes.
      const lockedActions: unknown[] = await em.query(
        'SELECT id FROM action WHERE id = $1 AND "deletedAt" IS NULL FOR SHARE',
        [actionUpdate.actionId],
      );
      if (lockedActions.length === 0) {
        throw new NotFoundException("This update's action has been deleted.");
      }

      const claimed = await em
        .createQueryBuilder()
        .update(ActionUpdate)
        .set({ notifiedAt: new Date() })
        .where("id = :id", { id })
        .andWhere('"notifiedAt" IS NULL')
        .execute();

      if (claimed.affected === 0) {
        throw new ConflictException(
          "This update has already been notified about.",
        );
      }

      // The claim holds the row lock, so this reads the update as of any
      // edit or unpublish that committed first.
      const claimedUpdate = await em.findOneBy(ActionUpdate, { id });
      if (!claimedUpdate) {
        throw new NotFoundException("This update has been deleted.");
      }
      await this.assertActionShowsWhenEntriesArrive(claimedUpdate, em);
      if (recognition) {
        await this.recognitionService.recordAudience({
          em,
          actionUpdateId: id,
          userIds: recipients.map((user) => user.id),
        });
      } else {
        await this.notifsService.createActionUpdateNotifs({
          actionUpdate: claimedUpdate,
          users: recipients,
          em,
        });
      }
    });

    if (recognition) {
      // The send is already claimed and the cron retries preparing it, so a
      // failure here mustn't report the send itself as failed.
      await this.recognitionService
        .prepare(id, new Date())
        .catch((error: unknown) =>
          this.logger.error(`preparing action update ${id} failed`, error),
        );
    }
    return this.findOneActionUpdate(id);
  }

  private async assertActionShowsWhenEntriesArrive(
    actionUpdate: ActionUpdate,
    em: EntityManager = this.actionUpdateRepository.manager,
  ) {
    const action = await em.findOneOrFail(Action, {
      where: { id: actionUpdate.actionId },
      relations: { events: true },
    });
    const check = checkActionShowsWhenEntriesArrive({
      action: { archived: action.archived, events: loadedActionEvents(action) },
      actionUpdate,
      now: new Date(),
    });
    if (!check.ok) {
      throw new BadRequestException(check.error);
    }
  }

  private async lockActionUpdate(
    id: number,
    em: EntityManager,
  ): Promise<ActionUpdate> {
    await lockActionUpdateRow(em, id);
    return this.findOneActionUpdate(id, em);
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
          "expectedSchemaSnapshotId is required when writing schema",
        );
      }
      return { schema, expectedSchemaSnapshotId };
    });

    // The freeze takes its own pool connections, so it runs before the
    // transaction rather than while holding one.
    if (
      rest.shortNotifString !== undefined &&
      rest.shortNotifString !==
        (await this.actionUpdateRepository.findOneByOrFail({ id }))
          .shortNotifString
    ) {
      await this.notifsService.freezeActionUpdateCopy(id);
    }

    // Same locking rationale as `updateGeneralUpdate`: `save` writes back every
    // column that differs from the entity read here, so an unlocked
    // read-modify-write would revert a concurrent schema save.
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      // The action first: deleting it locks the action before any of its
      // cascades reach the update or event, whichever order those fire in.
      const { actionId } = await em.findOneByOrFail(ActionUpdate, { id });
      await assertLive(em, {
        rows: [
          { target: Action, id: actionId },
          ...(tagId == null ? [] : [{ target: Tag, id: tagId }]),
          ...(associatedEventId == null
            ? []
            : [{ target: ActionEvent, id: associatedEventId }]),
        ],
        gone: () => new NotFoundException("Action, tag or event not found"),
      });
      const actionUpdate = await this.lockActionUpdate(id, em);
      // Before the schema write, so publishing sees the `date` this request sets.
      Object.assign(actionUpdate, rest);
      const now = new Date();
      if (
        rest.date !== undefined &&
        actionUpdate.visibleAt !== null &&
        actionUpdate.visibleAt > now
      ) {
        actionUpdate.visibleAt = max([now, actionUpdate.date]);
      }

      if (schemaWrite) {
        const written = await this.schemaWrite.writeSchemaOrThrow({
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
          actionUpdate.visibleAt = max([now, actionUpdate.date]);
        }
      }

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
      if (rest.date !== undefined) {
        await this.notifsService.retimeActionUpdateEntries({
          em,
          actionUpdateId: id,
          sendTime: actionUpdateEntrySendTime(actionUpdate),
        });
      }
    });

    return this.findOneActionUpdate(id);
  }

  /**
   * Hides a published update again until its displayed date, for one whose
   * date was moved later after it published. Moving `visibleAt` up to `date`
   * lets the `visibleAt <= now` gate republish it when that date arrives.
   */
  async unpublishActionUpdateUntilDate(id: number): Promise<ActionUpdate> {
    // Before the transaction, as in `updateActionUpdate`.
    await this.notifsService.freezeActionUpdateCopy(id);
    await this.actionUpdateRepository.manager.transaction(async (em) => {
      const actionUpdate = await this.lockActionUpdate(id, em);
      const now = new Date();

      if (actionUpdate.visibleAt === null) {
        throw new BadRequestException(
          "This update has not been published yet.",
        );
      }
      if (actionUpdate.date <= now) {
        throw new BadRequestException(
          "The displayed date has already passed, so hiding the update until then would leave it visible.",
        );
      }

      await em.update(ActionUpdate, id, { visibleAt: actionUpdate.date });
      await this.notifsService.retimeActionUpdateEntries({
        em,
        actionUpdateId: id,
        sendTime: actionUpdate.date,
      });
    });

    return this.findOneActionUpdate(id);
  }

  /**
   * Undoes `unpublishActionUpdateUntilDate` before the date it waits for. The
   * entries it moved to that date stay there.
   */
  async publishActionUpdateNow(id: number): Promise<ActionUpdate> {
    const actionUpdate = await this.findOneActionUpdate(id);
    const now = new Date();

    if (actionUpdate.visibleAt === null || actionUpdate.visibleAt <= now) {
      throw new BadRequestException(
        "This update is not waiting on a future date.",
      );
    }

    await this.actionUpdateRepository.update(id, { visibleAt: now });

    return this.findOneActionUpdate(id);
  }

  async deleteActionUpdate(id: number) {
    const actionUpdate = await this.actionUpdateRepository.findOneOrFail({
      where: { id },
    });
    await softDeleteCascade(this.actionUpdateRepository.manager, {
      target: ActionUpdate,
      ids: [actionUpdate.id],
    });
    return actionUpdate;
  }

  async getActionUpdates(
    limit?: number,
    userId?: number,
  ): Promise<ActionUpdate[]> {
    const updates = await this.actionUpdateRepository.find({
      where: publishedActionUpdateWhere(new Date()),
      order: { date: "DESC" },
      relations: { action: true, schemaSnapshot: true },
      select: {
        action: {
          name: true,
        },
      },
    });
    const visibleIds = await this.actionVisibility.visibleActionIdsForUser({
      actionIds: updates.map((update) => update.actionId),
      userId,
    });
    const visible = updates.filter((update) => visibleIds.has(update.actionId));
    return limit != null ? visible.slice(0, limit) : visible;
  }

  private async findActionUpdateNotifRecipients(
    actionUpdate: ActionUpdate,
  ): Promise<User[]> {
    return this.findActionUpdateAudience({
      actionId: actionUpdate.actionId,
      notifyType: actionUpdate.notifyType,
      tagId: actionUpdate.tag?.id ?? null,
      decideCohort: true,
    });
  }

  /** Without `decideCohort`, reads only saved cohort decisions and writes nothing. */
  private async findActionUpdateAudience(params: {
    actionId: number;
    notifyType: ActionUpdateNotifyType;
    tagId: string | null;
    decideCohort: boolean;
  }): Promise<User[]> {
    const { actionId, notifyType, tagId } = params;
    switch (notifyType) {
      case ActionUpdateNotifyType.None:
        return [];
      case ActionUpdateNotifyType.ActionCohort: {
        const action = await this.participants.findParticipantAction(actionId);
        if (params.decideCohort) {
          // One send and no retry, so it cannot wait for the pass.
          await this.cohortDecisionService.decideOpenAction(action, new Date());
        }
        const userIds =
          await this.participants.findParticipantIdsForAction(action);
        return this.userService.findByIds(userIds);
      }
      case ActionUpdateNotifyType.Tag: {
        if (!tagId) {
          throw new BadRequestException("Tag is required");
        }
        return loadedTagUsers(await this.tagService.findTagOrFail(tagId));
      }
      case ActionUpdateNotifyType.AllMembers:
        return this.userService.findUsersWithActiveContract();
      default:
        throw new Error(`unknown notifyType: ${notifyType satisfies never}`);
    }
  }

  async previewActionUpdateRecognitionCounts(
    id: number,
    audience: { notifyType: ActionUpdateNotifyType; tagId: string | null },
  ): Promise<RecognitionPreviewCounts> {
    const { actionId } = await this.findOneActionUpdate(id);
    const recipients = await this.findActionUpdateAudience({
      actionId,
      ...audience,
      decideCohort: false,
    });
    return this.recognitionPreview.counts({
      actionId,
      userIds: recipients.map((user) => user.id),
    });
  }

  async findSuites(): Promise<ActionSuite[]> {
    return this.actionSuiteRepository.find();
  }

  async findSuite(id: number): Promise<ParsedActionSuite> {
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id },
      relations: {
        actions: { events: true, activities: true, reviewers: true },
        reminderGroups: { memberActionEvent: true, deadlineEvent: true },
        generalUpdates: { schemaSnapshot: true },
      },
      relationLoadStrategy: "query",
    });
    return parseActionSuite(suite);
  }

  async createSuite(
    createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuite> {
    const suite = this.actionSuiteRepository.create(createActionSuiteDto);
    const saved = await this.actionSuiteRepository.save(suite);
    await this.syncGeneralUpdateDatesForSuites([suite.id]);
    return saved;
  }

  async batchUpdateSuiteEvents(params: {
    suiteId: number;
    eventId: number;
    body: UpdateActionEventDto;
    acknowledgeDeadlineShortening: boolean;
  }) {
    const { suiteId, eventId, body } = params;
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: { events: true } },
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: { events: true } },
    });
    const eventAction = loadedActionEventAction(event);
    const eventIdx = loadedActionEvents(eventAction)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .findIndex((event) => event.id === eventId);
    const eventsToUpdate = new Set<number>([eventId]);

    const suiteActions = loadedActionSuiteActions(suite);
    for (const action of suiteActions) {
      const events = loadedActionEvents(action);
      if (events.length <= eventIdx) {
        throw new BadRequestException(
          "Events do not have equivalent events to edit",
        );
      }
      const possibleEvent = events.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      )[eventIdx];
      if (
        possibleEvent.newStatus === event.newStatus &&
        possibleEvent.suiteManaged
      ) {
        eventsToUpdate.add(possibleEvent.id);
      }
    }

    const actionIds = [
      eventAction.id,
      ...suiteActions.map((action) => action.id),
    ];
    await this.cohortDecisionStaffService.guardDeadlineShortening({
      actionIds,
      acknowledged: params.acknowledgeDeadlineShortening,
      change: async (em) => {
        for (const id of eventsToUpdate) {
          await em.update(ActionEvent, id, body);
        }
        await assertPrerequisitesValid({ em, actionIds });
      },
    });
    await this.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.findSuite(suiteId);
  }

  async addSuiteEvent(params: {
    suiteId: number;
    event: CreateActionEventDto;
    acknowledgeDeadlineShortening: boolean;
  }) {
    const { suiteId, event, acknowledgeDeadlineShortening } = params;
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: true },
    });

    await this.addEventToActions({
      actions: loadedActionSuiteActions(suite),
      event,
      overrides: { suiteManaged: true },
      suiteIds: [suiteId],
      acknowledgeDeadlineShortening,
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
    const eventIdx = loadedActionEvents(loadedActionEventAction(event))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .findIndex((event) => event.id === eventId);

    const suiteActions = loadedActionSuiteActions(suite);
    await this.actionEventRepository.manager.transaction(async (em) => {
      for (const action of suiteActions) {
        const events = loadedActionEvents(action);
        if (events.length <= eventIdx) {
          throw new BadRequestException(
            "Events do not have equivalent events to delete",
          );
        }
        const possibleEvent = events.sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        )[eventIdx];
        if (
          possibleEvent.newStatus === event.newStatus &&
          possibleEvent.suiteManaged
        ) {
          console.log("deleting event", possibleEvent.id);
          await softDeleteCascade(em, {
            target: ActionEvent,
            ids: [possibleEvent.id],
          });
        }
      }
      await assertPrerequisitesValid({
        em,
        actionIds: suiteActions.map((action) => action.id),
      });
    });
    await this.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.findSuite(suiteId);
  }

  async tentativePlansForGroup(
    eventId: number,
    body: CreateReminderGroupDto,
  ): Promise<NotificationPlan[]> {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: {
        action: {
          events: true,
        },
      },
    });
    const fields = await this.reminderGroupService.reminderGroupFieldsFromDto(
      body,
      event,
    );

    let actionSuite: ActionSuite | undefined = undefined;
    if (body.suiteId) {
      actionSuite = await this.actionSuiteRepository.findOneOrFail({
        where: { id: body.suiteId },
        relations: { actions: true },
      });
    }

    const withDeadlineEvent =
      await this.reminderGroupService.attachSendableDeadlineEvent({
        ...fields,
        id: 0,
        name: "Tentative Reminder Group",
        memberActionEvent: event,
        notifications: [],
        allSent: false,
        actionSuite,
        deletedAt: null,
      } satisfies ReminderGroup);

    return this.actionEventReminderService.findPlansForGroup(
      withDeadlineEvent,
      new Date(Date.now() - NOTIFICATION_LOOKBACK_WINDOW_MS),
      new Date(Date.now() + milliseconds({ days: 30 })),
    );
  }

  async findUncompletedTasks(
    userId: number,
    suiteId?: number,
  ): Promise<ActionDto[]> {
    const actions = (await this.findMemberPublic(userId))
      .filter(
        (action) =>
          action.status !== ActionStatus.Draft &&
          action.viewer?.assigned &&
          // Action-wide optional tasks stay; reminder groups drop those
          // through `excludeOptionalActions`.
          !(action.viewer?.optional && !action.optional) &&
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

    const suiteActions = loadedActionSuiteActions(suite);
    return actions.filter((action) =>
      suiteActions.some((a) => a.id === action.id),
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
      reviewers: true,
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
      ? await this.reminderGroupService.getReminderGroupsForEvent(action.id)
      : undefined;

    return new ExportActionDto(action, {
      taskForm: taskFormEntity,
      reminderGroups,
    });
  }

  async importAction(json: string): Promise<ParsedAction> {
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
      reviewers,
      project: _project,
      // Action ids name different actions in another environment.
      prerequisiteActionIds: _prerequisiteActionIds,
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

    const cohortExpression =
      actionCols.cohortExpression == null
        ? undefined
        : await this.parseCohortExpressionForSaveOrThrow(
            actionCols.cohortExpression,
          );

    let suiteIdToSync: number | undefined;
    const result = await this.actionRepository.manager.transaction(
      async (em) => {
        const actionRepo = em.getRepository(Action);
        const suiteRepo = em.getRepository(ActionSuite);
        const formRepo = em.getRepository(Form);
        const eventRepo = em.getRepository(ActionEvent);

        const inserted = await actionRepo.insert({
          ...actionCols,
          cohortExpression,
          id: undefined,
        });

        const actionId = inserted.identifiers[0].id as number;

        if (reviewers?.length) {
          await em.getRepository(ActionReviewer).insert(
            [...reviewers]
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((reviewer, position) => ({
                name: reviewer.name,
                url: reviewer.url ?? null,
                icon: reviewer.icon ?? null,
                position,
                actionId,
              })),
          );
        }

        if (suite) {
          let foundSuite = await suiteRepo.findOne({
            where: { name: suite.name },
            lock: { mode: "for_key_share" },
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
          await writeUnderLive(em, {
            parents: authors.map((a) => ({ target: User, id: a.id })),
            notFound: "That author is gone",
            write: () =>
              actionRepo
                .createQueryBuilder()
                .relation(Action, "authors")
                .of(actionId)
                .add(authors.map((a) => ({ id: a.id }))),
          });
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
          relations: { reviewers: true, events: true, followUpForms: true },
        });
      },
    );
    await this.syncGeneralUpdateDatesForSuites([suiteIdToSync]);
    return parseAction(result);
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
      const joinedUsersMap =
        await this.participants.findParticipantIdsForActions(actions, {
          session,
        });

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
        order: { createdAt: "ASC" },
      });
    });

    // --- end of promise defs ---

    const now = new Date();
    const users = await usersP;
    const userById = new Map(users.map((user) => [user.id, user]));
    const actions = await actionsP;

    const actionSummaries: UserActionSummary[] = actions.map((action) => {
      return {
        id: action.id,
        name: action.name,
        status: action.status,
        weekNumber: action.deadlineWeekNumber,
        allMembersParticipating: expressionHasLeaf(
          action.cohortExpression,
          (leaf) => leaf.type === "AllMembers",
        ),
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
        Omit<UserActionRelationDetail, "latestActivityAt"> & {
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
      // this action by findParticipantIdsForActions) instead of the
      // per-user expression walk, whose action leaves each hit the DB.
      const cohortMemberIds = await this.cohortResolverService.resolveCohort({
        action,
        session,
      });
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
              detail.declineReason = terminal.declineReason ?? undefined;
              detail.isMoral = terminal.isMoral ?? undefined;
              detail.outOfTime = terminal.outOfTime ?? undefined;
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
          deadlinePassed: hasMemberActionDeadlinePassed(
            action.memberActionPhase?.deadlineEvent?.date,
            now,
          ),
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
    return this.actionActivityRepository
      .createQueryBuilder("activity")
      .where("activity.actionId = :actionId", { actionId: action.id })
      .andWhere(sqlIsLatestWithdrawal("activity"))
      .orderBy("activity.createdAt", "DESC")
      .getMany();
  }

  async findUserActionRelations(): Promise<UserActionRelations> {
    // One user load for the whole request: the roster projection claims the
    // session's active-user snapshot, so the base-user resolution inside
    // findParticipantIdsForActions reuses it instead of re-hydrating every
    // user. The relations matrix only reads what the projection carries.
    const session = new CohortResolutionSession();
    const usersPromise = this.cohortResolverService.primeActiveUsers(
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
      .then(loadedCommunityUsers);
    return this.findActionRelationsForUsers(usersPromise);
  }

  async findMemberInfo(
    userId: number,
    communityId: number,
  ): Promise<UserActionRelations> {
    const community = await this.communityService.findOneOrFail(communityId, {
      users: { awayRanges: true, contractEvents: true, tags: true },
    });
    const members = loadedCommunityUsers(community);
    if (!members.some((user) => user.id === userId)) {
      throw new NotFoundException("User is not a member of this community");
    }

    return this.findActionRelationsForUsers(Promise.resolve(members));
  }

  async evaluateCohortExpressionBatch(expression: unknown): Promise<number[]> {
    const parsed = this.parseCohortExpressionOrThrow(expression);
    const result =
      await this.cohortResolverService.resolveCohortMemberIds(parsed);
    return Array.from(result);
  }

  /**
   * Filter follow-up forms by cohort expression for a given user.
   * A null/absent cohortExpression targets no members, so the form is
   * filtered out (consistent with action cohort semantics). A logged-out
   * client is in no cohort, so it gets nothing.
   */
  async filterFollowUpFormsByCohort(params: {
    followUpForms: ParsedFollowUpForm[];
    user: User | null;
    session?: CohortResolutionSession;
  }): Promise<ParsedFollowUpForm[]> {
    const { followUpForms, user, session } = params;
    if (!user) {
      return [];
    }
    const results = await Promise.all(
      followUpForms.map((form) =>
        this.singleMemberCohortService.computeIsInCohortExpression({
          user,
          cohortExpression: form.cohortExpression,
          session,
        }),
      ),
    );
    return followUpForms.filter((_, i) => results[i]);
  }
}

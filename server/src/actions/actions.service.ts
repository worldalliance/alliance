/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { echoesStoredKey } from "@alliance/common/image-src";
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { Community } from "src/community/entities/community.entity";
import {
  softDeleteWhere,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { renderedImageKey } from "src/images/images.service";
import {
  ActionEventReminderService,
  NOTIFICATION_LOOKBACK_WINDOW_MS,
} from "src/notifs/action-event-reminder.service";
import { NotificationPlan } from "src/notifs/dto/notification-plan.dto";
import { ReminderGroupService } from "src/notifs/reminder-group.service";
import { Form } from "src/tasks/entities/form.entity";
import { User } from "src/user/entities/user.entity";
import type {
  Relations,
  Repository as TypedRepository,
} from "src/utils/Repository";
import { DeepPartial, ILike, In, type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import {
  sqlIsLatestCompletion,
  sqlIsLatestWithdrawal,
} from "./action-activity-status";
import { ActionFormVariantService } from "./action-form-variant.service";
import { replaceReviewers } from "./action-reviewers";
import { isActionUpdatePublished } from "./action-update-visibility";
import { ActionVisibilityService } from "./action-visibility.service";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import {
  assertNotInACohort,
  parseCohortExpressionForSaveOrThrow,
  parseCohortExpressionOrThrow,
} from "./cohort-reference-validation";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { ActionReviewerDto } from "./dto/action-reviewer.dto";
import {
  CreateActionDto,
  SetPriorityDto,
  UpdateActionDto,
} from "./dto/action.dto";
import { CreateReminderGroupDto } from "./dto/reminder-group.dto";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionEvent, ActionStatus } from "./entities/action-event.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { ActionReviewer } from "./entities/action-reviewer.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { GeneralUpdate } from "./entities/general-update.entity";
import { ReminderGroup } from "./entities/reminder-group.entity";
import { GeneralUpdatesService } from "./general-updates.service";
import {
  assertNotAPrerequisite,
  assertPrerequisitesValid,
} from "./prerequisite-validation";
import { shiftPrioritiesAfterInsertion } from "./priority-order";

/**
 * All anything resolving a form back to its action reads. A partially selected
 * `Action` would type as a whole one with most columns silently undefined, so
 * the narrow reads hand back a narrow type instead.
 */
export type LinkedAction = Pick<Action, "id" | "name">;

const ACTION_PARENT_GONE = "That suite, author or form is gone";

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
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(ActionFormVariant)
    private readonly actionFormVariantRepository: Repository<ActionFormVariant>,
    private userService: UserService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly actionEventReminderService: ActionEventReminderService,
    private readonly reminderGroupService: ReminderGroupService,
    @Inject(forwardRef(() => ActionFormVariantService))
    private readonly actionFormVariantService: ActionFormVariantService,
    private readonly cohortDecisionStaffService: CohortDecisionStaffService,
    private readonly actionVisibility: ActionVisibilityService,
    private readonly generalUpdates: GeneralUpdatesService,
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
      rest.cohortExpression = await parseCohortExpressionForSaveOrThrow({
        em: this.actionRepository.manager,
        value: rest.cohortExpression,
      });
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
    await shiftPrioritiesAfterInsertion(this.actionRepository.manager);
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([
      saved.suite?.id,
    ]);
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
      rest.cohortExpression = await parseCohortExpressionForSaveOrThrow({
        em: this.actionRepository.manager,
        value: rest.cohortExpression,
        stored: action.cohortExpression,
      });
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
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([
      oldSuiteId,
      newSuiteId,
    ]);

    return this.findOneOrFail({ id, userId });
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
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([
      action?.suite?.id,
    ]);
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

  async evaluateCohortExpressionBatch(expression: unknown): Promise<number[]> {
    const parsed = parseCohortExpressionOrThrow(expression);
    const result =
      await this.cohortResolverService.resolveCohortMemberIds(parsed);
    return Array.from(result);
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import type {
  Relations,
  Repository as TypedRepository,
} from "src/utils/Repository";
import { ILike, In, type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import { isActionUpdatePublished } from "./action-update-visibility";
import { ActionVisibilityService } from "./action-visibility.service";
import { parseCohortExpressionOrThrow } from "./cohort-reference-validation";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { SetPriorityDto } from "./dto/action.dto";
import { ActionStatus } from "./entities/action-event.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { GeneralUpdate } from "./entities/general-update.entity";

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(EditableContent)
    private readonly editableContentRepository: TypedRepository<EditableContent>,
    @InjectRepository(GeneralUpdate)
    private readonly generalUpdateRepository: Repository<GeneralUpdate>,
    private userService: UserService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly actionVisibility: ActionVisibilityService,
  ) {}

  async findActionById(id: number): Promise<Action | null> {
    return this.actionRepository.findOne({ where: { id } });
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

  async findIdBySlug(slug: string): Promise<number> {
    const action = await this.actionRepository.findOne({
      where: { slug },
      select: { id: true },
    });
    if (!action) throw new NotFoundException(`Action "${slug}" not found`);
    return action.id;
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

  async evaluateCohortExpressionBatch(expression: unknown): Promise<number[]> {
    const parsed = parseCohortExpressionOrThrow(expression);
    const result =
      await this.cohortResolverService.resolveCohortMemberIds(parsed);
    return Array.from(result);
  }
}

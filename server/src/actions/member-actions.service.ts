import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import {
  ActionAssignment,
  computeActionAssignment,
  computeMemberActionAwayStatus,
} from "src/utils/action-user";
import { CachedFilter } from "src/utils/cached-filter";
import type { Relations } from "src/utils/Repository";
import { In, type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import { resolveUserActionRelation } from "./action-activity-status";
import { ActionVisibilityService } from "./action-visibility.service";
import { ActionsService } from "./actions.service";
import { CohortAdmissionService } from "./cohort-admission.service";
import { readsSavedDecisions } from "./cohort-decision";
import { CohortDecisionService } from "./cohort-decision.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { ActionDto, UserActionRelation } from "./dto/action.dto";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionStatus } from "./entities/action-event.entity";
import {
  ActionSuite,
  loadedActionSuiteActions,
} from "./entities/action-suite.entity";
import {
  Action,
  loadedActionFollowUpForms,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { type ParsedFollowUpForm } from "./entities/follow-up-form.entity";
import { SingleMemberCohortService } from "./single-member-cohort.service";
import {
  CompletionBlock,
  computeCanCompleteAction,
  computeCompletionBlock,
  resolveUserActionStatus,
  type ViewerCohort,
} from "./user-action-status";

const MEMBER_FEED_RELATIONS = {
  events: true,
  followUpForms: true,
  reviewers: true,
} satisfies Omit<Relations<Action>, "usersCompleted" | "status">;

@Injectable()
export class MemberActionsService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    private readonly actionsService: ActionsService,
    private readonly userService: UserService,
    private readonly cohortDecisionService: CohortDecisionService,
    private readonly actionVisibility: ActionVisibilityService,
    private readonly singleMemberCohortService: SingleMemberCohortService,
    private readonly cohortAdmissionService: CohortAdmissionService,
  ) {}

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
      ? await this.actionsService.findAllSorted(MEMBER_FEED_RELATIONS)
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

    await this.actionsService.applyAssignedFormIds(filtered, user?.id);

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
    const action = await this.actionsService.findOneOrFail({
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
      await this.actionsService.applyAssignedFormIds([action], userId);
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

  /**
   * Filter follow-up forms by cohort expression for a given user.
   * A null/absent cohortExpression targets no members, so the form is
   * filtered out (consistent with action cohort semantics). A logged-out
   * client is in no cohort, so it gets nothing.
   */
  private async filterFollowUpFormsByCohort(params: {
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

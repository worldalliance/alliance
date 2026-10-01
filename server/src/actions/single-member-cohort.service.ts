import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { resolveUsMembership, UsMembership } from "src/geo/us-membership";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import {
  canMissActionDeadline,
  computeMissedActionDeadline,
} from "src/utils/action-user";
import type { Repository } from "typeorm";
import { CohortAdmissionService } from "./cohort-admission.service";
import { readsSavedDecisions } from "./cohort-decision";
import {
  answerMatchesFormField,
  evaluateCohortExpression,
  singleUserCohortContext,
} from "./cohort-expression.evaluator";
import { ActionActivity } from "./entities/action-activity.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";

/**
 * The single-member cohort path: whether one member is in an expression's
 * cohort or an action's live cohort.
 */
@Injectable()
export class SingleMemberCohortService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
    private readonly cohortAdmissionService: CohortAdmissionService,
  ) {}

  private loadActionWithEvents(
    actionId: number,
    session: CohortResolutionSession,
  ): Promise<Action | null> {
    let pending = session.actionWithEventsById.get(actionId);
    if (!pending) {
      pending = this.actionRepository.findOne({
        where: { id: actionId },
        relations: { events: true },
      });
      session.actionWithEventsById.set(actionId, pending);
    }
    return pending;
  }

  /**
   * Whether the member is in the action's live cohort: its expression selects
   * them and their prerequisites have all resolved.
   */
  async computeIsInActionCohort(params: {
    user: User;
    action: Pick<ParsedAction, "cohortExpression" | "prerequisiteActionIds">;
    visitedActionIds?: Set<number>;
    session?: CohortResolutionSession;
  }): Promise<boolean> {
    const { user, action, visitedActionIds } = params;
    const session = params.session ?? new CohortResolutionSession();
    if (
      !(await this.computeIsInCohortExpression({
        user,
        cohortExpression: action.cohortExpression,
        visitedActionIds,
        session,
      }))
    ) {
      return false;
    }
    return this.prerequisiteProgressService.loadMemberReadiness({
      action,
      userId: user.id,
      session,
      now: new Date(),
    });
  }

  /**
   * Whether the member is in the cohort of an action a roster leaf reads: their
   * saved decision where one exists, the live cohort otherwise, as
   * `resolveDecidedCohort` on the population path.
   */
  private async computeIsInRosterCohort(params: {
    user: User;
    action: ParsedAction;
    visitedActionIds: Set<number>;
    session: CohortResolutionSession;
  }): Promise<boolean> {
    const { user, action, session } = params;
    if (readsSavedDecisions(action, new Date())) {
      const included = (
        await this.cohortAdmissionService.loadDecisionsForUser(user.id, session)
      ).get(action.id);
      if (included !== undefined) return included;
    }
    return this.computeIsInActionCohort(params);
  }

  /**
   * Check if a user is in a cohort expression's target set.
   */
  async computeIsInCohortExpression(params: {
    user: User;
    cohortExpression: CohortExpression | null | undefined;
    visitedActionIds?: Set<number>;
    /** Share per-user leaf lookups across the expressions of one request. */
    session?: CohortResolutionSession;
  }): Promise<boolean> {
    const { user, cohortExpression } = params;
    const visitedActionIds = params.visitedActionIds ?? new Set<number>();
    const session = params.session ?? new CohortResolutionSession();

    if (!cohortExpression) {
      return false;
    }

    const ctx = singleUserCohortContext({
      userId: user.id,
      hasTag: (tagId: string) =>
        (user.tags || []).some((tag) => tag.id === tagId),
      completedAction: async (actionId: number) => {
        let pending = session.completedActionIdsByUser.get(user.id);
        if (!pending) {
          pending = this.actionActivityRepository
            .find({
              where: {
                userId: user.id,
                type: ActionActivityType.USER_COMPLETED,
              },
              select: { actionId: true },
            })
            .then((rows) => new Set(rows.map((row) => row.actionId)));
          session.completedActionIdsByUser.set(user.id, pending);
        }
        return (await pending).has(actionId);
      },
      missedActionDeadline: async (actionId: number) => {
        if (visitedActionIds.has(actionId)) return false;
        const fetched = await this.loadActionWithEvents(actionId, session);
        if (!fetched) return false;
        const action = parseAction(fetched);

        const now = new Date();
        if (!canMissActionDeadline(action, now)) return false;

        const [terminalUserIds, inCohort] = await Promise.all([
          this.prerequisiteProgressService.loadTerminalUserIds(
            actionId,
            user.id,
          ),
          this.computeIsInRosterCohort({
            user,
            action,
            visitedActionIds: new Set(visitedActionIds).add(actionId),
            session,
          }),
        ]);
        // `user` must have `contractEvents` and `awayRanges` loaded; without
        // them the contract and away checks silently read false.
        return computeMissedActionDeadline({
          action,
          user,
          inCohort,
          hasTerminalActivity: terminalUserIds.size > 0,
          now,
        });
      },
      matchesFormField: async (fieldParams: {
        formId: number;
        fieldId: string;
        responseEqualTo?: string;
        responseAny?: boolean;
      }) => {
        const key = `${user.id}:${fieldParams.formId}`;
        let pending = session.formResponsesByUserAndForm.get(key);
        if (!pending) {
          pending = this.formResponseRepository.find({
            where: {
              formId: fieldParams.formId,
              user: { id: user.id },
            },
          });
          session.formResponsesByUserAndForm.set(key, pending);
        }
        return (await pending).some((r) =>
          answerMatchesFormField(r.answers, fieldParams),
        );
      },
      isGroupLead: async () => {
        const count = await this.communityRepository
          .createQueryBuilder("community")
          .innerJoin("community.leaders", "leader")
          .where("leader.id = :userId", { userId: user.id })
          .getCount();
        return count > 0;
      },
      usMembership: () => {
        let pending = session.usMembershipByUserId.get(user.id);
        if (!pending) {
          pending = this.loadUsMembership(user.id);
          session.usMembershipByUserId.set(user.id, pending);
        }
        return pending;
      },
      isStaff: () => user.staff,
    });

    const memberIds = await evaluateCohortExpression(
      cohortExpression,
      ctx,
      visitedActionIds,
    );
    return memberIds.has(user.id);
  }

  /**
   * Read city and time zone back from the db rather than off `user`: the city
   * relation is absent on most callers' users, and an unloaded relation would
   * silently read as "no location". Memoize on the session, since a member's
   * feed evaluates one expression per action against the same user.
   */
  private async loadUsMembership(userId: number): Promise<UsMembership> {
    const row = await this.userRepository
      .createQueryBuilder("user")
      .leftJoin("user.city", "city")
      .select("user.timeZone", "timeZone")
      .addSelect("city.countryCode", "countryCode")
      .where("user.id = :userId", { userId })
      .getRawOne<{ timeZone: string | null; countryCode: string | null }>();
    return resolveUsMembership({
      countryCode: row?.countryCode,
      timeZone: row?.timeZone,
    });
  }
}

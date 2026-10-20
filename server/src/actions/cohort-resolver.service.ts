import type { CohortExpression } from "@alliance/common/cohort-expression";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { resolveUsMembership, UsMembership } from "src/geo/us-membership";
import {
  CohortResolutionSession,
  type FormResponseAnswerRow,
} from "src/notifs/cohort-resolution-session";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
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
  type CohortEvaluationContext,
} from "./cohort-expression.evaluator";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";

@Injectable()
export class CohortResolverService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userService: UserService,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
    private readonly cohortAdmissionService: CohortAdmissionService,
  ) {}

  /**
   * Resolve a cohort expression to a set of matching user IDs using batch
   * set-based queries (one query per leaf type, not per user).
   *
   * Pass the same `session` across related resolutions (all expressions of
   * one request/batch) so the active-user load and per-leaf queries are
   * shared instead of re-run per expression. `resolvingActionIds` is the
   * chain of action ids currently being resolved above this call through
   * `MissedActionDeadline` leaves; a leaf that re-enters an id already on the
   * chain resolves to the empty set, so cyclic expressions terminate.
   */
  async resolveCohortMemberIds(
    expression: CohortExpression | null | undefined,
    session: CohortResolutionSession = new CohortResolutionSession(),
    resolvingActionIds: ReadonlySet<number> = new Set(),
  ): Promise<Set<number>> {
    if (!expression) return new Set();
    // Memo key includes the chain: a sub-resolution reached through an
    // action-referencing leaf must not await a pending ancestor resolution
    // of the same expression (self-deadlock on cycles).
    const chainKey = [...resolvingActionIds].sort((a, b) => a - b).join(",");
    const key = `${chainKey}|${JSON.stringify(expression)}`;
    let pending = session.expressionMemberIds.get(key);
    if (!pending) {
      pending = evaluateCohortExpression(
        expression,
        this.buildCohortContext(session, resolvingActionIds, chainKey),
      );
      session.expressionMemberIds.set(key, pending);
    }
    return pending;
  }

  /**
   * An action's live cohort: the members its expression selects whose
   * prerequisites have all resolved.
   */
  async resolveActionCohortMemberIds(params: {
    action: Pick<ParsedAction, "cohortExpression" | "prerequisiteActionIds">;
    session: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Set<number>> {
    const { action, session, resolvingActionIds } = params;
    const [cohort, isReady] = await Promise.all([
      this.resolveCohortMemberIds(
        action.cohortExpression,
        session,
        resolvingActionIds,
      ),
      this.prerequisiteProgressService.loadReadiness({
        action,
        session,
        now: new Date(),
      }),
    ]);
    return new Set([...cohort].filter(isReady));
  }

  /**
   * An action's cohort as its readers see it. Saved decisions stand in for the
   * live cohort from launch on, so a member the pass has not decided yet reads
   * as outside it; see `readsSavedDecisions`.
   */
  resolveCohort(params: {
    action: ParsedAction;
    session: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Set<number>> {
    const { action, session, resolvingActionIds } = params;
    if (readsSavedDecisions(action, new Date())) {
      return this.cohortAdmissionService.loadAdmittedMemberIds(
        action.id,
        session,
      );
    }
    return this.resolveActionCohortMemberIds({
      action,
      session,
      resolvingActionIds,
    });
  }

  /**
   * An action's cohort taking each member's saved decision where one exists
   * and the live cohort otherwise, for readers that must not count an
   * undecided member as outside.
   */
  async resolveDecidedCohort(params: {
    action: ParsedAction;
    session: CohortResolutionSession;
    resolvingActionIds?: ReadonlySet<number>;
  }): Promise<Set<number>> {
    const { action, session, resolvingActionIds } = params;
    const live = this.resolveActionCohortMemberIds({
      action,
      session,
      resolvingActionIds,
    });
    if (!readsSavedDecisions(action, new Date())) {
      return live;
    }
    const [decisions, liveIds] = await Promise.all([
      this.cohortAdmissionService.loadDecisionsForAction(action.id, session),
      live,
    ]);
    return new Set([
      ...[...decisions].flatMap(([userId, included]) =>
        included ? [userId] : [],
      ),
      ...[...liveIds].filter((userId) => !decisions.has(userId)),
    ]);
  }

  private buildCohortContext(
    session: CohortResolutionSession,
    resolvingActionIds: ReadonlySet<number>,
    chainKey: string,
  ): CohortEvaluationContext {
    return {
      getUserIdsForTag: (tagId: string) => {
        if (!tagId) return Promise.resolve(new Set());
        let pending = session.tagUserIds.get(tagId);
        if (!pending) {
          pending = this.tagRepository
            .createQueryBuilder("tag")
            .innerJoin("tag.users", "user")
            .select("user.id", "userId")
            .where("tag.id = :tagId", { tagId })
            .getRawMany<{ userId: number }>()
            .then((rows) => new Set(rows.map((row) => Number(row.userId))));
          session.tagUserIds.set(tagId, pending);
        }
        return pending;
      },
      getUserIdsCompletedAction: (actionId: number) => {
        if (!actionId) return Promise.resolve(new Set());
        let pending = session.completedActionUserIds.get(actionId);
        if (!pending) {
          pending = this.prerequisiteProgressService
            .loadCompletions({ actionId })
            .then((completions) => new Set(completions.map((c) => c.userId)));
          session.completedActionUserIds.set(actionId, pending);
        }
        return pending;
      },
      getUserIdsMissedActionDeadline: (actionId: number) => {
        if (!actionId) return Promise.resolve(new Set());
        // Cycle cut: this action's roster is already being resolved higher
        // up the chain, so its membership contributes nothing new.
        if (resolvingActionIds.has(actionId)) {
          return Promise.resolve(new Set());
        }
        const key = `${chainKey}|${actionId}`;
        let pending = session.missedActionDeadlineUserIds.get(key);
        if (!pending) {
          pending = this.loadMissedActionDeadlineUserIds(
            actionId,
            session,
            new Set([...resolvingActionIds, actionId]),
          );
          session.missedActionDeadlineUserIds.set(key, pending);
        }
        return pending;
      },
      getUserIdsForFormField: async (params) => {
        if (!params.formId) return new Set();
        let rows = session.formResponsesByFormId.get(params.formId);
        if (!rows) {
          rows = this.formResponseRepository
            .createQueryBuilder("response")
            .leftJoin("response.user", "user")
            .select("response.answers", "answers")
            .addSelect("user.id", "userId")
            .where("response.formId = :formId", { formId: params.formId })
            .getRawMany<FormResponseAnswerRow>();
          session.formResponsesByFormId.set(params.formId, rows);
        }
        const matching = (await rows).filter((row) =>
          answerMatchesFormField(row.answers ?? undefined, params),
        );
        return new Set(
          matching
            .map((row) => row.userId)
            .filter((id): id is number => typeof id === "number"),
        );
      },
      getGroupLeadUserIds: () =>
        (session.groupLeadUserIds ??= this.communityRepository
          .createQueryBuilder("community")
          .innerJoin("community.leaders", "leader")
          .select("leader.id", "userId")
          .getRawMany<{ userId: number }>()
          .then((rows) => new Set(rows.map((row) => Number(row.userId))))),
      getUserIdsByUsMembership: async (membership) =>
        (
          await (session.usMembershipUserIds ??= this.loadUsMembershipUserIds())
        )[membership],
      // getActiveUsers primes candidateUserIds from its snapshot, so this
      // lean load only runs for sessions that never hydrate full users.
      getAllCandidateUserIds: () =>
        (session.candidateUserIds ??= this.userService
          .findActiveUserIds()
          .then((ids) => new Set(ids))),
      getStaffUserIds: () =>
        (session.staffUserIds ??= this.userRepository
          .find({ where: { staff: true }, select: { id: true } })
          .then((users) => new Set(users.map((user) => user.id)))),
    };
  }

  /**
   * Partition every user by where they live, in one pass. The city on the
   * profile wins; time zone is the fallback. Users we can't place land in
   * `Unknown` and so match neither country leaf.
   */
  private async loadUsMembershipUserIds(): Promise<
    Record<UsMembership, Set<number>>
  > {
    const rows = await this.userRepository
      .createQueryBuilder("user")
      .leftJoin("user.city", "city")
      .select("user.id", "userId")
      .addSelect("user.timeZone", "timeZone")
      .addSelect("city.countryCode", "countryCode")
      .getRawMany<{
        userId: number;
        timeZone: string | null;
        countryCode: string | null;
      }>();

    const byMembership: Record<UsMembership, Set<number>> = {
      [UsMembership.Us]: new Set(),
      [UsMembership.NonUs]: new Set(),
      [UsMembership.Unknown]: new Set(),
    };
    for (const row of rows) {
      byMembership[resolveUsMembership(row)].add(Number(row.userId));
    }
    return byMembership;
  }

  // A deleted action matches nobody, as on the single-member path.
  private async loadRosterLeafAction(
    actionId: number,
  ): Promise<ParsedAction | null> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: { events: true },
    });
    return action && parseAction(action);
  }

  private async loadMissedActionDeadlineUserIds(
    actionId: number,
    session: CohortResolutionSession,
    resolvingActionIds: ReadonlySet<number>,
  ): Promise<Set<number>> {
    const action = await this.loadRosterLeafAction(actionId);
    const now = new Date();
    if (!action || !canMissActionDeadline(action, now)) return new Set();
    const [users, cohortMemberIds, terminalUserIds] = await Promise.all([
      this.getActiveUsers(session),
      this.resolveDecidedCohort({ action, session, resolvingActionIds }),
      this.prerequisiteProgressService.loadTerminalUserIds(action.id),
    ]);
    return new Set(
      users
        .filter((user) =>
          computeMissedActionDeadline({
            action,
            user,
            inCohort: cohortMemberIds.has(user.id),
            hasTerminalActivity: terminalUserIds.has(user.id),
            now,
          }),
        )
        .map((user) => user.id),
    );
  }

  /**
   * The session's shared active-user load (started on first use). Also claims
   * the session's NOT-universe so cohort resolution and base-user filtering
   * see one snapshot regardless of which starts first.
   */
  getActiveUsers(session: CohortResolutionSession): Promise<User[]> {
    return this.primeActiveUsers(session, () =>
      this.userService.findActiveUsersWithTags(),
    );
  }

  /**
   * Claim the session's active-user snapshot with a caller-chosen load —
   * e.g. `findActiveUsersForRoster` when the request only runs assignment
   * predicates. No-op if already claimed. The caller must make sure the
   * projection satisfies every consumer that will share this session.
   */
  primeActiveUsers(
    session: CohortResolutionSession,
    load: () => Promise<User[]>,
  ): Promise<User[]> {
    const users = (session.activeUsers ??= load());
    session.candidateUserIds ??= users.then(
      (us) => new Set(us.map((u) => u.id)),
    );
    return users;
  }
}

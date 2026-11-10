/* alliance/max-lines 650 -- baseline: past the limit when the ratchet was adopted, not judged one unit */
import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { countBy, partition } from "es-toolkit";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import {
  admissionReason,
  belongsToBackfill,
  CohortEnrollmentState,
  computeCohortEnrollment,
  findReadClosedEnrollments,
  heldContractDuringWindow,
  isCohortAdmissible,
  isInCatchUp,
  isSettled,
  openEnrollments,
  orderByDecisionReads,
  readsDecisionsOf,
  type CohortEnrollment,
} from "./cohort-decision";
import { CohortDecisionActionsService } from "./cohort-decision-actions.service";
import {
  CohortDecisionStoreService,
  type DecisionRow,
} from "./cohort-decision-store.service";
import { logCohortPathDisagreements } from "./cohort-path-disagreements";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { type ParsedAction } from "./entities/action.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";
import { SingleMemberCohortService } from "./single-member-cohort.service";
import { groupSplitArms, splitIdByArm } from "./split-decision";
import { isActionOptional } from "./suite-split";
import { SuiteSplitsService } from "./suite-splits.service";

@Injectable()
export class CohortDecisionService {
  private readonly logger = new Logger(CohortDecisionService.name);

  constructor(
    private readonly store: CohortDecisionStoreService,
    private readonly cohortActions: CohortDecisionActionsService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly userService: UserService,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
    private readonly singleMemberCohortService: SingleMemberCohortService,
    private readonly suiteSplits: SuiteSplitsService,
  ) {}

  /**
   * Launch processing, catch-up, and backfill: decide every admissible,
   * undecided member of every enrolling action, and every member who held a
   * contract during the window of a closed action launched before the
   * resolver's first decision. Closed actions in catch-up go first, so open
   * ones read their decisions instead of their live cohorts. The open and
   * backfill phases share one session, so their actions see the same
   * profile, tag, and answer snapshot; each closed action in catch-up takes
   * its own over the same users. A
   * failing action is logged and skipped so it cannot hold back the others.
   */
  async resolveAll(now: Date): Promise<void> {
    const { items: actions, splitIds } =
      await this.cohortActions.findResolvable(now);
    const closed = actions.flatMap(({ action, enrollment }) => {
      switch (enrollment.state) {
        case CohortEnrollmentState.Closed:
          return [{ action, enrollment }];
        case CohortEnrollmentState.Open:
        case CohortEnrollmentState.NotStarted:
          return [];
        default:
          throw new Error(
            `unknown enrollment state: ${enrollment satisfies never}`,
          );
      }
    });
    const [backfill] = await this.partitionBackfill(closed);
    const backfillIds = new Set(backfill.map(({ action }) => action.id));
    const catchUp = actions.filter(
      ({ action, enrollment }) =>
        !backfillIds.has(action.id) && isInCatchUp(enrollment, now),
    );
    if (backfill.length === 0 && catchUp.length === 0) return;

    const decidedByAction = await this.store.findDecidedUserIds(
      catchUp.map(({ action }) => action.id),
      { splitIds },
    );
    const session = new CohortResolutionSession();
    const users = await this.cohortResolverService.primeActiveUsers(
      session,
      () => this.userService.findActiveUsersForRoster(),
    );

    const settledUsers = users.filter((user) => isSettled(user, now));
    const [closedCatchUp, openCatchUp] = partition(
      catchUp,
      ({ enrollment }) => enrollment.state === CohortEnrollmentState.Closed,
    );
    // The open phase's session has read no closed action's decisions yet.
    const failedClosed = await this.decideClosedInOrder({
      closed: orderByDecisionReads(closedCatchUp),
      users: settledUsers,
      population: users,
      decidedByAction,
      splitIds,
      now,
    });

    // Ordinary decisions first, so a backfill cannot delay this pass's
    // launches. It still holds the lock, so later passes skip until it ends.
    const work = [
      ...openCatchUp.map(({ action, enrollment }) => {
        const decided = decidedByAction.get(action.id) ?? new Set<number>();
        return {
          action,
          resolve: () =>
            this.resolveAction({
              action,
              enrollment,
              users: settledUsers.filter((user) => !decided.has(user.id)),
              session,
              now,
            }),
        };
      }),
      ...backfill.map(({ action, enrollment }) => ({
        action,
        resolve: () =>
          this.resolveBackfill({
            action,
            enrollment,
            users,
            settled: new Set(settledUsers),
            session,
            now,
          }),
      })),
    ];
    for (const group of groupSplitArms(work, splitIds)) {
      if (group.some(({ action }) => this.readsFailed(action, failedClosed))) {
        continue;
      }
      await this.tryDecide(group[0].action, async () =>
        (await Promise.all(group.map(({ resolve }) => resolve()))).flat(),
      );
    }
  }

  private async tryDecide(
    action: ParsedAction,
    resolve: () => Promise<DecisionRow[]>,
  ): Promise<boolean> {
    const result = await R.fromPromiseFn(async () =>
      this.store.insert(await resolve()),
    );
    if (R.isFailure(result)) {
      this.logger.error(
        `Failed to decide cohort for action ${action.id}`,
        result.error,
      );
    }
    return R.isSuccess(result);
  }

  /**
   * Decides `users` on each closed action in order, each with a fresh session
   * over `population`: a session never invalidates, and actions that read
   * each other cache each other's decisions before either is written.
   * Returns the ids of those that failed or read one that failed.
   */
  private async decideClosedInOrder(params: {
    closed: Array<{ action: ParsedAction; enrollment: CohortEnrollment }>;
    users: User[];
    population: User[];
    decidedByAction: Map<number, Set<number>>;
    splitIds: ReadonlyMap<number, number>;
    now: Date;
  }): Promise<Set<number>> {
    const { closed, users, population, decidedByAction, splitIds, now } =
      params;
    const failed = new Set<number>();
    for (const group of groupSplitArms(closed, splitIds)) {
      const ids = group.map(({ action }) => action.id);
      if (group.some(({ action }) => this.readsFailed(action, failed))) {
        ids.forEach((id) => failed.add(id));
        continue;
      }
      const decidedNow = await this.tryDecide(group[0].action, async () => {
        const session = await this.sessionFor(population);
        const rows = await Promise.all(
          group.map(({ action, enrollment }) => {
            const decided = decidedByAction.get(action.id);
            return this.resolveAction({
              action,
              enrollment,
              users: users.filter((user) => !decided?.has(user.id)),
              session,
              now,
            });
          }),
        );
        return rows.flat();
      });
      if (!decidedNow) ids.forEach((id) => failed.add(id));
    }
    return failed;
  }

  /**
   * A reader of a closed action that failed would take its live cohort and
   * keep that reading, so it waits for a later pass or read.
   */
  private readsFailed(
    action: ParsedAction,
    failedClosed: ReadonlySet<number>,
  ): boolean {
    if (!readsDecisionsOf(action.cohortExpression, failedClosed)) return false;
    this.logger.warn(
      `Skipped deciding cohort for action ${action.id}: it reads an action that failed`,
    );
    return true;
  }

  /** Splits closed actions into those the pass backfills and the rest. */
  private async partitionBackfill<
    T extends { action: ParsedAction; enrollment: { start: Date } },
  >(closed: T[]): Promise<[T[], T[]]> {
    const [withDecisions, cutover] = await Promise.all([
      this.store.findActionIdsWithDecisions(
        closed.map(({ action }) => action.id),
      ),
      this.store.findCutover(),
    ]);
    return partition(closed, ({ action, enrollment }) =>
      belongsToBackfill({
        enrollment,
        hasDecisions: withDecisions.has(action.id),
        cutover,
      }),
    );
  }

  private async resolveAction(params: {
    action: ParsedAction;
    enrollment: CohortEnrollment;
    users: User[];
    session: CohortResolutionSession;
    now: Date;
  }): Promise<DecisionRow[]> {
    const { action, enrollment, users, session, now } = params;
    switch (enrollment.state) {
      case CohortEnrollmentState.Open: {
        const admissible = users.filter((user) =>
          isCohortAdmissible({ action, user, at: now }),
        );
        if (admissible.length === 0) return [];
        const pending = await this.prerequisiteProgressService.filterReady({
          action,
          users: admissible,
          session,
          now,
        });
        if (pending.length === 0) return [];
        const cohort = await this.cohortResolverService.resolveCohortMemberIds(
          action.cohortExpression,
          session,
        );
        return this.decide({
          action,
          users: pending,
          included: (user) => cohort.has(user.id),
          reason: (user) =>
            admissionReason({ action, user, start: enrollment.start }),
          now,
        });
      }
      case CohortEnrollmentState.Closed: {
        const admissible = users.filter((user) =>
          isCohortAdmissible({ action, user, at: enrollment.deadline }),
        );
        if (admissible.length === 0) return [];
        const pending = await this.prerequisiteProgressService.filterReady({
          action,
          users: admissible,
          session,
          now,
        });
        // Only a member held to the whole window of a non-optional action
        // could miss it. Anyone else was only ever optional, so deciding them
        // late creates no missed obligation.
        const obligated = (user: User) =>
          !isActionOptional(action) &&
          user.hasActiveContractInFullRange({
            startDate: enrollment.start,
            endDate: enrollment.deadline,
          });
        await this.warnAboutLateDecisions({
          action,
          users: pending.filter(obligated),
          deadline: enrollment.deadline,
        });
        const cohort = pending.some((user) => !obligated(user))
          ? await this.cohortResolverService.resolveCohortMemberIds(
              action.cohortExpression,
              session,
            )
          : new Set<number>();
        return this.decide({
          action,
          users: pending,
          included: (user) => !obligated(user) && cohort.has(user.id),
          reason: (user) =>
            obligated(user)
              ? CohortDecisionReason.ResolvedAfterDeadline
              : admissionReason({ action, user, start: enrollment.start }),
          now,
        });
      }
      case CohortEnrollmentState.NotStarted:
        return [];
      default:
        throw new Error(
          `unknown enrollment state: ${enrollment satisfies never}`,
        );
    }
  }

  /**
   * Warns about obligated members decided after the deadline though they were
   * ready before it, which the passes should have reached while the action was
   * open. A member whose prerequisite shares the deadline becomes ready only
   * as it passes, so deciding them then is expected.
   */
  private async warnAboutLateDecisions(params: {
    action: ParsedAction;
    users: User[];
    deadline: Date;
  }): Promise<void> {
    const { action, users, deadline } = params;
    if (users.length === 0) return;
    const late = await this.prerequisiteProgressService.filterReadyBefore({
      action,
      users,
      before: deadline,
    });
    if (late.length > 0) {
      this.logger.warn(
        `decided ${late.length} member(s) of action ${action.id} after its deadline, though they were ready before it`,
      );
    }
  }

  /**
   * The members some pass would have admitted while the action was open,
   * those holding a contract at any point in its window, against the cohort
   * as it evaluates now.
   */
  private async resolveBackfill(params: {
    action: ParsedAction;
    enrollment: { start: Date; deadline: Date };
    users: User[];
    settled: Set<User>;
    session: CohortResolutionSession;
    now: Date;
  }): Promise<DecisionRow[]> {
    const { action, enrollment, users, settled, session, now } = params;
    const pending = users.filter((user) =>
      heldContractDuringWindow({
        user,
        start: enrollment.start,
        deadline: enrollment.deadline,
      }),
    );
    // Writing no rows keeps the action in the backfill, so skip evaluating its
    // cohort on every pass.
    if (pending.length === 0) return [];
    // No pass revisits a backfilled action, so wait out a recent signer's
    // request rather than decide the others without them.
    if (pending.some((user) => !settled.has(user))) return [];
    const cohort = await this.cohortResolverService.resolveCohortMemberIds(
      action.cohortExpression,
      session,
    );
    const rows = this.decide({
      action,
      users: pending,
      included: (user) => cohort.has(user.id),
      reason: () => CohortDecisionReason.Backfill,
      now,
    });
    await logCohortPathDisagreements({
      action,
      rows,
      session,
      userService: this.userService,
      singleMemberCohortService: this.singleMemberCohortService,
      logger: this.logger,
    });
    return rows;
  }

  /**
   * The pass's catch-up for one open action, for a one-shot reader that
   * cannot wait for the next pass. Unlike the pass it throws on failure, so
   * the reader fails rather than read an undecided cohort as empty.
   */
  async decideOpenAction(action: ParsedAction, now: Date): Promise<void> {
    const enrollment = computeCohortEnrollment(action, now);
    if (action.publicOnly || enrollment.state !== CohortEnrollmentState.Open) {
      return;
    }
    const { actions, splitIds } = await this.cohortActions.loadWithSplitArms([
      action.id,
    ]);
    const session = new CohortResolutionSession();
    const [users, decidedByAction] = await Promise.all([
      this.cohortResolverService.primeActiveUsers(session, () =>
        this.userService.findActiveUsersForRoster(),
      ),
      this.store.findDecidedUserIds(
        actions.map(({ id }) => id),
        { splitIds },
      ),
    ]);
    const settled = users.filter((user) => isSettled(user, now));
    const failed = await this.decideReadClosedActions({
      actions,
      users: settled,
      now,
    });
    if (actions.some((arm) => readsDecisionsOf(arm.cohortExpression, failed))) {
      throw new Error(
        `Failed to decide the closed actions action ${action.id} reads`,
      );
    }
    const rows = await Promise.all(
      actions.map((arm) => {
        const decided = decidedByAction.get(arm.id);
        return this.resolveAction({
          action: arm,
          enrollment,
          users: settled.filter((user) => !decided?.has(user.id)),
          session,
          now,
        });
      }),
    );
    await this.store.insert(rows.flat());
  }

  /**
   * Decides `users` on the closed actions whose decisions `actions` read,
   * directly or through each other, before `actions` are decided. Until a
   * member is decided on a closed action, readers take its live cohort, which
   * counts a member whose prerequisite resolved only as it closed, and a
   * decision made now would keep that reading. Actions the pass would
   * backfill are left to it. Returns the ids of those that failed, or that
   * read one that failed.
   */
  private async decideReadClosedActions(params: {
    actions: ParsedAction[];
    users: User[];
    now: Date;
  }): Promise<Set<number>> {
    const { actions, users, now } = params;
    if (users.length === 0) return new Set();
    const closed = await findReadClosedEnrollments({
      actions,
      load: async (ids) =>
        (await this.cohortActions.loadWithSplitArms(ids)).actions,
      now,
    });
    const splitIds = splitIdByArm(await this.suiteSplits.findAll());
    const admissible = closed.filter(({ action, enrollment }) =>
      users.some((user) =>
        isCohortAdmissible({ action, user, at: enrollment.deadline }),
      ),
    );
    if (admissible.length === 0) return new Set();
    const decidedByAction = await this.store.findDecidedUserIds(
      admissible.map(({ action }) => action.id),
      { onlyUserId: users.length === 1 ? users[0].id : undefined, splitIds },
    );
    const pending = new Set(
      admissible.filter(({ action }) => {
        const decided = decidedByAction.get(action.id);
        return users.some((user) => !decided?.has(user.id));
      }),
    );
    if (pending.size === 0) return new Set();
    // Like resolveAll, orders without the actions the pass backfills, so both
    // break a read cycle at the same action.
    const [, notBackfilled] = await this.partitionBackfill(closed);
    return this.decideClosedInOrder({
      closed: orderByDecisionReads(notBackfilled).filter((item) =>
        pending.has(item),
      ),
      users,
      population: users,
      decidedByAction,
      splitIds,
      now,
    });
  }

  private async sessionFor(users: User[]): Promise<CohortResolutionSession> {
    const session = new CohortResolutionSession();
    await this.cohortResolverService.primeActiveUsers(session, () =>
      Promise.resolve(users),
    );
    return session;
  }

  /** Decide a member who just became admissible by signing. */
  async resolveForUser(userId: number, now: Date): Promise<void> {
    const [{ items: actions }, user] = await Promise.all([
      this.cohortActions.findResolvable(now),
      this.userService.findOneOrFail(userId, {
        contractEvents: true,
        awayRanges: true,
      }),
    ]);
    await this.decideForUser({
      user,
      actions: actions.map(({ action }) => action),
      now,
    });
  }

  /**
   * Decide the member's undecided open actions before they read their tasks,
   * so a pass that has not reached them cannot hide an assignment. A recent
   * signer may be mid-submission, so the signing writer decides them instead.
   * Returns the actions to read from the live cohort: those it failed to
   * decide, and a recent signer's open actions without a decision yet.
   * `user` needs `contractEvents` and `awayRanges`, and `actions` their
   * events.
   */
  async reconcileForUser(params: {
    user: User;
    actions: ParsedAction[];
    now: Date;
  }): Promise<Set<number>> {
    const { user, actions, now } = params;
    const decidable = actions.filter((action) => !action.publicOnly);
    if (isSettled(user, now)) {
      return this.decideForUser({ user, actions: decidable, now });
    }
    const open = openEnrollments(decidable, now);
    const decided = await this.store.loadDecidedActionIds(user.id, open);
    return new Set(
      open
        .map(({ action }) => action.id)
        .filter((actionId) => !decided.has(actionId)),
    );
  }

  /**
   * A failing action is logged and skipped so it cannot hold back the
   * others, as is one reading a closed action that failed; returns the ids
   * of both.
   */
  private async decideForUser(params: {
    user: User;
    actions: ParsedAction[];
    now: Date;
  }): Promise<Set<number>> {
    const { user, now } = params;
    const splitIds = splitIdByArm(await this.suiteSplits.findAll());
    const armIds = params.actions
      .map(({ id }) => id)
      .filter((id) => splitIds.has(id));
    const actions = [
      ...params.actions.filter(({ id }) => !splitIds.has(id)),
      ...(armIds.length === 0
        ? []
        : (await this.cohortActions.loadWithSplitArms(armIds)).actions),
    ];
    const open = openEnrollments(actions, now);
    if (open.length === 0) return new Set();
    // An action outside a split is its own group.
    const groupOf = (actionId: number) => splitIds.get(actionId) ?? -actionId;
    const decided = await this.store.loadDecidedActionIds(user.id, open);
    const decidedGroups = new Set([...decided].map(groupOf));
    const undecided = open.filter(
      ({ action }) => !decidedGroups.has(groupOf(action.id)),
    );
    if (undecided.length === 0) return new Set();
    const admissible = undecided.filter(({ action }) =>
      isCohortAdmissible({ action, user, at: now }),
    );
    const failedClosed = await this.decideReadClosedActions({
      actions: admissible.map(({ action }) => action),
      users: [user],
      now,
    });
    const blockedSplits = new Set(
      admissible
        .filter(({ action }) => this.readsFailed(action, failedClosed))
        .map(({ action }) => groupOf(action.id)),
    );
    const [blocked, decidable] = partition(admissible, ({ action }) =>
      blockedSplits.has(groupOf(action.id)),
    );
    // The pass's population evaluator, over a population of one, so both
    // writers apply the same cohort rules.
    const session = await this.sessionFor([user]);
    const rows: DecisionRow[] = [];
    const failed = new Set(blocked.map(({ action }) => action.id));
    for (const group of groupSplitArms(decidable, splitIds)) {
      const result = await R.fromPromiseFn(() =>
        Promise.all(
          group.map(({ action, enrollment }) =>
            this.resolveAction({
              action,
              enrollment,
              users: [user],
              session,
              now,
            }),
          ),
        ),
      );
      if (R.isFailure(result)) {
        this.logger.error(
          `Failed to decide cohort for action ${group[0].action.id}, user ${user.id}`,
          result.error,
        );
        group.forEach(({ action }) => failed.add(action.id));
        continue;
      }
      rows.push(...result.value.flat());
    }
    await this.store.insert(rows);
    return failed;
  }

  private decide(params: {
    action: ParsedAction;
    users: User[];
    included: (user: User) => boolean;
    reason: (user: User) => CohortDecisionReason;
    now: Date;
  }): DecisionRow[] {
    const { action, users, included, reason, now } = params;
    const rows = users.map((user) => ({
      actionId: action.id,
      userId: user.id,
      included: included(user),
      reason: reason(user),
      resolvedAt: now,
    }));
    for (const [rowReason, count] of Object.entries(
      countBy(rows, (row) => row.reason),
    )) {
      this.logger.log(
        `decided ${count} member(s) of action ${action.id} (${rowReason})`,
      );
    }
    return rows;
  }
}

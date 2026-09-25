import { R } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { millisecondsInDay, millisecondsInMinute } from "date-fns/constants";
import { countBy } from "es-toolkit";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import type { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { In, type Repository } from "typeorm";
import {
  CohortEnrollmentState,
  computeCohortEnrollment,
  heldContractDuringWindow,
  isCohortAdmissible,
  type CohortEnrollment,
} from "./cohort-decision";
import {
  ActionCohortDecision,
  CohortDecisionReason,
} from "./entities/action-cohort-decision.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";

/**
 * How long after its deadline a regular action stays in the catch-up pass.
 * Admissibility there is judged at the deadline, so each closed action needs
 * only one successful pass.
 */
const CLOSED_ACTION_CATCH_UP_MS = 7 * millisecondsInDay;

/**
 * Longer than any signing request. A member who signs through a task form has
 * a contract before the form's answers and completion are saved, so the pass
 * leaves recent signers alone rather than decide them mid-submission.
 */
const SIGNING_GRACE_MS = 10 * millisecondsInMinute;

const INSERT_CHUNK_SIZE = 1000;

type DecisionRow = Pick<
  ActionCohortDecision,
  "actionId" | "userId" | "included" | "reason" | "resolvedAt"
>;

function admissionReason(params: {
  action: ParsedAction;
  user: User;
  start: Date;
}): CohortDecisionReason {
  const { action, user, start } = params;
  return isCohortAdmissible({ action, user, at: start })
    ? CohortDecisionReason.Launch
    : CohortDecisionReason.Signing;
}

function isInCatchUp(enrollment: CohortEnrollment, now: Date): boolean {
  switch (enrollment.state) {
    case CohortEnrollmentState.Open:
      return true;
    case CohortEnrollmentState.Closed:
      return (
        now.getTime() - enrollment.deadline.getTime() <=
        CLOSED_ACTION_CATCH_UP_MS
      );
    case CohortEnrollmentState.NotStarted:
      return false;
    default:
      throw new Error(
        `unknown enrollment state: ${enrollment satisfies never}`,
      );
  }
}

/**
 * A closed action the resolver never decided that launched before its first
 * decision. Catch-up would treat its whole cohort as a processing failure.
 */
function belongsToBackfill(params: {
  enrollment: { start: Date };
  hasDecisions: boolean;
  cutover: Date | null;
}): boolean {
  const { enrollment, hasDecisions, cutover } = params;
  return !hasDecisions && (!cutover || enrollment.start < cutover);
}

@Injectable()
export class CohortDecisionService {
  private readonly logger = new Logger(CohortDecisionService.name);

  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
    private readonly actionEventRecipientService: ActionEventRecipientService,
    private readonly userService: UserService,
  ) {}

  /**
   * Launch processing, catch-up, and backfill: decide every admissible,
   * undecided member of every enrolling action, and every member who held a
   * contract during the window of a closed action launched before the
   * resolver's first decision. One session serves the whole pass, so
   * every action sees the same profile, tag, and answer snapshot. A failing
   * action is logged and skipped so it cannot hold back the others.
   */
  async resolveAll(now: Date): Promise<void> {
    const [actions, cutover] = await Promise.all([
      this.findResolvableActions(now),
      this.findCutover(),
    ]);
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
    const withDecisions = await this.findActionIdsWithDecisions(
      closed.map(({ action }) => action.id),
    );
    const backfill = closed.filter(({ action, enrollment }) =>
      belongsToBackfill({
        enrollment,
        hasDecisions: withDecisions.has(action.id),
        cutover,
      }),
    );
    const backfillIds = new Set(backfill.map(({ action }) => action.id));
    const catchUp = actions.filter(
      ({ action, enrollment }) =>
        !backfillIds.has(action.id) && isInCatchUp(enrollment, now),
    );
    if (backfill.length === 0 && catchUp.length === 0) return;

    const decidedByAction = await this.findDecidedUserIds(
      catchUp.map(({ action }) => action.id),
    );
    const session = new CohortResolutionSession();
    const users = await this.actionEventRecipientService.primeActiveUsers(
      session,
      () => this.userService.findActiveUsersForRoster(),
    );

    const signedBefore = new Date(now.getTime() - SIGNING_GRACE_MS);
    const settledUsers = users.filter(
      (user) =>
        !user.contractEvents?.some(
          (event) =>
            event.type === ContractEventType.SIGNED &&
            event.date > signedBefore,
        ),
    );

    // Ordinary decisions first, so a backfill cannot delay this pass's
    // launches. It still holds the lock, so later passes skip until it ends.
    const work = [
      ...catchUp.map(({ action, enrollment }) => {
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
    for (const { action, resolve } of work) {
      const result = await R.fromPromiseFn(async () =>
        this.insert(await resolve()),
      );
      if (R.isFailure(result)) {
        this.logger.error(
          `Failed to decide cohort for action ${action.id}`,
          result.error,
        );
      }
    }
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
        const pending = users.filter((user) =>
          isCohortAdmissible({ action, user, at: now }),
        );
        if (pending.length === 0) return [];
        const cohort =
          await this.actionEventRecipientService.resolveCohortMemberIds(
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
        const pending = users.filter((user) =>
          isCohortAdmissible({ action, user, at: enrollment.deadline }),
        );
        // Only a member held to the whole window of a non-optional action
        // could miss it. Anyone else was only ever optional, so deciding them
        // late creates no missed obligation.
        const obligated = (user: User) =>
          !action.optional &&
          user.hasActiveContractInFullRange({
            startDate: enrollment.start,
            endDate: enrollment.deadline,
          });
        const cohort = pending.some((user) => !obligated(user))
          ? await this.actionEventRecipientService.resolveCohortMemberIds(
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
    const cohort =
      await this.actionEventRecipientService.resolveCohortMemberIds(
        action.cohortExpression,
        session,
      );
    return this.decide({
      action,
      users: pending,
      included: (user) => cohort.has(user.id),
      reason: () => CohortDecisionReason.Backfill,
      now,
    });
  }

  /** When the resolver first ran: its earliest ordinary decision. */
  private async findCutover(): Promise<Date | null> {
    const first = await this.decisionRepository.findOne({
      where: {
        reason: In([CohortDecisionReason.Launch, CohortDecisionReason.Signing]),
      },
      order: { resolvedAt: "ASC" },
      select: { resolvedAt: true },
    });
    return first?.resolvedAt ?? null;
  }

  /** Decide a member who just became admissible by signing. */
  async resolveForUser(userId: number, now: Date): Promise<void> {
    const [actions, user] = await Promise.all([
      this.findActionsInCatchUp(now),
      this.userService.findOneOrFail(userId, {
        contractEvents: true,
        awayRanges: true,
      }),
    ]);
    const open = actions.filter(
      ({ enrollment }) => enrollment.state === CohortEnrollmentState.Open,
    );
    const decided = new Set(
      (
        await this.decisionRepository.find({
          where: {
            userId,
            actionId: In(open.map(({ action }) => action.id)),
          },
          select: { actionId: true },
        })
      ).map((row) => row.actionId),
    );
    // The pass's population evaluator, over a population of one, so both
    // writers apply the same cohort rules.
    const session = new CohortResolutionSession();
    await this.actionEventRecipientService.primeActiveUsers(session, () =>
      Promise.resolve([user]),
    );
    const rows: DecisionRow[] = [];
    for (const { action, enrollment } of open) {
      if (decided.has(action.id)) continue;
      rows.push(
        ...(await this.resolveAction({
          action,
          enrollment,
          users: [user],
          session,
          now,
        })),
      );
    }
    await this.insert(rows);
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
      const message = `decided ${count} member(s) of action ${action.id} (${rowReason})`;
      if (rowReason === CohortDecisionReason.ResolvedAfterDeadline) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    }
    return rows;
  }

  private async findResolvableActions(
    now: Date,
  ): Promise<{ action: ParsedAction; enrollment: CohortEnrollment }[]> {
    const actions = await this.actionRepository.find({
      where: { publicOnly: false },
      relations: { events: true },
    });
    return actions.map(parseAction).map((action) => ({
      action,
      enrollment: computeCohortEnrollment(action, now),
    }));
  }

  async findActionsInCatchUp(
    now: Date,
  ): Promise<{ action: ParsedAction; enrollment: CohortEnrollment }[]> {
    return (await this.findResolvableActions(now)).filter(({ enrollment }) =>
      isInCatchUp(enrollment, now),
    );
  }

  private async findActionIdsWithDecisions(
    actionIds: number[],
  ): Promise<Set<number>> {
    if (actionIds.length === 0) return new Set();
    const rows = await this.decisionRepository
      .createQueryBuilder("decision")
      .select('DISTINCT decision."actionId"', "actionId")
      .where('decision."actionId" IN (:...actionIds)', { actionIds })
      .getRawMany<{ actionId: number }>();
    return new Set(rows.map((row) => row.actionId));
  }

  private async findDecidedUserIds(
    actionIds: number[],
  ): Promise<Map<number, Set<number>>> {
    const rows = await this.decisionRepository.find({
      where: { actionId: In(actionIds) },
      select: { actionId: true, userId: true },
    });
    const byAction = new Map<number, Set<number>>();
    for (const { actionId, userId } of rows) {
      let userIds = byAction.get(actionId);
      if (!userIds) {
        userIds = new Set();
        byAction.set(actionId, userIds);
      }
      userIds.add(userId);
    }
    return byAction;
  }

  /**
   * All or nothing, so a later pass never skips a half-backfilled action. A
   * concurrent writer's row wins; decisions are final once written.
   */
  private async insert(rows: DecisionRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.decisionRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(ActionCohortDecision)
          .values(rows.slice(i, i + INSERT_CHUNK_SIZE))
          .orIgnore()
          .execute();
      }
    });
  }
}

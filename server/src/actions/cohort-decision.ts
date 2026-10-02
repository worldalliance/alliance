import type { CohortExpression } from "@alliance/common/cohort-expression";
import { millisecondsInDay, millisecondsInMinute } from "date-fns/constants";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import type { User } from "src/user/entities/user.entity";
import {
  computeContractSignedAfterOnboardingStart,
  hasMemberActionDeadlinePassed,
} from "src/utils/action-user";
import type { Action, ParsedAction } from "./entities/action.entity";
import { CohortDecisionReason } from "./entities/cohort-decision-reason";

/**
 * Longer than any signing request. A member who signs through a task form has
 * a contract before the form's answers and completion are saved, so writers
 * other than the signing one leave recent signers alone rather than decide
 * them mid-submission.
 */
const SIGNING_GRACE_MS = 10 * millisecondsInMinute;

export enum CohortEnrollmentState {
  NotStarted = "not_started",
  Open = "open",
  Closed = "closed",
}

export type CohortEnrollment =
  | { state: CohortEnrollmentState.NotStarted }
  | { state: CohortEnrollmentState.Open; start: Date }
  | { state: CohortEnrollmentState.Closed; start: Date; deadline: Date };

/**
 * Whether the resolver may issue ordinary decisions for an action. A regular
 * action stops at its member-action deadline, matching the late-signer cutoff
 * in `computeActionAssignment`. Onboarding never closes, because
 * `computeAssignmentCore` still assigns it to members who join after its
 * deadline.
 */
export function computeCohortEnrollment(
  action: Pick<Action, "onboarding" | "memberActionPhase">,
  now: Date,
): CohortEnrollment {
  const { event, deadlineEvent } = action.memberActionPhase;
  if (!event || event.date > now) {
    return { state: CohortEnrollmentState.NotStarted };
  }
  if (
    !action.onboarding &&
    deadlineEvent &&
    hasMemberActionDeadlinePassed(deadlineEvent.date, now)
  ) {
    return {
      state: CohortEnrollmentState.Closed,
      start: event.date,
      deadline: deadlineEvent.date,
    };
  }
  return { state: CohortEnrollmentState.Open, start: event.date };
}

export function openEnrollments<
  T extends Pick<Action, "onboarding" | "memberActionPhase">,
>(actions: T[], now: Date): Array<{ action: T; enrollment: CohortEnrollment }> {
  return actions.flatMap((action) => {
    const enrollment = computeCohortEnrollment(action, now);
    return enrollment.state === CohortEnrollmentState.Open
      ? [{ action, enrollment }]
      : [];
  });
}

/**
 * Whether readers take the action's cohort from its saved decisions. None
 * exist before launch or ever for a public-only action, whose readers take
 * the live cohort instead.
 */
export function readsSavedDecisions(
  action: Pick<
    Action,
    "events" | "onboarding" | "memberActionPhase" | "publicOnly"
  >,
  now: Date,
): boolean {
  if (!action.events) {
    throw new Error("`events` relation is not loaded");
  }
  if (action.publicOnly) {
    return false;
  }
  const enrollment = computeCohortEnrollment(action, now);
  switch (enrollment.state) {
    case CohortEnrollmentState.NotStarted:
      return false;
    case CohortEnrollmentState.Open:
    case CohortEnrollmentState.Closed:
      return true;
    default:
      throw new Error(
        `unknown enrollment state: ${enrollment satisfies never}`,
      );
  }
}

/**
 * Whether the resolver can decide this member at `at`. A member it cannot
 * admit gets no row, so a regular action's unsigned account stays free to
 * enroll by signing later.
 */
export function isCohortAdmissible(params: {
  action: Pick<Action, "onboarding" | "memberActionPhase">;
  user: Pick<User, "contractEvents" | "hasActiveContractAt">;
  at: Date;
}): boolean {
  const { action, user, at } = params;
  const { event } = action.memberActionPhase;
  if (!event) {
    return false;
  }
  return action.onboarding
    ? computeContractSignedAfterOnboardingStart({
        user,
        memberActionPhaseStart: event.date,
      })
    : user.hasActiveContractAt(at);
}

/**
 * Whether the member held a contract at some point in the window, and so was
 * admissible to at least one pass while the action was open.
 */
export function heldContractDuringWindow(params: {
  user: Pick<User, "contractEvents" | "hasActiveContractAt">;
  start: Date;
  deadline: Date;
}): boolean {
  const { user, start, deadline } = params;
  return (
    user.hasActiveContractAt(start) ||
    !!user.contractEvents?.some(
      (event) =>
        event.type === ContractEventType.SIGNED &&
        event.date > start &&
        event.date <= deadline,
    )
  );
}

/** Whether the member's latest signing request has had time to finish. */
export function isSettled(
  user: Pick<User, "contractEvents">,
  now: Date,
): boolean {
  const signedBefore = new Date(now.getTime() - SIGNING_GRACE_MS);
  return !user.contractEvents?.some(
    (event) =>
      event.type === ContractEventType.SIGNED && event.date > signedBefore,
  );
}

/**
 * How long after its deadline a regular action stays in the catch-up pass.
 * Admissibility there is judged at the deadline, so each closed action needs
 * only one successful pass.
 */
const CLOSED_ACTION_CATCH_UP_MS = 7 * millisecondsInDay;

export function admissionReason(params: {
  action: Pick<
    Action,
    "onboarding" | "memberActionPhase" | "prerequisiteActionIds"
  >;
  user: Pick<User, "contractEvents" | "hasActiveContractAt">;
  start: Date;
}): CohortDecisionReason {
  const { action, user, start } = params;
  if (!isCohortAdmissible({ action, user, at: start })) {
    return CohortDecisionReason.Signing;
  }
  return action.prerequisiteActionIds.length > 0
    ? CohortDecisionReason.PrerequisitesResolved
    : CohortDecisionReason.Launch;
}

export function isInCatchUp(enrollment: CohortEnrollment, now: Date): boolean {
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
 * The actions whose saved decisions the expression's MissedActionDeadline
 * leaves read. Other leaves read no decisions.
 */
export function decisionReadActionIds(
  expr: CohortExpression | null | undefined,
): number[] {
  if (!expr) return [];
  switch (expr.type) {
    case "MissedActionDeadline":
      return [expr.actionId];
    case "AND":
    case "OR":
      return expr.children.flatMap(decisionReadActionIds);
    case "NOT":
      return decisionReadActionIds(expr.child);
    case "Tag":
    case "Manual":
    case "CompletedAction":
    case "FormFieldValue":
    case "GroupLead":
    case "USMember":
    case "NonUSMember":
    case "AllMembers":
    case "Staff":
      return [];
    default:
      throw new Error(`unknown cohort expression: ${expr satisfies never}`);
  }
}

/** Whether the expression reads the decisions of any of `actionIds`. */
export function readsDecisionsOf(
  expr: CohortExpression | null | undefined,
  actionIds: ReadonlySet<number>,
): boolean {
  return decisionReadActionIds(expr).some((id) => actionIds.has(id));
}

/**
 * Orders `items` so each follows the ones whose decisions its expression
 * reads. Within a cycle the order is arbitrary.
 */
export function orderByDecisionReads<
  T extends { action: Pick<ParsedAction, "id" | "cohortExpression"> },
>(items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.action.id, item]));
  const visited = new Set<number>();
  const ordered: T[] = [];
  const visit = (item: T) => {
    if (visited.has(item.action.id)) return;
    visited.add(item.action.id);
    for (const id of decisionReadActionIds(item.action.cohortExpression)) {
      const read = byId.get(id);
      if (read) visit(read);
    }
    ordered.push(item);
  };
  items.forEach(visit);
  return ordered;
}

export function closedEnrollmentsInCatchUp<
  T extends Pick<Action, "onboarding" | "memberActionPhase">,
>(params: {
  actions: T[];
  now: Date;
}): Array<{
  action: T;
  enrollment: Extract<
    CohortEnrollment,
    { state: CohortEnrollmentState.Closed }
  >;
}> {
  const { actions, now } = params;
  return actions.flatMap((action) => {
    const enrollment = computeCohortEnrollment(action, now);
    return enrollment.state === CohortEnrollmentState.Closed &&
      isInCatchUp(enrollment, now)
      ? [{ action, enrollment }]
      : [];
  });
}

/**
 * The closed actions in catch-up whose decisions `actions` read, directly or
 * through each other, each after the ones it reads.
 */
export async function findReadClosedEnrollments<
  T extends Pick<
    ParsedAction,
    "id" | "cohortExpression" | "onboarding" | "memberActionPhase"
  >,
>(params: {
  actions: Pick<ParsedAction, "cohortExpression">[];
  load: (ids: number[]) => Promise<T[]>;
  now: Date;
}): Promise<ReturnType<typeof closedEnrollmentsInCatchUp<T>>> {
  const { actions, load, now } = params;
  const closed: ReturnType<typeof closedEnrollmentsInCatchUp<T>> = [];
  const seen = new Set<number>();
  let reads = actions.flatMap(({ cohortExpression }) =>
    decisionReadActionIds(cohortExpression),
  );
  while (reads.length > 0) {
    const ids = [...new Set(reads)].filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (ids.length === 0) break;
    const found = closedEnrollmentsInCatchUp({ actions: await load(ids), now });
    closed.push(...found);
    reads = found.flatMap(({ action }) =>
      decisionReadActionIds(action.cohortExpression),
    );
  }
  return orderByDecisionReads(closed);
}

/**
 * A closed action the resolver never decided that launched before its first
 * decision. Catch-up would treat its whole cohort as a processing failure.
 */
export function belongsToBackfill(params: {
  enrollment: { start: Date };
  hasDecisions: boolean;
  cutover: Date | null;
}): boolean {
  const { enrollment, hasDecisions, cutover } = params;
  return !hasDecisions && (!cutover || enrollment.start < cutover);
}

const ID_SAMPLE_SIZE = 50;

/** A count and the first ids, for log lines about sets of members. */
export function formatIdSample(ids: number[]): string {
  return `${ids.length} [${ids.slice(0, ID_SAMPLE_SIZE).join(", ")}]`;
}

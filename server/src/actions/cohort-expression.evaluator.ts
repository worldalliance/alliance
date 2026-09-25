/**
 * Cohort Expression Evaluator
 */

import { CohortExpression } from "@alliance/common/cohort-expression";
import { UsMembership } from "src/geo/us-membership";

// --- Evaluation Context ---

export type CohortEvaluationContext = {
  getUserIdsForTag(tagId: string): Promise<Set<number>>;
  getUserIdsCompletedAction(actionId: number): Promise<Set<number>>;
  getUserIdsInProgressAction(actionId: number): Promise<Set<number>>;
  getUserIdsMissedActionDeadline(actionId: number): Promise<Set<number>>;
  getUserIdsForFormField(params: {
    formId: number;
    fieldId: string;
    responseEqualTo?: string;
    responseAny?: boolean;
  }): Promise<Set<number>>;
  getGroupLeadUserIds(): Promise<Set<number>>;
  getUserIdsByUsMembership(
    membership: UsMembership.Us | UsMembership.NonUs,
  ): Promise<Set<number>>;
  getAllCandidateUserIds(): Promise<Set<number>>;
  targetUserId?: number;
};

/**
 * Resolves a CohortExpression to the Set of user IDs it targets.
 *
 * `NOT(X)` is `getAllCandidateUserIds()` minus `X`'s set: every user for the
 * population context, `{userId}` for a single-user context.
 *
 * When `ctx.targetUserId` is set, the evaluator only cares about that one
 * user's membership, so every leaf set is `{targetUserId}` or `{}`. This lets
 * AND/OR short-circuit (stop once the target drops out / matches) instead of
 * fanning out every branch's DB work and `InProgressAction` recursion. Set by
 * {@link singleUserCohortContext}; population contexts omit it and need full
 * sets, so they evaluate children in parallel.
 *
 * @param expr The expression to evaluate
 * @param ctx Data-fetching context
 * @param visitedActionIds Cycle detection guard for InProgressAction
 */
export async function evaluateCohortExpression(
  expr: CohortExpression,
  ctx: CohortEvaluationContext,
  visitedActionIds: Set<number> = new Set(),
): Promise<Set<number>> {
  switch (expr.type) {
    case "Tag":
      return ctx.getUserIdsForTag(expr.tagId);
    case "Manual":
      return new Set(expr.userIds);
    case "CompletedAction":
      return ctx.getUserIdsCompletedAction(expr.actionId);
    case "InProgressAction": {
      if (visitedActionIds.has(expr.actionId)) {
        return new Set();
      }
      return ctx.getUserIdsInProgressAction(expr.actionId);
    }
    case "MissedActionDeadline": {
      // Resolving the referenced action's roster recurses into its cohort
      // expression, so it needs the same cycle guard as InProgressAction.
      if (visitedActionIds.has(expr.actionId)) {
        return new Set();
      }
      return ctx.getUserIdsMissedActionDeadline(expr.actionId);
    }
    case "FormFieldValue":
      return ctx.getUserIdsForFormField({
        formId: expr.formId,
        fieldId: expr.fieldId,
        responseEqualTo: expr.responseEqualTo,
        responseAny: expr.responseAny,
      });
    case "GroupLead":
      return ctx.getGroupLeadUserIds();
    case "USMember":
      return ctx.getUserIdsByUsMembership(UsMembership.Us);
    case "NonUSMember":
      return ctx.getUserIdsByUsMembership(UsMembership.NonUs);
    case "AND": {
      if (expr.children.length === 0) return new Set();
      const { targetUserId } = ctx;
      if (targetUserId !== undefined) {
        // Single-user: stop at the first child the target is absent from.
        for (const child of expr.children) {
          const set = await evaluateCohortExpression(
            child,
            ctx,
            visitedActionIds,
          );
          if (!set.has(targetUserId)) return new Set();
        }
        return new Set([targetUserId]);
      }
      const sets = await Promise.all(
        expr.children.map((child) =>
          evaluateCohortExpression(child, ctx, visitedActionIds),
        ),
      );
      return intersect(sets);
    }
    case "OR": {
      if (expr.children.length === 0) return new Set();
      const { targetUserId } = ctx;
      if (targetUserId !== undefined) {
        // Single-user: stop at the first child the target is present in.
        for (const child of expr.children) {
          const set = await evaluateCohortExpression(
            child,
            ctx,
            visitedActionIds,
          );
          if (set.has(targetUserId)) return new Set([targetUserId]);
        }
        return new Set();
      }
      const sets = await Promise.all(
        expr.children.map((child) =>
          evaluateCohortExpression(child, ctx, visitedActionIds),
        ),
      );
      return union(sets);
    }
    case "NOT": {
      const universe = await ctx.getAllCandidateUserIds();
      const excluded = await evaluateCohortExpression(
        expr.child,
        ctx,
        visitedActionIds,
      );
      return difference(universe, excluded);
    }
    default:
      throw new Error(
        `unknown cohort expression: ${JSON.stringify(expr satisfies never)}`,
      );
  }
}

// --- Single-user scoping ---

/**
 * Per-user predicates for the single-user case. Each leaf is a boolean check
 * for one user; {@link singleUserCohortContext} turns them into a context whose
 * sets are `{userId}` or `{}`.
 */
export type SingleUserCohortPredicates = {
  userId: number;
  hasTag(tagId: string): boolean;
  completedAction(actionId: number): Promise<boolean>;
  inProgressAction(actionId: number): Promise<boolean>;
  missedActionDeadline(actionId: number): Promise<boolean>;
  matchesFormField(params: {
    formId: number;
    fieldId: string;
    responseEqualTo?: string;
    responseAny?: boolean;
  }): Promise<boolean>;
  isGroupLead(): Promise<boolean>;
  usMembership(): Promise<UsMembership>;
};

/**
 * Adapts per-user boolean predicates into a {@link CohortEvaluationContext}
 * whose every set is `{userId}` (predicate true) or `{}` (false). Running
 * {@link evaluateCohortExpression} with this context and checking `.has(userId)`
 * gives the same answer the population evaluator would for that user, because
 * AND/OR/NOT/difference all distribute over the singleton. Setting
 * `targetUserId` also lets AND/OR short-circuit rather than fan out every
 * branch's DB work.
 */
export function singleUserCohortContext(
  p: SingleUserCohortPredicates,
): CohortEvaluationContext {
  const just = (matches: boolean): Set<number> =>
    matches ? new Set([p.userId]) : new Set();
  const justAsync = async (matches: Promise<boolean>): Promise<Set<number>> =>
    just(await matches);

  return {
    getUserIdsForTag: async (tagId) => just(p.hasTag(tagId)),
    getUserIdsCompletedAction: (actionId) =>
      justAsync(p.completedAction(actionId)),
    getUserIdsInProgressAction: (actionId) =>
      justAsync(p.inProgressAction(actionId)),
    getUserIdsMissedActionDeadline: (actionId) =>
      justAsync(p.missedActionDeadline(actionId)),
    getUserIdsForFormField: (params) => justAsync(p.matchesFormField(params)),
    getGroupLeadUserIds: () => justAsync(p.isGroupLead()),
    getUserIdsByUsMembership: async (membership) =>
      just((await p.usMembership()) === membership),
    getAllCandidateUserIds: async () => just(true),
    targetUserId: p.userId,
  };
}

/**
 * Whether one form response's answers satisfy a FormFieldValue leaf. Shared by
 * the population and single-user contexts so they agree. `responseAny` (presence
 * check) takes precedence over `responseEqualTo` (exact match).
 */
export function answerMatchesFormField(
  answers: Record<string, unknown> | null | undefined,
  params: { fieldId: string; responseEqualTo?: string; responseAny?: boolean },
): boolean {
  const answer = answers?.[params.fieldId];
  if (params.responseEqualTo !== undefined && !params.responseAny) {
    return String(answer) === params.responseEqualTo;
  }
  return !!answer && !(Array.isArray(answer) && answer.length === 0);
}

// --- Set helpers ---

function intersect(sets: Set<number>[]): Set<number> {
  if (sets.length === 0) return new Set();
  // Start with smallest set for efficiency
  const sorted = sets.toSorted((a, b) => a.size - b.size);
  const result = new Set(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    for (const id of result) {
      if (!sorted[i].has(id)) {
        result.delete(id);
      }
    }
  }
  return result;
}

function union(sets: Set<number>[]): Set<number> {
  const result = new Set<number>();
  for (const set of sets) {
    for (const id of set) {
      result.add(id);
    }
  }
  return result;
}

function difference(a: Set<number>, b: Set<number>): Set<number> {
  const result = new Set<number>();
  for (const id of a) {
    if (!b.has(id)) {
      result.add(id);
    }
  }
  return result;
}

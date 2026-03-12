/**
 * Cohort Expression Evaluator
 *
 * Two evaluator modes:
 * 1. Batch: resolves expression → Set<number> (user IDs)
 * 2. Single-user: resolves expression for one user → boolean
 */

import { CohortExpression, isLeafCondition } from './cohort-expression.types';

// --- Batch Evaluation Context ---

export interface CohortEvaluationContext {
  getUserIdsForTag(tagId: string): Promise<Set<number>>;
  getUserIdsCompletedAction(actionId: number): Promise<Set<number>>;
  getUserIdsInProgressAction(actionId: number): Promise<Set<number>>;
  getUserIdsForFormField(params: {
    formId: number;
    fieldId: string;
    responseEqualTo?: string;
    responseAny?: boolean;
  }): Promise<Set<number>>;
  getGroupLeadUserIds(): Promise<Set<number>>;
  getAllCandidateUserIds(): Promise<Set<number>>;
}

/**
 * Batch evaluator: resolves a CohortExpression to a Set of user IDs.
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
  if (isLeafCondition(expr)) {
    switch (expr.type) {
      case 'Tag':
        return ctx.getUserIdsForTag(expr.tagId);
      case 'Manual':
        return new Set(expr.userIds);
      case 'CompletedAction':
        return ctx.getUserIdsCompletedAction(expr.actionId);
      case 'InProgressAction': {
        if (visitedActionIds.has(expr.actionId)) {
          return new Set();
        }
        return ctx.getUserIdsInProgressAction(expr.actionId);
      }
      case 'FormFieldValue':
        return ctx.getUserIdsForFormField({
          formId: expr.formId,
          fieldId: expr.fieldId,
          responseEqualTo: expr.responseEqualTo,
          responseAny: expr.responseAny,
        });
      case 'GroupLead':
        return ctx.getGroupLeadUserIds();
    }
  }

  // Boolean operators
  switch (expr.op) {
    case 'AND': {
      if (expr.children.length === 0) return new Set();
      const sets = await Promise.all(
        expr.children.map((child) =>
          evaluateCohortExpression(child, ctx, visitedActionIds),
        ),
      );
      return intersect(sets);
    }
    case 'OR': {
      if (expr.children.length === 0) return new Set();
      const sets = await Promise.all(
        expr.children.map((child) =>
          evaluateCohortExpression(child, ctx, visitedActionIds),
        ),
      );
      return union(sets);
    }
    case 'NOT': {
      const universe = await ctx.getAllCandidateUserIds();
      const excluded = await evaluateCohortExpression(
        expr.child,
        ctx,
        visitedActionIds,
      );
      return difference(universe, excluded);
    }
  }
}

// --- Single-User Evaluation Context ---

export interface SingleUserCohortContext {
  userId: number;
  userHasTag(tagId: string): boolean;
  userCompletedAction(actionId: number): Promise<boolean>;
  userInProgressAction(actionId: number): Promise<boolean>;
  userMatchesFormField(params: {
    formId: number;
    fieldId: string;
    responseEqualTo?: string;
    responseAny?: boolean;
  }): Promise<boolean>;
  userIsGroupLead(): Promise<boolean>;
}

/**
 * Single-user evaluator: resolves a CohortExpression for one user → boolean.
 *
 * @param expr The expression to evaluate
 * @param ctx Per-user check context
 * @param visitedActionIds Cycle detection guard for InProgressAction
 */
export async function evaluateCohortExpressionForUser(
  expr: CohortExpression,
  ctx: SingleUserCohortContext,
  visitedActionIds: Set<number> = new Set(),
): Promise<boolean> {
  if (isLeafCondition(expr)) {
    switch (expr.type) {
      case 'Tag':
        return ctx.userHasTag(expr.tagId);
      case 'Manual':
        return expr.userIds.includes(ctx.userId);
      case 'CompletedAction':
        return ctx.userCompletedAction(expr.actionId);
      case 'InProgressAction': {
        if (visitedActionIds.has(expr.actionId)) {
          return false;
        }
        return ctx.userInProgressAction(expr.actionId);
      }
      case 'FormFieldValue':
        return ctx.userMatchesFormField({
          formId: expr.formId,
          fieldId: expr.fieldId,
          responseEqualTo: expr.responseEqualTo,
          responseAny: expr.responseAny,
        });
      case 'GroupLead':
        return ctx.userIsGroupLead();
    }
  }

  switch (expr.op) {
    case 'AND': {
      if (expr.children.length === 0) return false;
      for (const child of expr.children) {
        if (
          !(await evaluateCohortExpressionForUser(child, ctx, visitedActionIds))
        ) {
          return false;
        }
      }
      return true;
    }
    case 'OR': {
      if (expr.children.length === 0) return false;
      for (const child of expr.children) {
        if (
          await evaluateCohortExpressionForUser(child, ctx, visitedActionIds)
        ) {
          return true;
        }
      }
      return false;
    }
    case 'NOT': {
      return !(await evaluateCohortExpressionForUser(
        expr.child,
        ctx,
        visitedActionIds,
      ));
    }
  }
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

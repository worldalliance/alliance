/**
 * Shared Cohort Expression Types
 *
 * These types are shared between the server and admin frontend.
 * The server re-exports from its own module; the admin imports from here.
 */

// --- Leaf Conditions ---

export interface TagCondition {
  type: 'Tag';
  tagId: string;
}

export interface ManualCondition {
  type: 'Manual';
  userIds: number[];
}

export interface CompletedActionCondition {
  type: 'CompletedAction';
  actionId: number;
}

export interface InProgressActionCondition {
  type: 'InProgressAction';
  actionId: number;
}

export interface FormFieldValueCondition {
  type: 'FormFieldValue';
  formId: number;
  fieldId: string;
  responseEqualTo?: string;
  responseAny?: boolean;
}

export interface GroupLeadCondition {
  type: 'GroupLead';
}

export type LeafCondition =
  | TagCondition
  | ManualCondition
  | CompletedActionCondition
  | InProgressActionCondition
  | FormFieldValueCondition
  | GroupLeadCondition;

// --- Boolean Operators ---

export interface AndOperator {
  op: 'AND';
  children: CohortExpression[];
}

export interface OrOperator {
  op: 'OR';
  children: CohortExpression[];
}

export interface NotOperator {
  op: 'NOT';
  child: CohortExpression;
}

export type BooleanOperator = AndOperator | OrOperator | NotOperator;

// --- Top-level type ---

export type CohortExpression = LeafCondition | BooleanOperator;

// --- Type guards ---

export function isLeafCondition(
  expr: CohortExpression,
): expr is LeafCondition {
  return 'type' in expr;
}

export function isBooleanOperator(
  expr: CohortExpression,
): expr is BooleanOperator {
  return 'op' in expr;
}

/**
 * Walk the expression tree and check if any TagCondition references the given tagId.
 */
export function expressionReferencesTag(
  expr: CohortExpression | null | undefined,
  tagId: string,
): boolean {
  if (!expr) return false;

  if (isLeafCondition(expr)) {
    return expr.type === 'Tag' && expr.tagId === tagId;
  }

  if (expr.op === 'NOT') {
    return expressionReferencesTag(expr.child, tagId);
  }

  return expr.children.some((child) => expressionReferencesTag(child, tagId));
}

/**
 * Cohort Expression
 *
 * A composable boolean expression tree for defining which users should
 * participate in an action. Stored as jsonb on the server, edited in the
 * admin app — run `cohortExpressionSchema.parse`/`.safeParse` immediately
 * wherever one is pulled from an untyped source (db row, HTTP body, …).
 */

import z from "zod";

// --- Leaf Conditions ---

export const tagConditionSchema = z.strictObject({
  type: z.literal("Tag"),
  tagId: z.string(),
});
export type TagCondition = z.infer<typeof tagConditionSchema>;

export const manualConditionSchema = z.strictObject({
  type: z.literal("Manual"),
  userIds: z.array(z.number()),
});
export type ManualCondition = z.infer<typeof manualConditionSchema>;

export const completedActionConditionSchema = z.strictObject({
  type: z.literal("CompletedAction"),
  actionId: z.number(),
});
export type CompletedActionCondition = z.infer<
  typeof completedActionConditionSchema
>;

export const inProgressActionConditionSchema = z.strictObject({
  type: z.literal("InProgressAction"),
  actionId: z.number(),
});
export type InProgressActionCondition = z.infer<
  typeof inProgressActionConditionSchema
>;

/**
 * Users who failed to complete the referenced action: assigned to it, its
 * member-action deadline has passed, and they neither completed nor withdrew.
 * Matches the missed_deadline pill, so optional actions yield no members and
 * users away during the member-action window are excluded (they show
 * optional_task / away instead of missed_deadline). Dismissing the card does
 * NOT exclude (dismissal is a view-only overlay, and the dismiss button is
 * offered on past-deadline cards). Dynamic — a late completion drops the
 * user out of this set.
 */
export const missedActionDeadlineConditionSchema = z.strictObject({
  type: z.literal("MissedActionDeadline"),
  actionId: z.number(),
});
export type MissedActionDeadlineCondition = z.infer<
  typeof missedActionDeadlineConditionSchema
>;

/**
 * With `responseEqualTo` set (and `responseAny` falsy), matches an exact
 * answer; otherwise — including neither field set, the builder's initial
 * state — matches any non-empty answer. Setting both is rejected: the
 * evaluator would let `responseAny` silently shadow `responseEqualTo`.
 */
export const formFieldValueConditionSchema = z
  .strictObject({
    type: z.literal("FormFieldValue"),
    formId: z.number(),
    fieldId: z.string(),
    responseEqualTo: z.string().optional(),
    responseAny: z.boolean().optional(),
  })
  .refine((c) => !(c.responseAny === true && c.responseEqualTo !== undefined), {
    message:
      "responseAny would shadow responseEqualTo; set only one of the two",
  });
export type FormFieldValueCondition = z.infer<
  typeof formFieldValueConditionSchema
>;

export const groupLeadConditionSchema = z.strictObject({
  type: z.literal("GroupLead"),
});
export type GroupLeadCondition = z.infer<typeof groupLeadConditionSchema>;

/**
 * Members located in the United States. The city on their profile decides it;
 * for members without one, their time zone's country does. A member with
 * neither, or with a zone no country claims (UTC), matches neither this nor
 * {@link nonUsMemberConditionSchema}.
 */
export const usMemberConditionSchema = z.strictObject({
  type: z.literal("USMember"),
});
export type UsMemberCondition = z.infer<typeof usMemberConditionSchema>;

/** Members located outside the United States, resolved like {@link usMemberConditionSchema}. */
export const nonUsMemberConditionSchema = z.strictObject({
  type: z.literal("NonUSMember"),
});
export type NonUsMemberCondition = z.infer<typeof nonUsMemberConditionSchema>;

export const leafConditionSchema = z.discriminatedUnion("type", [
  tagConditionSchema,
  manualConditionSchema,
  completedActionConditionSchema,
  inProgressActionConditionSchema,
  missedActionDeadlineConditionSchema,
  formFieldValueConditionSchema,
  groupLeadConditionSchema,
  usMemberConditionSchema,
  nonUsMemberConditionSchema,
]);
export type LeafCondition = z.infer<typeof leafConditionSchema>;

// --- Boolean Operators ---

// The operator types are recursive, so they are declared by hand (as type
// aliases, not interfaces, to stay assignable to Record<string, unknown>)
// and the top-level schema is annotated with z.ZodType instead of being
// inferred. Operators share the `type` discriminator with the leaves so the
// whole expression is a single discriminated union.

export type AndOperator = { type: "AND"; children: CohortExpression[] };
export type OrOperator = { type: "OR"; children: CohortExpression[] };
export type NotOperator = { type: "NOT"; child: CohortExpression };

export type BooleanOperator = AndOperator | OrOperator | NotOperator;

// --- Top-level type ---

export type CohortExpression = LeafCondition | BooleanOperator;

const andOperatorSchema = z.strictObject({
  type: z.literal("AND"),
  children: z.lazy(
    (): z.ZodType<CohortExpression[]> => z.array(cohortExpressionSchema),
  ),
});

const orOperatorSchema = z.strictObject({
  type: z.literal("OR"),
  children: z.lazy(
    (): z.ZodType<CohortExpression[]> => z.array(cohortExpressionSchema),
  ),
});

const notOperatorSchema = z.strictObject({
  type: z.literal("NOT"),
  child: z.lazy((): z.ZodType<CohortExpression> => cohortExpressionSchema),
});

export const cohortExpressionSchema: z.ZodType<CohortExpression> =
  z.discriminatedUnion("type", [
    tagConditionSchema,
    manualConditionSchema,
    completedActionConditionSchema,
    inProgressActionConditionSchema,
    missedActionDeadlineConditionSchema,
    formFieldValueConditionSchema,
    groupLeadConditionSchema,
    usMemberConditionSchema,
    nonUsMemberConditionSchema,
    andOperatorSchema,
    orOperatorSchema,
    notOperatorSchema,
  ]);

// --- Type guards ---

export function isBooleanOperator(
  expr: CohortExpression,
): expr is BooleanOperator {
  return expr.type === "AND" || expr.type === "OR" || expr.type === "NOT";
}

export function isLeafCondition(expr: CohortExpression): expr is LeafCondition {
  return !isBooleanOperator(expr);
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
    return expr.type === "Tag" && expr.tagId === tagId;
  }

  if (expr.type === "NOT") {
    return expressionReferencesTag(expr.child, tagId);
  }

  return expr.children.some((child) => expressionReferencesTag(child, tagId));
}

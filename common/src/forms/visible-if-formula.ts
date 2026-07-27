import z from "zod";
import { deviceVisibilityTargetSchema } from "./device";

const conditionEqualsSchema = z.strictObject({
  kind: z.literal("equals"),
  when: z.string(),
  equals: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  sourceFormId: z.number().optional(),
});

const conditionIncludesOptionSchema = z.strictObject({
  kind: z.literal("includesOption"),
  when: z.string(),
  includesOption: z.string(),
  sourceFormId: z.number().optional(),
});

const conditionAnySelectedSchema = z.strictObject({
  kind: z.literal("anySelected"),
  when: z.string(),
  anySelected: z.boolean(),
  sourceFormId: z.number().optional(),
});

const conditionHasValueSchema = z.strictObject({
  kind: z.literal("hasValue"),
  when: z.string(),
  hasValue: z.boolean(),
  sourceFormId: z.number().optional(),
});

const conditionValidatorSchema = z.strictObject({
  kind: z.literal("validator"),
  validatorId: z.number(),
  resultEquals: z.boolean().optional(),
});

const conditionDeviceTypeSchema = z.strictObject({
  kind: z.literal("deviceType"),
  deviceType: z.array(deviceVisibilityTargetSchema),
});

const conditionOutputBlockVisibleSchema = z.strictObject({
  kind: z.literal("outputBlockVisible"),
  outputBlockVisible: z.string(),
  isVisible: z.boolean().optional(),
});

const conditionUserHasCitySchema = z.strictObject({
  kind: z.literal("userHasCity"),
  userHasCity: z.boolean(),
});

/**
 * True when the user's first contract signing (their earliest `signed`
 * contract event) falls `before` / `onOrAfter` `date`. Users who have never
 * signed fail both comparisons.
 */
const conditionFirstContractSignedSchema = z.strictObject({
  kind: z.literal("firstContractSigned"),
  comparison: z.enum(["before", "onOrAfter"]),
  date: z.iso.datetime(),
});

/**
 * True when the user has completed at least `count` actions.
 */
const conditionCompletedActionCountSchema = z.strictObject({
  kind: z.literal("completedActionCount"),
  atLeast: z.number().int().min(0),
});

export const conditionSchema = z.discriminatedUnion("kind", [
  conditionEqualsSchema,
  conditionIncludesOptionSchema,
  conditionAnySelectedSchema,
  conditionHasValueSchema,
  conditionValidatorSchema,
  conditionDeviceTypeSchema,
  conditionOutputBlockVisibleSchema,
  conditionUserHasCitySchema,
  conditionFirstContractSignedSchema,
  conditionCompletedActionCountSchema,
]);

export type Condition = z.infer<typeof conditionSchema>;
export type ConditionKind = Condition["kind"];

/**
 * Conditions whose value comes from the viewer's account rather than from form
 * answers. They're resolved only while a user fills out a form, so they're
 * rejected on output-view blocks; a schema containing one needs the viewer's
 * visibility context (`GET /user/myvisibilitycontext`) to render, and the
 * server fetches the same values when stripping hidden answers at submission.
 */
export const CONDITION_KIND_IS_ACCOUNT_DERIVED = {
  equals: false,
  includesOption: false,
  anySelected: false,
  hasValue: false,
  validator: false,
  deviceType: false,
  outputBlockVisible: false,
  userHasCity: true,
  firstContractSigned: true,
  completedActionCount: true,
} as const satisfies Record<ConditionKind, boolean>;

/**
 * The kinds flagged above, as a union — derived from the table so there is no
 * second list to keep in sync. Callers that fetch account state one value at a
 * time (rather than all of it) key off these.
 */
export type AccountDerivedConditionKind = {
  [K in ConditionKind]: (typeof CONDITION_KIND_IS_ACCOUNT_DERIVED)[K] extends true
    ? K
    : never;
}[ConditionKind];

export function isAccountDerivedConditionKind(
  kind: ConditionKind,
): kind is AccountDerivedConditionKind {
  return CONDITION_KIND_IS_ACCOUNT_DERIVED[kind];
}

const KNOWN_CONDITION_KINDS: ReadonlySet<string> = new Set(
  Object.keys(CONDITION_KIND_IS_ACCOUNT_DERIVED),
);

/**
 * Whether this build understands a condition kind at all.
 */
export function isKnownConditionKind(kind: string): kind is ConditionKind {
  return KNOWN_CONDITION_KINDS.has(kind);
}

/** Formula tree for visibility: AND/OR of two operands, NOT of one. Leaves are condition names (e.g. condition1, condition2). */
export type FormulaNode =
  | { op: "AND"; left: FormulaNode; right: FormulaNode }
  | { op: "OR"; left: FormulaNode; right: FormulaNode }
  | { op: "NOT"; operand: FormulaNode }
  | string;

export const formulaNodeSchema: z.ZodType<FormulaNode> = z.lazy(() =>
  z.union([
    z.string(),
    z.strictObject({
      op: z.literal("AND"),
      left: formulaNodeSchema,
      right: formulaNodeSchema,
    }),
    z.strictObject({
      op: z.literal("OR"),
      left: formulaNodeSchema,
      right: formulaNodeSchema,
    }),
    z.strictObject({
      op: z.literal("NOT"),
      operand: formulaNodeSchema,
    }),
  ]),
);

/**
 * Named conditions (condition1, condition2, ...) plus a formula tree.
 *
 * Hand-written rather than z.infer: the inferred type trips TS7056 in
 * server's declaration emit.
 */
export type VisibleIfFormula = {
  conditions: Record<string, Condition>;
  formula: FormulaNode;
};
export const visibleIfFormulaSchema: z.ZodType<VisibleIfFormula> =
  z.strictObject({
    conditions: z.record(z.string(), conditionSchema),
    formula: formulaNodeSchema,
  });

export function evaluateVisibilityFormula(
  node: FormulaNode,
  results: Record<string, boolean>,
): boolean {
  if (typeof node === "string") return results[node] === true;
  if (node.op === "NOT") {
    const operand =
      typeof node.operand === "string"
        ? results[node.operand] === true
        : evaluateVisibilityFormula(node.operand, results);
    return !operand;
  }
  if (node.op === "AND") {
    const left =
      typeof node.left === "string"
        ? results[node.left] === true
        : evaluateVisibilityFormula(node.left, results);
    const right =
      typeof node.right === "string"
        ? results[node.right] === true
        : evaluateVisibilityFormula(node.right, results);
    return left && right;
  }
  if (node.op === "OR") {
    const left =
      typeof node.left === "string"
        ? results[node.left] === true
        : evaluateVisibilityFormula(node.left, results);
    const right =
      typeof node.right === "string"
        ? results[node.right] === true
        : evaluateVisibilityFormula(node.right, results);
    return left || right;
  }
  return false;
}

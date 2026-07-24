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
]);

export type Condition = z.infer<typeof conditionSchema>;
export type ConditionKind = Condition["kind"];

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

export const visibleIfFormulaSchema = z.strictObject({
  conditions: z.record(z.string(), conditionSchema),
  formula: formulaNodeSchema,
});

/** Named conditions (condition1, condition2, ...) plus a formula tree. */
export type VisibleIfFormula = z.infer<typeof visibleIfFormulaSchema>;

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

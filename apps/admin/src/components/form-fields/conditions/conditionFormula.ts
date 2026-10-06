import type {
  Condition,
  FormulaNode,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { R, type Result } from "@alliance/common/result";
import {
  formulaConditionNames,
  parseVisibilityFormula,
} from "@alliance/shared/forms/visibilityFormula";
import { comparisonOf, isFieldCondition } from "./fieldConditions";

export enum Combinator {
  All = "AND",
  Any = "OR",
}

export type RuleRef = { name: string; negated: boolean };

/** An All/Any list of rules that rebuilds the formula exactly. */
export type SimpleFormula = { combinator: Combinator; rules: RuleRef[] };

const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true });

export function sortedConditionNames(
  conditions: Record<string, Condition>,
): string[] {
  return Object.keys(conditions).sort(NAME_COLLATOR.compare);
}

/**
 * `condition{N}` numbered past every name the conditions or the formula use,
 * so a reference left by a deleted rule never binds to a new one.
 */
export function nextConditionName(
  visibility: VisibleIfFormula | undefined,
): string {
  const names = [
    ...Object.keys(visibility?.conditions ?? {}),
    ...(visibility ? formulaConditionNames(visibility.formula) : []),
  ];
  const highest = Math.max(
    0,
    ...names.map((name) => Number(/^condition(\d+)$/i.exec(name)?.[1] ?? 0)),
  );
  return `condition${highest + 1}`;
}

/**
 * The condition equivalent to NOT `condition` without a NOT, where its own
 * fields can say it.
 */
export function invertCondition(condition: Condition): Condition | null {
  switch (condition.kind) {
    case "hasValue":
      return { ...condition, hasValue: !condition.hasValue };
    case "outputBlockVisible":
      return { ...condition, isVisible: !(condition.isVisible ?? true) };
    case "userHasCity":
      return { ...condition, userHasCity: !condition.userHasCity };
    case "userPropertyHasValue":
      return { ...condition, hasValue: !condition.hasValue };
    // A validator with no result yet fails both resultEquals values, so
    // NOT passes is not the same as fails.
    case "validator":
    case "equals":
    case "includesOption":
    case "anySelected":
    case "selectedCount":
    case "deviceType":
    case "firstContractSigned":
    case "completedActionCount":
      return null;
    default:
      throw new Error(
        `unknown condition: ${JSON.stringify(condition satisfies never)}`,
      );
  }
}

function negatable(condition: Condition): boolean {
  return isFieldCondition(condition)
    ? comparisonOf(condition, { negated: true }) !== null
    : invertCondition(condition) !== null;
}

function flatten(node: FormulaNode, op: Combinator): FormulaNode[] {
  if (typeof node !== "string" && node.op === op) {
    return [...flatten(node.left, op), ...flatten(node.right, op)];
  }
  return [node];
}

/**
 * The formula as an All/Any rule list, or null when the list could not rebuild
 * it: mixed or grouped operators, a NOT the rule can't show, or a condition
 * that isn't referenced exactly once.
 */
export function simpleFormulaOf(
  visibility: VisibleIfFormula,
): SimpleFormula | null {
  const { formula, conditions } = visibility;
  const combinator =
    typeof formula !== "string" && formula.op === "OR"
      ? Combinator.Any
      : Combinator.All;
  const rules: RuleRef[] = [];
  for (const node of flatten(formula, combinator)) {
    if (typeof node === "string") {
      rules.push({ name: node, negated: false });
    } else if (node.op === "NOT" && typeof node.operand === "string") {
      const condition = Object.hasOwn(conditions, node.operand)
        ? conditions[node.operand]
        : undefined;
      if (!condition || !negatable(condition)) return null;
      rules.push({ name: node.operand, negated: true });
    } else {
      return null;
    }
  }
  const names = new Set(rules.map((rule) => rule.name));
  const defined = Object.keys(conditions);
  if (
    names.size !== rules.length ||
    defined.length !== rules.length ||
    !defined.every((name) => names.has(name))
  ) {
    return null;
  }
  return { combinator, rules };
}

/** Null for an empty rule list, which leaves the element unconditional. */
export function buildFormula(simple: SimpleFormula): FormulaNode | null {
  const leaves: FormulaNode[] = simple.rules.map(({ name, negated }) =>
    negated ? { op: "NOT", operand: name } : name,
  );
  return leaves.reduceRight<FormulaNode | null>(
    (right, left) =>
      right === null ? left : { op: simple.combinator, left, right },
    null,
  );
}

function missingConditionNames(
  formula: FormulaNode,
  conditions: Record<string, Condition>,
): string[] {
  return [
    ...new Set(
      formulaConditionNames(formula).filter(
        (name) => !Object.hasOwn(conditions, name),
      ),
    ),
  ];
}

/** Expression text as a formula, failing where it doesn't parse or names a
 * rule `conditions` doesn't define. */
export function checkExpression(
  text: string,
  conditions: Record<string, Condition>,
): Result<FormulaNode, string> {
  if (text.trim() === "") {
    return R.failure(
      "Write an expression, or replace it with all rules or any rule below.",
    );
  }
  const parsed = parseVisibilityFormula(text);
  if (!parsed.ok) return parsed;
  const missing = missingConditionNames(parsed.value, conditions);
  return missing.length === 0
    ? parsed
    : R.failure(
        `No rule is named ${missing.join(", ")}. Use the name of a rule below, or add a rule and use its name.`,
      );
}

export const sameFormula = (a: FormulaNode, b: FormulaNode) =>
  JSON.stringify(a) === JSON.stringify(b);

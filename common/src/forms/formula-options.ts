import { R, type Result } from "../result";
import {
  collectVariableResolutionFields,
  type AnyField,
  type FormSchema,
  type ListSubField,
  type MultiSelectField,
  type SelectField,
} from "./form-schema";
import { withStepBudget } from "./formula-step-budget";
import {
  prepareFormula,
  type VariableResolutionContext,
} from "./variable-evaluation";
import {
  evaluateVariableExpression,
  isExprArray,
  isExprRecord,
  type ExprNode,
  type ExprValue,
} from "./variable-expression";
import { variableSourceFormIds, type OptionsFormula } from "./variables";

export type ChoiceOption = { label: string; value: string };

type ChoiceField = SelectField | MultiSelectField;
export type FormulaChoiceField = ChoiceField & {
  optionsFormula: OptionsFormula;
};

export type FormulaFieldEntry = {
  field: FormulaChoiceField;
  /** Set for a list sub-field, whose options every row shares. */
  listId?: string;
};

function isFormulaChoiceField(
  field: AnyField | ListSubField,
): field is FormulaChoiceField {
  return (
    (field.kind === "select" || field.kind === "multiselect") &&
    field.optionsFormula !== undefined
  );
}

export function collectOptionsFormulaFields(
  schema: FormSchema,
): FormulaFieldEntry[] {
  return collectVariableResolutionFields(schema).flatMap(
    (field): FormulaFieldEntry[] => {
      if (isFormulaChoiceField(field)) return [{ field }];
      if (field.kind !== "list") return [];
      return (field.fields ?? []).flatMap((sub) =>
        isFormulaChoiceField(sub) ? [{ field: sub, listId: field.id }] : [],
      );
    },
  );
}

/** Every form a variable or options formula reads, ascending. */
export function formulaSourceFormIds(schema: FormSchema): number[] {
  return variableSourceFormIds([
    ...(schema.variables ?? []),
    ...collectOptionsFormulaFields(schema).map(
      ({ field }) => field.optionsFormula,
    ),
  ]);
}

function dependencies(
  entry: FormulaFieldEntry,
  entries: readonly FormulaFieldEntry[],
): string[] {
  return Object.values(entry.field.optionsFormula.inputs).flatMap((input) => {
    switch (input.kind) {
      case "sourceField":
      case "sourceList":
      case "aggregate":
        return [];
      case "list":
        return entries
          .filter(({ listId }) => listId === input.fieldId)
          .map(({ field }) => field.id);
      case "field":
        return entries
          .filter(
            ({ field, listId }) =>
              field.id === input.fieldId && listId === undefined,
          )
          .map(({ field }) => field.id);
      default:
        throw new Error(`unknown input kind: ${input satisfies never}`);
    }
  });
}

/**
 * The formula fields in an order where each follows those its formula reads,
 * or the ids of a cycle.
 */
export function optionsFormulaOrder(
  entries: readonly FormulaFieldEntry[],
): Result<FormulaFieldEntry[], string[]> {
  const byId = new Map(entries.map((entry) => [entry.field.id, entry]));
  const ordered: FormulaFieldEntry[] = [];
  const done = new Set<string>();
  const path: string[] = [];
  const visit = (id: string): string[] | undefined => {
    if (done.has(id)) return undefined;
    const start = path.indexOf(id);
    if (start !== -1) return [...path.slice(start), id];
    const entry = byId.get(id);
    if (entry === undefined) return undefined;
    path.push(id);
    for (const dependency of dependencies(entry, entries)) {
      const cycle = visit(dependency);
      if (cycle !== undefined) return cycle;
    }
    path.pop();
    done.add(id);
    ordered.push(entry);
    return undefined;
  };
  for (const entry of entries) {
    const cycle = visit(entry.field.id);
    if (cycle !== undefined) return R.failure(cycle);
  }
  return R.success(ordered);
}

export function optionsCycleMessage(cycle: readonly string[]): string {
  return `Options formulas read each other's answers in a loop: ${cycle.join(" → ")}`;
}

export function optionsShapeMessage(described: string): string {
  return `An options formula has to give a list of { label, value } records, and this one gives ${described}`;
}

function describeResult(value: ExprValue): string {
  if (value === undefined) return "nothing";
  if (isExprArray(value)) return "a list";
  if (isExprRecord(value)) return "a record";
  return typeof value === "string" ? "text" : `a ${typeof value}`;
}

/**
 * The first choice with each value, in order. Case matters, and choices with
 * equal labels but different values stay apart.
 */
export function readOptionsResult(
  value: ExprValue,
): Result<ChoiceOption[], string> {
  if (!isExprArray(value)) {
    return R.failure(
      `${optionsShapeMessage(describeResult(value))}${value === undefined ? ". Add ?? [] where an answer can be missing" : ""}`,
    );
  }
  const seen = new Set<string>();
  const options: ChoiceOption[] = [];
  for (const [index, item] of value.entries()) {
    if (
      !isExprRecord(item) ||
      typeof item.label !== "string" ||
      typeof item.value !== "string" ||
      item.value === ""
    ) {
      return R.failure(
        `Item ${index + 1} of the options is ${describeResult(item)}, not a { label, value } record with a non-empty text value`,
      );
    }
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    options.push({ label: item.label, value: item.value });
  }
  return R.success(options);
}

export function evaluateOptionsExpression(
  node: ExprNode,
  inputs: ReadonlyMap<string, ExprValue>,
): Result<ChoiceOption[], string> {
  const evaluated = R.fromThrowable(
    () => withStepBudget(() => evaluateVariableExpression(node, inputs)),
    (error) => R.toError(error).message,
  );
  return R.flatMap(evaluated, readOptionsResult);
}

export function evaluateOptionsFormula(
  formula: OptionsFormula,
  context: VariableResolutionContext,
): Result<ChoiceOption[], string> {
  return R.flatMap(prepareFormula(formula, context), ({ node, inputs }) =>
    evaluateOptionsExpression(node, inputs),
  );
}

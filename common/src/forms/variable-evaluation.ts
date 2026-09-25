import { R, type Result } from "../result";
import type { FormValue } from "./form-schema";
import { withStepBudget } from "./formula-step-budget";
import { isListRow } from "./list-rows";
import {
  aggregateSourceKey,
  type VariableAggregateCounts,
} from "./variable-aggregates";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  type ExprNode,
  type ExprRecord,
  type ExprValue,
} from "./variable-expression";
import {
  isListInput,
  type VariableAggregateInput,
  type VariableFieldInput,
  type VariableInput,
  type VariableListInput,
  type VariableSourceInput,
} from "./variable-inputs";
import {
  formatVariableValue,
  formValueToExprValue,
  isKnownFieldKind,
  readableListSubFields,
  variableInputMode,
  type Formula,
  type FormVariable,
  type VariableInputField,
  type VariableInputFields,
} from "./variables";

export type VariableSourceResponse = {
  id: number;
  answers: Readonly<Record<string, FormValue>>;
  /** The fields of the form version this response was submitted against. */
  fields: VariableInputFields;
};

export type VariableSourceHistory = {
  /** The source form's current fields, which the formula was typed against. */
  fields: VariableInputFields;
  /** Submitted responses, oldest first. */
  responses: readonly VariableSourceResponse[];
};

export type VariableResolutionContext = {
  answers: Readonly<Record<string, FormValue>>;
  fields: VariableInputFields;
  /**
   * Keyed by source form id. An input reading a form missing here fails, so a
   * caller that never loaded the history cannot pass it off as no submissions.
   */
  sources?: ReadonlyMap<number, VariableSourceHistory>;
  /**
   * Keyed by `aggregateSourceKey`. An input whose counts are missing here
   * fails, so a caller that never loaded them cannot pass them off as zeros.
   */
  aggregates?: ReadonlyMap<string, VariableAggregateCounts>;
};

type LocalAnswers = Pick<VariableResolutionContext, "answers" | "fields">;

function resolveListInput(
  input: VariableListInput,
  context: LocalAnswers,
): Result<ExprValue, string> {
  const field = context.fields.get(input.fieldId);
  if (field?.kind !== "list") return R.success(undefined);
  const named = (field.fields ?? []).filter((sub) =>
    Object.hasOwn(input.properties, sub.id),
  );
  const unknown = named.find((sub) => !isKnownFieldKind(sub.kind));
  if (unknown !== undefined) {
    return R.failure(`Unknown field kind: ${unknown.kind}`);
  }
  const rows = context.answers[input.fieldId];
  if (!Array.isArray(rows)) return R.success([]);
  const subFields = readableListSubFields(named);
  return R.success(
    rows.map((row: unknown): ExprRecord => {
      const cells = isListRow(row) ? row : {};
      return Object.fromEntries(
        subFields.map((sub) => [
          input.properties[sub.id],
          formValueToExprValue(cells[sub.id], sub),
        ]),
      );
    }),
  );
}

function resolveFieldInput(
  input: VariableFieldInput,
  context: LocalAnswers,
): Result<ExprValue, string> {
  const field = context.fields.get(input.fieldId);
  if (field === undefined) return R.success(undefined);
  if (!isKnownFieldKind(field.kind)) {
    return R.failure(`Unknown field kind: ${field.kind}`);
  }
  return R.success(formValueToExprValue(context.answers[input.fieldId], field));
}

// Keyed by sub-field id, with "" for the question itself.
function readModes(
  input: VariableSourceInput,
  field: VariableInputField | undefined,
): Map<string, string> | undefined {
  if (field === undefined || !isKnownFieldKind(field.kind)) return undefined;
  const modes = new Map<string, string>([
    ["", field.kind === "list" ? "list" : variableInputMode(field.kind)],
  ]);
  if (isListInput(input) && field.kind === "list") {
    for (const sub of field.fields ?? []) {
      if (
        Object.hasOwn(input.properties, sub.id) &&
        isKnownFieldKind(sub.kind)
      ) {
        modes.set(sub.id, variableInputMode(sub.kind));
      }
    }
  }
  return modes;
}

/**
 * A snapshot that reads a question as a different type than the source form
 * does now would hand the formula a value it wasn't typed for.
 */
function typeChangeError(params: {
  input: VariableSourceInput;
  current: VariableInputField | undefined;
  submitted: VariableInputField | undefined;
}): string | undefined {
  const { input, current, submitted } = params;
  const now = readModes(input, current);
  const then = readModes(input, submitted);
  if (now === undefined || then === undefined) return undefined;
  for (const [key, mode] of then) {
    const currentMode = now.get(key);
    if (currentMode !== undefined && currentMode !== mode) {
      return `Question "${input.fieldId}" of form ${input.sourceFormId} has a different type in an earlier version of the form, which formulas don't support`;
    }
  }
  return undefined;
}

function resolveSourceInput(
  input: VariableSourceInput,
  sources: VariableResolutionContext["sources"],
): Result<ExprValue, string> {
  const source = sources?.get(input.sourceFormId);
  if (source === undefined) {
    return R.failure(`Answers from form ${input.sourceFormId} are not loaded`);
  }
  const values: ExprValue[] = [];
  for (const response of source.responses) {
    const error = typeChangeError({
      input,
      current: source.fields.get(input.fieldId),
      submitted: response.fields.get(input.fieldId),
    });
    if (error !== undefined) return R.failure(error);
    const value = isListInput(input)
      ? resolveListInput(input, response)
      : resolveFieldInput(input, response);
    if (!value.ok) return value;
    values.push(value.value ?? (isListInput(input) ? [] : undefined));
  }
  return R.success(values);
}

function resolveAggregateInput(
  input: VariableAggregateInput,
  aggregates: VariableResolutionContext["aggregates"],
): Result<ExprValue, string> {
  const counts = aggregates?.get(aggregateSourceKey(input));
  return counts === undefined
    ? R.failure(
        `Counts for question "${input.fieldId}" of form ${input.sourceFormId} are not loaded`,
      )
    : R.success(counts);
}

function resolveInput(
  input: VariableInput,
  context: VariableResolutionContext,
): Result<ExprValue, string> {
  const { kind } = input;
  switch (kind) {
    case "field":
      return resolveFieldInput(input, context);
    case "list":
      return resolveListInput(input, context);
    case "sourceField":
    case "sourceList":
      return resolveSourceInput(input, context.sources);
    case "aggregate":
      return resolveAggregateInput(input, context.aggregates);
    default:
      // A newer admin can save an input kind this build predates.
      return R.failure(`Unknown input kind: ${kind satisfies never}`);
  }
}

/** Evaluates and formats under one step budget, and fails past it. */
export function evaluateVariableText(
  node: ExprNode,
  inputs: ReadonlyMap<string, ExprValue>,
): Result<string, string> {
  return R.fromThrowable(
    () =>
      withStepBudget(() =>
        formatVariableValue(evaluateVariableExpression(node, inputs)),
      ),
    (error) => R.toError(error).message,
  );
}

export function prepareFormula(
  formula: Formula,
  context: VariableResolutionContext,
): Result<{ node: ExprNode; inputs: Map<string, ExprValue> }, string> {
  const compiled = compileVariableExpression(
    formula.formula,
    new Set(Object.keys(formula.inputs)),
  );
  if (!compiled.ok) return compiled;

  const inputs = new Map<string, ExprValue>();
  for (const [name, input] of Object.entries(formula.inputs)) {
    const value = resolveInput(input, context);
    if (!value.ok) return value;
    inputs.set(name, value.value);
  }
  return R.success({ node: compiled.value, inputs });
}

export function evaluateVariable(
  variable: FormVariable,
  context: VariableResolutionContext,
): Result<string, string> {
  return R.flatMap(prepareFormula(variable, context), ({ node, inputs }) =>
    evaluateVariableText(node, inputs),
  );
}

export function resolveVariableValues(
  variables: readonly FormVariable[] | undefined,
  context: VariableResolutionContext,
): Result<Map<string, string>, string> {
  const values = new Map<string, string>();
  for (const variable of variables ?? []) {
    const result = evaluateVariable(variable, context);
    if (!result.ok) return R.failure(`#{${variable.name}}: ${result.error}`);
    values.set(variable.name, result.value);
  }
  return R.success(values);
}

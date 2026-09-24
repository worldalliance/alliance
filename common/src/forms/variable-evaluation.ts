import { R, type Result } from "../result";
import type { FormValue } from "./form-schema";
import { withStepBudget } from "./formula-step-budget";
import { isListRow } from "./list-rows";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  type ExprNode,
  type ExprRecord,
  type ExprValue,
} from "./variable-expression";
import {
  formatVariableValue,
  formValueToExprValue,
  isKnownFieldKind,
  readableListSubFields,
  type FormVariable,
  type VariableInput,
  type VariableInputField,
  type VariableListInput,
} from "./variables";

export type VariableResolutionContext = {
  answers: Record<string, FormValue>;
  fields: ReadonlyMap<string, VariableInputField>;
};

function resolveListInput(
  input: VariableListInput,
  context: VariableResolutionContext,
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
  input: Extract<VariableInput, { kind: "field" }>,
  context: VariableResolutionContext,
): Result<ExprValue, string> {
  const field = context.fields.get(input.fieldId);
  if (field === undefined) return R.success(undefined);
  if (!isKnownFieldKind(field.kind)) {
    return R.failure(`Unknown field kind: ${field.kind}`);
  }
  return R.success(formValueToExprValue(context.answers[input.fieldId], field));
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

export function evaluateVariable(
  variable: FormVariable,
  context: VariableResolutionContext,
): Result<string, string> {
  const compiled = compileVariableExpression(
    variable.formula,
    new Set(Object.keys(variable.inputs)),
  );
  if (!compiled.ok) return compiled;

  const inputs = new Map<string, ExprValue>();
  for (const [name, input] of Object.entries(variable.inputs)) {
    const value = resolveInput(input, context);
    if (!value.ok) return value;
    inputs.set(name, value.value);
  }

  return evaluateVariableText(compiled.value, inputs);
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

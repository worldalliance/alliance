// Formula inputs use aliases because field IDs are not guaranteed to be valid identifiers.

import z from "zod";
import { R, type Result } from "../result";
import type { FieldKind, FormValue } from "./form-schema";
import {
  compileVariableExpression,
  evaluateVariableExpression,
  formatExprNumber,
  type ExprValue,
} from "./variable-expression";

/**
 * Names appear only inside `#{…}`, never as an identifier in a formula (the
 * formula sees input names), so a leading digit is fine. Whitespace and the
 * delimiter characters are excluded to keep `#{…}` unambiguous and to make a
 * mistyped reference fail visibly rather than half-match.
 */
export const VARIABLE_NAME_REGEX = /^[A-Za-z0-9_-]+$/;

const DISALLOWED_VARIABLE_NAME_CHARS = /[^A-Za-z0-9_-]/g;

export function sanitizeVariableName(input: string): string {
  return input.replace(DISALLOWED_VARIABLE_NAME_CHARS, "");
}

export const VARIABLE_REFERENCE_OPEN = "#{";

/**
 * A fresh matcher each call. A shared `/g` regex carries `lastIndex` between
 * callers — `matchAll` reads it — so one `test()` elsewhere would silently make
 * the next scan skip the start of its string.
 */
export function variableReferencePattern(): RegExp {
  return /#\{([A-Za-z0-9_-]+)\}/g;
}

export const VARIABLE_INPUT_NAME_PREFIX = "input";

/**
 * Input names are written verbatim into the formula, so unlike variable names
 * they must be parseable as identifiers — a name outside this shape could never
 * be referenced by the formula that depends on it.
 */
export const VARIABLE_INPUT_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const variableFieldInputSchema = z.strictObject({
  kind: z.literal("field"),
  fieldId: z.string(),
});

export const variableInputSchema = z.discriminatedUnion("kind", [
  variableFieldInputSchema,
]);
export type VariableInput = z.infer<typeof variableInputSchema>;
export type VariableInputKind = VariableInput["kind"];

export const formVariableSchema = z.strictObject({
  name: z.string().regex(VARIABLE_NAME_REGEX),
  inputs: z.record(
    z.string().regex(VARIABLE_INPUT_NAME_REGEX),
    variableInputSchema,
  ),
  formula: z.string(),
});
export type FormVariable = z.infer<typeof formVariableSchema>;

export function variableInputNameForIndex(index: number): string {
  return `${VARIABLE_INPUT_NAME_PREFIX}${index + 1}`;
}

// The variable-input contract does not define checkbox-to-number conversion.
export const FIELD_KIND_USABLE_AS_VARIABLE_INPUT: Record<FieldKind, boolean> = {
  number: true,
  range: true,
  checkbox: false,
  text: false,
  textarea: false,
  email: false,
  phone: false,
  radio: false,
  select: false,
  multiselect: false,
  date: false,
  time: false,
  timezone: false,
  city: false,
  file: false,
  contract: false,
  custom: false,
  list: false,
  ranking: false,
};

export function collectVariableReferences(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(variableReferencePattern())) {
    names.push(match[1]);
  }
  return names;
}

export function textHasVariableReference(text: string): boolean {
  return variableReferencePattern().test(text);
}

/**
 * Unknown references remain unchanged so an invalid or incompatible schema
 * exposes the token instead of silently blanking it.
 */
export function interpolateVariables(
  text: string,
  values: ReadonlyMap<string, string>,
): string {
  if (!text.includes(VARIABLE_REFERENCE_OPEN)) return text;
  return text.replace(variableReferencePattern(), (whole, name: string) => {
    const value = values.get(name);
    return value === undefined ? whole : value;
  });
}

/**
 * Coerce a stored answer into something a formula can use. Numeric strings
 * become numbers (number fields round-trip through text inputs), an unanswered
 * or blank field becomes `undefined` so `??` can supply a default, and values
 * with no scalar reading (city, list, multi-select) become `undefined` rather
 * than a misleading stand-in.
 */
export function formValueToExprValue(value: unknown): ExprValue {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : trimmed;
  }
  return undefined;
}

export type VariableResolutionContext = {
  answers: Record<string, FormValue>;
};

const INPUT_RESOLVERS: {
  [K in VariableInputKind]: (
    input: Extract<VariableInput, { kind: K }>,
    context: VariableResolutionContext,
  ) => ExprValue;
} = {
  field: (input, context) =>
    formValueToExprValue(context.answers[input.fieldId]),
};

function resolveInput(
  input: VariableInput,
  context: VariableResolutionContext,
): ExprValue {
  // A table rather than a switch: with only one input kind there is nothing for
  // a `satisfies never` default to narrow against, whereas a missing entry here
  // is a compile error the moment a kind is added.
  return INPUT_RESOLVERS[input.kind](input, context);
}

/**
 * Formats a computed value for interpolation. Undefined and non-finite values
 * render as empty; `??` can provide a default for an undefined input.
 */
export function formatVariableValue(value: ExprValue): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return formatExprNumber(value) ?? "";
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
    inputs.set(name, resolveInput(input, context));
  }

  const value = R.fromThrowable(() =>
    evaluateVariableExpression(compiled.value, inputs),
  );
  if (!value.ok) return R.failure(value.error.message);

  return R.success(formatVariableValue(value.value));
}

/** Evaluation failures render as empty rather than aborting the form. */
export function resolveVariableValues(
  variables: readonly FormVariable[] | undefined,
  context: VariableResolutionContext,
): Map<string, string> {
  const values = new Map<string, string>();
  for (const variable of variables ?? []) {
    const result = evaluateVariable(variable, context);
    values.set(variable.name, result.ok ? result.value : "");
  }
  return values;
}

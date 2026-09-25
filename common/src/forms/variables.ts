// Formula inputs use aliases because field IDs are not guaranteed to be valid identifiers.

import { camelCase, deburr, isEqual } from "es-toolkit";
import z from "zod";
import { formatCityValue, parseCityValue } from "./city";
import type { FieldKind, ListSubField } from "./form-schema";
import { AGGREGATE_INPUT_TYPE } from "./variable-aggregates";
import {
  exprValueToText,
  FORBIDDEN_PROPERTIES,
  type ExprRecord,
  type ExprValue,
} from "./variable-expression";
import {
  inputSourceFormId,
  isListInput,
  isSourceInput,
  VARIABLE_INPUT_NAME_REGEX,
  variableInputSchema,
  type VariableInput,
  type VariableListInput,
} from "./variable-inputs";

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

export enum VariableInputMode {
  Number = "number",
  Text = "text",
  Boolean = "boolean",
  /** One `{ label, value }` record. */
  Choice = "choice",
  /** A list of `{ label, value }` records, in the order the answer holds. */
  Choices = "choices",
  /** The city record, plus a `label` reading "Paris, Île-de-France, France". */
  City = "city",
  None = "none",
}

export const FIELD_KIND_VARIABLE_INPUT_MODE: Record<
  FieldKind,
  VariableInputMode
> = {
  number: VariableInputMode.Number,
  range: VariableInputMode.Number,
  text: VariableInputMode.Text,
  textarea: VariableInputMode.Text,
  email: VariableInputMode.Text,
  phone: VariableInputMode.Text,
  date: VariableInputMode.Text,
  time: VariableInputMode.Text,
  timezone: VariableInputMode.Text,
  checkbox: VariableInputMode.Boolean,
  contract: VariableInputMode.Boolean,
  radio: VariableInputMode.Choice,
  select: VariableInputMode.Choice,
  multiselect: VariableInputMode.Choices,
  ranking: VariableInputMode.Choices,
  city: VariableInputMode.City,
  // A list is read through a `list` input, one record per row. A file holds an
  // upload id and a custom component stores whatever it likes: neither has a
  // reading a formula could put in a sentence.
  list: VariableInputMode.None,
  file: VariableInputMode.None,
  custom: VariableInputMode.None,
};

// A newer admin can save a field kind this build predates.
export function isKnownFieldKind(kind: string): kind is FieldKind {
  return Object.hasOwn(FIELD_KIND_VARIABLE_INPUT_MODE, kind);
}

export function variableInputMode(kind: FieldKind): VariableInputMode {
  return isKnownFieldKind(kind)
    ? FIELD_KIND_VARIABLE_INPUT_MODE[kind]
    : VariableInputMode.None;
}

export function isFieldKindReadableByFieldInput(kind: FieldKind): boolean {
  return variableInputMode(kind) !== VariableInputMode.None;
}

export type VariableInputField = {
  kind: FieldKind;
  options?: readonly { label: string; value: string }[];
  fields?: readonly ListSubField[];
};

export type VariableInputFields = ReadonlyMap<string, VariableInputField>;

export type VariableFieldScope = {
  fields: VariableInputFields;
  sourceFields: ReadonlyMap<number, VariableInputFields>;
};

function formIdsRead(
  variables: readonly FormVariable[] | undefined,
  include: (input: VariableInput) => boolean,
): number[] {
  const ids = new Set<number>();
  for (const variable of variables ?? []) {
    for (const input of Object.values(variable.inputs)) {
      const sourceFormId = inputSourceFormId(input);
      if (sourceFormId !== undefined && include(input)) ids.add(sourceFormId);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Every stored form these variables read, aggregates included. */
export function variableSourceFormIds(
  variables: readonly FormVariable[] | undefined,
): number[] {
  return formIdsRead(variables, () => true);
}

/** The forms whose submitted history these variables read. */
export function variableHistoryFormIds(
  variables: readonly FormVariable[] | undefined,
): number[] {
  return formIdsRead(variables, isSourceInput);
}

export function readsSourceForm(variable: FormVariable): boolean {
  return Object.values(variable.inputs).some(
    (input) => inputSourceFormId(input) !== undefined,
  );
}

function inputFields(
  input: VariableInput,
  scope: VariableFieldScope,
): VariableInputFields | undefined {
  const sourceFormId = inputSourceFormId(input);
  return sourceFormId === undefined
    ? scope.fields
    : scope.sourceFields.get(sourceFormId);
}

export function readableListSubFields(
  subFields: readonly ListSubField[],
): ListSubField[] {
  return subFields.filter((sub) => isFieldKindReadableByFieldInput(sub.kind));
}

const FALLBACK_PROPERTY_NAME = "field";

function propertyNameFromLabel(label: string | null): string {
  const name = camelCase(
    deburr(label ?? "")
      .replace(/['’]/g, "")
      .replace(/[^A-Za-z0-9]+/g, " "),
  );
  if (!name) return FALLBACK_PROPERTY_NAME;
  return /^[0-9]/.test(name) ? `${FALLBACK_PROPERTY_NAME}${name}` : name;
}

/**
 * Keeps each readable sub-field's existing name, names the rest from their
 * labels, and drops names for sub-fields that are gone or unreadable. Existing
 * names never change, so a relabeled sub-field cannot break a formula. A name
 * for a sub-field of a kind this build doesn't know stays, since a newer build
 * may read it.
 */
export function syncListInputProperties(
  properties: Readonly<Record<string, string>>,
  subFields: readonly ListSubField[],
): Record<string, string> {
  const kept = subFields.filter(
    (sub) =>
      Object.hasOwn(properties, sub.id) &&
      (!isKnownFieldKind(sub.kind) ||
        isFieldKindReadableByFieldInput(sub.kind)),
  );
  const taken = new Set<string>(FORBIDDEN_PROPERTIES);
  for (const sub of kept) taken.add(properties[sub.id]);
  const synced: Record<string, string> = {};
  for (const sub of kept) synced[sub.id] = properties[sub.id];
  for (const sub of readableListSubFields(subFields)) {
    if (Object.hasOwn(synced, sub.id)) continue;
    const base = propertyNameFromLabel(sub.label);
    let name = base;
    for (let n = 2; taken.has(name); n += 1) name = `${base}${n}`;
    taken.add(name);
    synced[sub.id] = name;
  }
  return synced;
}

export function listInputPropertyErrors(params: {
  inputName: string;
  input: VariableListInput;
  subFields: readonly ListSubField[];
}): string[] {
  const { inputName, input, subFields } = params;
  const errors: string[] = [];
  const readableIds = new Set(
    readableListSubFields(subFields).map((sub) => sub.id),
  );
  for (const id of readableIds) {
    if (!Object.hasOwn(input.properties, id)) {
      errors.push(
        `Input "${inputName}" has no property name for sub-field "${id}"`,
      );
    }
  }
  const unknownKinds = new Map(
    subFields
      .filter((sub) => !isKnownFieldKind(sub.kind))
      .map((sub) => [sub.id, sub.kind]),
  );
  const seen = new Set<string>();
  for (const [id, name] of Object.entries(input.properties)) {
    const unknownKind = unknownKinds.get(id);
    if (unknownKind !== undefined) {
      errors.push(
        `Input "${inputName}" reads sub-field "${id}", whose kind (${unknownKind}) this build doesn't know. Reload the page`,
      );
    } else if (!readableIds.has(id)) {
      errors.push(
        `Input "${inputName}" names property "${name}" for "${id}", which is not a readable sub-field of list "${input.fieldId}"`,
      );
    }
    if (!VARIABLE_INPUT_NAME_REGEX.test(name)) {
      errors.push(
        `Input "${inputName}" property "${name}" has to start with a letter or underscore and use only letters, numbers and underscores`,
      );
    }
    if (FORBIDDEN_PROPERTIES.has(name)) {
      errors.push(
        `Input "${inputName}" cannot use "${name}" as a property name`,
      );
    }
    if (seen.has(name)) {
      errors.push(
        `Input "${inputName}" uses property name "${name}" more than once`,
      );
    }
    seen.add(name);
  }
  return errors;
}

/**
 * Brings every list input in line with its list's current sub-fields. An input
 * whose source form's fields aren't in `scope` stays as it is.
 */
export function syncVariableListInputs(
  variables: readonly FormVariable[],
  scope: VariableFieldScope,
): FormVariable[] {
  return variables.map((variable) => {
    let changed = false;
    const inputs = Object.fromEntries(
      Object.entries(variable.inputs).map(([name, input]) => {
        const field = inputFields(input, scope)?.get(input.fieldId);
        if (!isListInput(input) || field?.kind !== "list") {
          return [name, input];
        }
        const properties = syncListInputProperties(
          input.properties,
          field.fields ?? [],
        );
        if (isEqual(properties, input.properties)) {
          return [name, input];
        }
        changed = true;
        return [name, { ...input, properties }];
      }),
    );
    return changed ? { ...variable, inputs } : variable;
  });
}

// Keep these as strings so form renderers can import this module without
// pulling in TypeScript. `variable-formula-check.ts` writes them into its
// virtual source.
const CHOICE_TYPE = "{ label: string; value: string }";

const CITY_TYPE =
  "{ id: number; name: string; admin1: string; countryCode: string; countryName: string; label: string }";

export const VARIABLE_INPUT_TYPE: Record<VariableInputMode, string> = {
  [VariableInputMode.Number]: "number",
  [VariableInputMode.Text]: "string",
  [VariableInputMode.Boolean]: "boolean",
  [VariableInputMode.Choice]: CHOICE_TYPE,
  [VariableInputMode.Choices]: `${CHOICE_TYPE}[]`,
  [VariableInputMode.City]: CITY_TYPE,
  [VariableInputMode.None]: "undefined",
};

/**
 * All fields are optional. Missing fields use `any` so validation reports only
 * the missing-field error.
 */
export function variableInputType(kind: FieldKind | undefined): string {
  return kind === undefined
    ? "any"
    : `${VARIABLE_INPUT_TYPE[FIELD_KIND_VARIABLE_INPUT_MODE[kind]]} | undefined`;
}

function listInputType(
  input: VariableListInput,
  field: VariableInputField | undefined,
): string {
  if (field?.kind !== "list") return "any";
  // Invalid and repeated names stay out of the type and an unknown kind reads as
  // `any`, so validation reports each once instead of the type checker adding
  // a syntax, duplicate or missing-property error.
  const properties = new Map<string, string>();
  for (const sub of field.fields ?? []) {
    const name = input.properties[sub.id];
    if (
      !Object.hasOwn(input.properties, sub.id) ||
      !VARIABLE_INPUT_NAME_REGEX.test(name) ||
      properties.has(name)
    ) {
      continue;
    }
    if (!isKnownFieldKind(sub.kind)) {
      properties.set(name, "any");
    } else if (isFieldKindReadableByFieldInput(sub.kind)) {
      properties.set(name, variableInputType(sub.kind));
    }
  }
  const members = [...properties].map(([name, type]) => `${name}: ${type}`);
  return `{ ${members.join("; ")} }[]`;
}

function inputType(
  input: VariableInput,
  field: VariableInputField | undefined,
): string {
  switch (input.kind) {
    case "field":
    case "sourceField":
      return variableInputType(
        field !== undefined && isFieldKindReadableByFieldInput(field.kind)
          ? field.kind
          : undefined,
      );
    case "list":
    case "sourceList":
      return listInputType(input, field);
    case "aggregate":
      return field?.kind === "multiselect" ? AGGREGATE_INPUT_TYPE : "any";
    default:
      input satisfies never;
      return variableInputType(undefined);
  }
}

/** An input reading submitted history gets one element per submission. */
export function variableTypeEnv(
  variable: FormVariable,
  scope: VariableFieldScope,
): ReadonlyMap<string, string> {
  return new Map(
    Object.entries(variable.inputs).map(([name, input]) => {
      const fields = inputFields(input, scope);
      if (fields === undefined) return [name, variableInputType(undefined)];
      const type = inputType(input, fields.get(input.fieldId));
      return [name, isSourceInput(input) ? `(${type})[]` : type];
    }),
  );
}

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

function numberFromAnswer(value: unknown): ExprValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  // Number fields round-trip through text inputs, so a numeric answer often
  // arrives as a string.
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) ? asNumber : undefined;
}

function textFromAnswer(value: unknown): ExprValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function booleanFromAnswer(value: unknown): ExprValue {
  return typeof value === "boolean" ? value : undefined;
}

// Use the stored value as the label when an option was removed.
function choiceRecord(
  value: string,
  field: VariableInputField,
): ExprRecord | undefined {
  if (!value) return undefined;
  const option = field.options?.find((candidate) => candidate.value === value);
  return { label: option?.label ?? value, value };
}

function choiceFromAnswer(
  value: unknown,
  field: VariableInputField,
): ExprValue {
  return typeof value === "string" ? choiceRecord(value, field) : undefined;
}

function choicesFromAnswer(
  value: unknown,
  field: VariableInputField,
): ExprValue {
  if (!Array.isArray(value)) return undefined;
  const records = value.flatMap((item: unknown) => {
    const record =
      typeof item === "string" ? choiceRecord(item, field) : undefined;
    return record ? [record] : [];
  });
  // Nothing selected reads the same as nothing answered, so `??` can step in.
  return records.length > 0 ? records : undefined;
}

function cityFromAnswer(value: unknown): ExprValue {
  const city = parseCityValue(value);
  return city === undefined
    ? undefined
    : { ...city, label: formatCityValue(city) };
}

const ANSWER_READERS: Record<
  VariableInputMode,
  (value: unknown, field: VariableInputField) => ExprValue
> = {
  [VariableInputMode.Number]: numberFromAnswer,
  [VariableInputMode.Text]: textFromAnswer,
  [VariableInputMode.Boolean]: booleanFromAnswer,
  [VariableInputMode.Choice]: choiceFromAnswer,
  [VariableInputMode.Choices]: choicesFromAnswer,
  [VariableInputMode.City]: cityFromAnswer,
  [VariableInputMode.None]: () => undefined,
};

/**
 * Converts a stored answer according to its field kind. Unanswered and blank
 * fields become `undefined` so `??` can supply a default.
 */
export function formValueToExprValue(
  value: unknown,
  field: VariableInputField,
): ExprValue {
  if (value === undefined || value === null) return undefined;
  return ANSWER_READERS[variableInputMode(field.kind)](value, field);
}

export function formatVariableValue(value: ExprValue): string {
  return exprValueToText(value) ?? "";
}

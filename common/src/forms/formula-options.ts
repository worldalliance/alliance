import { omit } from "es-toolkit";
import z from "zod";
import { R, type Result } from "../result";
import {
  asCards,
  collectVariableResolutionFields,
  isListRow,
  isQuestionField,
  mapPageItems,
  variableInputFieldsById,
  type AnyField,
  type FormSchema,
  type FormValue,
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

export const FORMULA_SOURCES_CHANGED =
  "Your answers to another form changed since you opened this one. Reload it to see its current options.";

export type ChoiceOption = { label: string; value: string };

type ChoiceField = SelectField | MultiSelectField;
export type FormulaChoiceField = ChoiceField & {
  optionsFormula: OptionsFormula;
};

/** Keyed by field id, list sub-fields included. */
export type ResolvedOptions = ReadonlyMap<string, readonly ChoiceOption[]>;

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

export function optionsFormulaSourceFormIds(schema: FormSchema): number[] {
  return variableSourceFormIds(
    collectOptionsFormulaFields(schema).map(
      ({ field }) => field.optionsFormula,
    ),
  );
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

function mapFormulaFields<T extends AnyField | ListSubField>(
  field: T,
  map: (field: FormulaChoiceField) => ChoiceField,
): T {
  if (isFormulaChoiceField(field)) return { ...field, ...map(field) };
  if (field.kind !== "list") return field;
  const fields = field.fields.map((sub) => mapFormulaFields(sub, map));
  return fields.every((sub, index) => sub === field.fields[index])
    ? field
    : { ...field, fields };
}

function mapSchemaFormulaFields(
  schema: FormSchema,
  map: (field: FormulaChoiceField) => ChoiceField,
): FormSchema {
  return {
    ...schema,
    pages: schema.pages.map((page) => ({
      ...page,
      fields: mapPageItems(page.fields, (item) =>
        isQuestionField(item) ? mapFormulaFields(item, map) : item,
      ),
    })),
  };
}

const resolvedOptionsField =
  (options: ResolvedOptions) =>
  (field: FormulaChoiceField): ChoiceField => ({
    ...field,
    options: [...(options.get(field.id) ?? [])],
  });

/** A choice field reading a formula gets `options`'s; other fields are kept. */
export function withResolvedOptions<T extends AnyField | ListSubField>(
  field: T,
  options: ResolvedOptions,
): T {
  return mapFormulaFields(field, resolvedOptionsField(options));
}

export function schemaWithResolvedOptions(
  schema: FormSchema,
  options: ResolvedOptions,
): FormSchema {
  return mapSchemaFormulaFields(schema, resolvedOptionsField(options));
}

const savedChoicesField =
  (choices: FormulaChoices) =>
  (field: FormulaChoiceField): ChoiceField => ({
    ...field,
    options: choices[field.id] ?? [],
    optionsFormula: undefined,
  });

/**
 * A saved response's form, each options formula replaced by fixed options
 * holding the choices the response saved, so it reads without the formula's
 * inputs.
 */
export function schemaWithSavedChoices(
  schema: FormSchema,
  choices: FormulaChoices,
): FormSchema {
  return mapSchemaFormulaFields(schema, savedChoicesField(choices));
}

const REMOVE = Symbol("remove");

function availableChoice(
  value: FormValue | undefined,
  field: ChoiceField,
  available: ReadonlySet<string>,
): FormValue | undefined | typeof REMOVE {
  // A cleared select stores "", which no formula can offer.
  if (value == null || value === "") return value;
  switch (field.kind) {
    case "select":
      return typeof value === "string" && available.has(value) ? value : REMOVE;
    case "multiselect": {
      if (!Array.isArray(value)) return REMOVE;
      const kept = value.filter(
        (item): item is string =>
          typeof item === "string" && available.has(item),
      );
      if (kept.length === value.length) return value;
      return kept.length > 0 ? kept : REMOVE;
    }
    default:
      throw new Error(`unknown choice field kind: ${field satisfies never}`);
  }
}

function keepAvailable(params: {
  answers: Record<string, FormValue>;
  entry: FormulaFieldEntry;
  options: readonly ChoiceOption[];
}): Record<string, FormValue> {
  const { answers, entry, options } = params;
  const available = new Set(options.map((option) => option.value));
  const { field, listId } = entry;
  if (listId === undefined) {
    const kept = availableChoice(answers[field.id], field, available);
    if (kept === answers[field.id]) return answers;
    return kept === REMOVE || kept === undefined
      ? omit(answers, [field.id])
      : { ...answers, [field.id]: kept };
  }
  const rows = asCards(answers[listId]);
  if (rows === null) return answers;
  let changed = false;
  const nextRows = rows.map((row) => {
    const kept = availableChoice(row[field.id], field, available);
    if (kept === row[field.id]) return row;
    changed = true;
    return kept === REMOVE || kept === undefined
      ? omit(row, [field.id])
      : { ...row, [field.id]: kept };
  });
  return changed ? { ...answers, [listId]: nextRows } : answers;
}

export type ResolvedFormulaOptions = {
  options: ResolvedOptions;
  /** The answers without selections the options no longer offer. */
  answers: Record<string, FormValue>;
};

/**
 * Resolves every options formula against `answers`, each after the formulas
 * whose answers it reads, so a formula reads another choice field's answer
 * with the labels that field offered and without selections it dropped.
 */
export function resolveFormulaOptions(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  sources?: VariableResolutionContext["sources"];
}): Result<ResolvedFormulaOptions, string> {
  const { schema, sources } = params;
  const entries = collectOptionsFormulaFields(schema);
  if (entries.length === 0) {
    return R.success({ options: new Map(), answers: params.answers });
  }
  const order = optionsFormulaOrder(entries);
  if (!order.ok) return R.failure(optionsCycleMessage(order.error));

  const pageFields = collectVariableResolutionFields(schema);
  const options = new Map<string, readonly ChoiceOption[]>();
  let answers = params.answers;
  for (const entry of order.value) {
    const resolved = evaluateOptionsFormula(entry.field.optionsFormula, {
      answers,
      fields: variableInputFieldsById(
        pageFields.map((field) => withResolvedOptions(field, options)),
      ),
      sources,
    });
    if (!resolved.ok) {
      return R.failure(
        `Options of question "${entry.field.id}": ${resolved.error}`,
      );
    }
    options.set(entry.field.id, resolved.value);
    answers = keepAvailable({ answers, entry, options: resolved.value });
  }
  return R.success({ options, answers });
}

const formulaChoicesSchema = z.record(
  z.string(),
  z.array(z.strictObject({ label: z.string(), value: z.string() })),
);

/**
 * The choices a response selected from each options formula's offer, keyed by
 * field id, in the order offered. A list sub-field's covers every row, since
 * the rows share one offer.
 */
export type FormulaChoices = z.infer<typeof formulaChoicesSchema>;

export function readFormulaChoices(
  value: unknown,
): Result<FormulaChoices, z.ZodError> {
  const parsed = formulaChoicesSchema.safeParse(value);
  return parsed.success ? R.success(parsed.data) : R.failure(parsed.error);
}

function selectedValues(value: FormValue | undefined): readonly unknown[] {
  if (value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function selectedIn(
  answers: Record<string, FormValue>,
  { field, listId }: FormulaFieldEntry,
): ReadonlySet<unknown> {
  const rows = listId === undefined ? [answers] : answers[listId];
  if (!Array.isArray(rows)) return new Set();
  return new Set(
    rows.flatMap((row: unknown) =>
      isListRow(row) ? selectedValues(row[field.id]) : [],
    ),
  );
}

export function selectsFormulaChoice(
  schema: FormSchema,
  answers: Record<string, FormValue>,
): boolean {
  return collectOptionsFormulaFields(schema).some(
    (entry) => selectedIn(answers, entry).size > 0,
  );
}

export function selectedFormulaChoices(params: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  options: ResolvedOptions;
}): FormulaChoices {
  const { schema, answers, options } = params;
  const choices: FormulaChoices = {};
  for (const entry of collectOptionsFormulaFields(schema)) {
    const selected = selectedIn(answers, entry);
    const offered = (options.get(entry.field.id) ?? []).filter((option) =>
      selected.has(option.value),
    );
    if (offered.length > 0) choices[entry.field.id] = offered;
  }
  return choices;
}

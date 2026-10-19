import z from "zod";
import { R, type Result } from "../result";
import {
  isListRow,
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListSubField,
} from "./form-schema";
import { categorizedOptions } from "./formula-option-categories";
import {
  collectOptionsFormulaFields,
  mapFormulaFields,
  mapSchemaFormulaFields,
  type ChoiceField,
  type FormulaChoiceField,
  type FormulaFieldEntry,
  type ResolvedOptions,
} from "./formula-options";

const formulaChoicesSchema = z.record(
  z.string(),
  z.array(
    z.strictObject({
      label: z.string(),
      value: z.string(),
      category: z.string().optional(),
    }),
  ),
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

const savedChoicesField =
  (choices: FormulaChoices) =>
  (field: FormulaChoiceField): ChoiceField => ({
    ...field,
    ...categorizedOptions(choices[field.id] ?? []),
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

export function fieldWithSavedChoices<T extends AnyField | ListSubField>(
  field: T,
  choices: FormulaChoices,
): T {
  return mapFormulaFields(field, savedChoicesField(choices));
}

export function fieldsWithSavedChoices(
  fields: readonly AnyField[],
  choices: FormulaChoices,
): AnyField[] {
  return fields.map((field) => fieldWithSavedChoices(field, choices));
}

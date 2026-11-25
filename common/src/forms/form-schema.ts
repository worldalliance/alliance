import { z } from "zod";
import type { DisplayBlock } from "./display-blocks";
import {
  displayBlockSchema,
  type ManualDisplayBlockContent,
} from "./display-blocks";
import {
  anyFieldSchema,
  fieldHasOptions,
  type AnyField,
} from "./field-schemas";
import { rowListSchema } from "./row-list-schema";
import {
  formVariableSchema,
  isFieldKindReadableByFieldInput,
  type VariableInputField,
} from "./variables";
import { visibleIfFormulaSchema } from "./visible-if-formula";

export * from "./field-schemas";
export * from "./form-value";

export type PageItem = AnyField | DisplayBlock;

export const pageSchema = z.strictObject({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  visibleIfFormula: visibleIfFormulaSchema.optional(),
  fields: z.array(z.union([anyFieldSchema, displayBlockSchema])),
});

export type Page = z.infer<typeof pageSchema>;

export type ManualDisplayBlockContentMap = Record<
  string,
  ManualDisplayBlockContent
>;

const aggregateViewValueSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("number"), value: z.number() }),
  z.strictObject({
    type: z.literal("numberfield"),
    fieldId: z.string(),
    value: z.number().optional(),
  }),
]);
export type AggregateViewValue = z.infer<typeof aggregateViewValueSchema>;

const aggregateViewDisplayTypeSchema = z.enum(["number", "dollars"]);
export type AggregateViewDisplayType = z.infer<
  typeof aggregateViewDisplayTypeSchema
>;

const aggregateProgressBarViewSchema = z.strictObject({
  kind: z.literal("progressbar"),
  id: z.string(),
  title: z.string(),
  caption: z.string(),
  numerator: aggregateViewValueSchema,
  denominator: aggregateViewValueSchema,
  displayType: aggregateViewDisplayTypeSchema,
});
export type AggregateProgressBarView = z.infer<
  typeof aggregateProgressBarViewSchema
>;

export const aggregateViewSchemaSchema = aggregateProgressBarViewSchema;
export type AggregateViewSchema = z.infer<typeof aggregateViewSchemaSchema>;

export const outputFieldBlockSchema = z.strictObject({
  id: z.string(),
  fieldId: z.string(),
  showLabel: z.boolean().optional(),
  labelOverride: z.string().optional(),
  format: z.enum(["field", "textonly", "card"]).optional(),
  visibleIfFormula: visibleIfFormulaSchema.optional(),
});
export type OutputFieldBlock = z.infer<typeof outputFieldBlockSchema>;

export const outputBlockSchema = z.union([
  displayBlockSchema,
  outputFieldBlockSchema,
]);
export type OutputBlock = z.infer<typeof outputBlockSchema>;

export const outputViewSchemaSchema = z.strictObject({
  type: z.enum(["default", "page", "card", "personal"]),
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  blocks: z.array(outputBlockSchema),
});
export type OutputViewSchema = z.infer<typeof outputViewSchemaSchema>;

export const formSchema = z.strictObject({
  description: z.string().optional(),
  pages: z.array(pageSchema),
  submit: z.strictObject({ label: z.string().optional() }).optional(),
  completionSubtitle: z.string().optional(),
  shareableTextTemplate: z.string().optional(),
  defaultShareableTextTemplate: z.string().optional(),
  outputViews: z.array(outputViewSchemaSchema),
  aggregateViews: z.array(aggregateViewSchemaSchema).optional(),
  /** Computed values referenced as `#{name}` in display text and labels. */
  variables: z.array(formVariableSchema).optional(),
  rowList: rowListSchema.optional(),
});
export type FormSchema = z.infer<typeof formSchema>;

export function isQuestionField(field: PageItem): field is AnyField {
  return field.type === "input";
}

export function isDisplayBlock(field: PageItem): field is DisplayBlock {
  return field.type === "display";
}

export function collectPageByFieldId(pages: Page[]): Map<string, Page> {
  const map = new Map<string, Page>();
  for (const page of pages) {
    for (const field of page.fields ?? []) {
      if (isQuestionField(field)) map.set(field.id, page);
    }
  }
  return map;
}

export function collectFieldLookup(pages: Page[]): Map<string, AnyField> {
  const lookup = new Map<string, AnyField>();
  for (const page of pages) {
    for (const element of page.fields) {
      if (!isQuestionField(element)) continue;
      lookup.set(element.id, element);
      // List sub-fields are looked up too, so a condition can reference one.
      if (element.kind === "list") {
        for (const sub of element.fields ?? []) {
          lookup.set(sub.id, sub);
        }
      }
    }
  }
  return lookup;
}

/**
 * Returns page-level fields a formula can read: those with one readable answer,
 * and lists, which a formula reads as one record per row. List sub-fields are
 * read only through their list.
 */
export function collectVariableInputFields(schema: FormSchema): AnyField[] {
  return readableVariableInputFields(collectVariableResolutionFields(schema));
}

export function readableVariableInputFields(
  fields: readonly AnyField[],
): AnyField[] {
  return fields.filter(
    (field) =>
      field.kind === "list" || isFieldKindReadableByFieldInput(field.kind),
  );
}

/**
 * Every page-level question field, readable or not, so a variable reading a
 * kind this build doesn't know fails instead of reading nothing.
 */
export function collectVariableResolutionFields(
  schema: FormSchema,
): AnyField[] {
  return (schema.pages ?? []).flatMap((page) =>
    (page.fields ?? []).filter(isQuestionField),
  );
}

function variableInputField(field: AnyField): VariableInputField {
  if (fieldHasOptions(field)) {
    return {
      kind: field.kind,
      options: field.options,
      categories: "categories" in field ? field.categories : undefined,
    };
  }
  if (field.kind === "list") return { kind: field.kind, fields: field.fields };
  return { kind: field.kind };
}

export function variableInputFieldsById(
  fields: readonly AnyField[],
): ReadonlyMap<string, VariableInputField> {
  return new Map(fields.map((field) => [field.id, variableInputField(field)]));
}

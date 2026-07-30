import z from "zod";
import type { DisplayBlock } from "./display-blocks";
import {
  displayBlockSchema,
  type ManualDisplayBlockContent,
} from "./display-blocks";
import type { Condition, VisibleIfFormula } from "./visible-if-formula";
import { visibleIfFormulaSchema } from "./visible-if-formula";

const cityFieldValueSchema = z.strictObject({
  id: z.number(),
  name: z.string(),
  admin1: z.string(),
  countryCode: z.string(),
  countryName: z.string(),
});
export type CityFieldValue = z.infer<typeof cityFieldValueSchema>;

export type ListFieldValue = Record<string, FormValue>[];
export type FormValue =
  | string
  | number
  | boolean
  | string[]
  | CityFieldValue
  | ListFieldValue;

const formValueSchema: z.ZodType<FormValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    cityFieldValueSchema,
    z.array(z.record(z.string(), formValueSchema)),
  ]),
);

const widthSchema = z.enum(["full", "1/2", "1/3"]);

const fieldOutputConfigSchema = z.strictObject({
  output: z.boolean().optional(),
  privateByDefault: z.boolean().optional(),
});
export type FieldOutputConfig = z.infer<typeof fieldOutputConfigSchema>;

const baseFieldSchema = z.object({
  id: z.string(),
  type: z.literal("input"),
  label: z.string().nullable(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: formValueSchema.nullable().optional(),
  customValidatorId: z.number().optional(),
  visibleIfFormula: visibleIfFormulaSchema.optional(),
  requiredIfFormula: visibleIfFormulaSchema.optional(),
  width: widthSchema.optional(),
  output: fieldOutputConfigSchema.optional(),
});

const optionSchema = z.strictObject({
  label: z.string(),
  value: z.string(),
});

// An option's identity is its value (answer matching, ranking order, React
// keys), so duplicate values would make answers ambiguous.
const optionListSchema = z
  .array(optionSchema)
  .refine(
    (options) =>
      new Set(options.map((option) => option.value)).size === options.length,
    "option values must be unique",
  );

const textFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("text"),
  placeholder: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
});
export type TextField = z.infer<typeof textFieldSchema>;

const textareaFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("textarea"),
  rows: z.number().optional(),
  maxLength: z.number().optional(),
  placeholder: z.string().optional(),
});
export type TextareaField = z.infer<typeof textareaFieldSchema>;

const emailFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("email"),
});
export type EmailField = z.infer<typeof emailFieldSchema>;

const phoneFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("phone"),
  placeholder: z.string().optional(),
  autoExtractUserData: z.boolean().optional(),
});
export type PhoneField = z.infer<typeof phoneFieldSchema>;

const numberFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  allowDecimals: z.boolean().optional(),
  decimalPlaces: z.number().optional(),
});
export type NumberField = z.infer<typeof numberFieldSchema>;

const rangeFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("range"),
  optionCount: z.number().optional(),
  startLabel: z.string().optional(),
  endLabel: z.string().optional(),
});
export type RangeField = z.infer<typeof rangeFieldSchema>;

export const CHECKBOX_EXTRACTION_TARGETS = ["shareInfoPublicly"] as const;
const checkboxExtractionTargetSchema = z.enum(CHECKBOX_EXTRACTION_TARGETS);
export type CheckboxExtractionTarget = z.infer<
  typeof checkboxExtractionTargetSchema
>;

const checkboxPositionSchema = z.enum(["left", "right"]);
export type CheckboxPosition = z.infer<typeof checkboxPositionSchema>;

const checkboxFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("checkbox"),
  autoExtractUserData: z
    .strictObject({ target: checkboxExtractionTargetSchema })
    .optional(),
  checkboxPosition: checkboxPositionSchema.optional(),
});
export type CheckboxField = z.infer<typeof checkboxFieldSchema>;

export const AUTO_EXTRACT_FIELD_KINDS = [
  "phone",
  "time",
  "timezone",
  "city",
  "checkbox",
  "custom",
] as const;
export type AutoExtractFieldKind = (typeof AUTO_EXTRACT_FIELD_KINDS)[number];

const radioFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("radio"),
  options: optionListSchema,
  randomizeOptions: z.boolean().optional(),
});
export type RadioField = z.infer<typeof radioFieldSchema>;

const selectFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("select"),
  options: optionListSchema,
  randomizeOptions: z.boolean().optional(),
});
export type SelectField = z.infer<typeof selectFieldSchema>;

const multiSelectFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("multiselect"),
  options: optionListSchema,
  randomizeOptions: z.boolean().optional(),
  maxSelections: z.number().optional(),
});
export type MultiSelectField = z.infer<typeof multiSelectFieldSchema>;

const dateFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("date"),
});
export type DateField = z.infer<typeof dateFieldSchema>;

const timeFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("time"),
  autoExtractUserData: z.boolean().optional(),
});
export type TimeField = z.infer<typeof timeFieldSchema>;

const timezoneFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("timezone"),
  autoExtractUserData: z.boolean().optional(),
});
export type TimezoneField = z.infer<typeof timezoneFieldSchema>;

const cityFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("city"),
  placeholder: z.string().optional(),
  minLength: z.number().optional(),
  debounceMs: z.number().optional(),
  autoExtractUserData: z.boolean().optional(),
});
export type CityField = z.infer<typeof cityFieldSchema>;

const contractFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("contract"),
  contractId: z.number().nullable(),
  contract: z.strictObject({ id: z.number(), markdown: z.string() }).optional(),
  signQuestion: z.string(),
  yesLabel: z.string(),
  noLabel: z.string(),
});
export type ContractField = z.infer<typeof contractFieldSchema>;

const fileFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("file"),
});
export type FileField = z.infer<typeof fileFieldSchema>;

const rankingFieldSchema = z
  .strictObject({
    ...baseFieldSchema.shape,
    kind: z.literal("ranking"),
    options: optionListSchema.min(1),
    numToRank: z.int().positive().optional(),
  })
  .refine(
    (data) =>
      data.numToRank === undefined || data.options.length >= data.numToRank,
    "numToRank must be less than or equal to the number of options",
  );
export type RankingField = z.infer<typeof rankingFieldSchema>;

const actionShareUrlConfigSchema = z.strictObject({
  actionId: z.number().optional(),
});

const externalShareUrlConfigSchema = z.strictObject({
  externalTargetId: z.number().optional(),
});

export const customComponentConfigSchema = z.union([
  actionShareUrlConfigSchema,
  externalShareUrlConfigSchema,
]);
export type CustomComponentConfig = z.infer<typeof customComponentConfigSchema>;

/** @deprecated do not add any new types of custom components */
const customComponentFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("custom"),
  componentId: z.string(),
  componentConfig: customComponentConfigSchema.optional(),
  autoExtractUserData: z
    .strictObject({ target: checkboxExtractionTargetSchema })
    .optional(),
});
export type CustomComponentField = z.infer<typeof customComponentFieldSchema>;

export const listSubFieldSchema = z.discriminatedUnion("kind", [
  textFieldSchema,
  textareaFieldSchema,
  emailFieldSchema,
  phoneFieldSchema,
  numberFieldSchema,
  rangeFieldSchema,
  checkboxFieldSchema,
  radioFieldSchema,
  selectFieldSchema,
  multiSelectFieldSchema,
  dateFieldSchema,
  timeFieldSchema,
  timezoneFieldSchema,
  cityFieldSchema,
  fileFieldSchema,
  contractFieldSchema,
  customComponentFieldSchema,
]);
export type ListSubField = z.infer<typeof listSubFieldSchema>;

const listFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("list"),
  fields: z.array(listSubFieldSchema),
  defaultNumber: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  addButtonLabel: z.string().optional(),
  /** Sub-field ids to hide when rendering this list in an output view. */
  outputViewHiddenFieldIds: z.array(z.string()).optional(),
  /** Prefill this list's cards from a previous form's list field answer. */
  prefillFromPreviousAnswer: z
    .strictObject({
      sourceFormId: z.number(),
      sourceFieldId: z.string(),
      sourceSubFieldId: z.string(),
      targetSubFieldId: z.string(),
    })
    .optional(),
});
export type ListField = z.infer<typeof listFieldSchema>;

export const anyFieldSchema = z.discriminatedUnion("kind", [
  ...listSubFieldSchema.options,
  listFieldSchema,
  rankingFieldSchema,
]);
export type AnyField = z.infer<typeof anyFieldSchema>;
export type FieldKind = AnyField["kind"];

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
  title: z.string(),
  description: z.string().optional(),
  pages: z.array(pageSchema),
  submit: z.strictObject({ label: z.string().optional() }).optional(),
  shareableTextTemplate: z.string().optional(),
  defaultShareableTextTemplate: z.string().optional(),
  outputViews: z.array(outputViewSchemaSchema),
  aggregateViews: z.array(aggregateViewSchemaSchema).optional(),
});
export type FormSchema = z.infer<typeof formSchema>;

export function isQuestionField(
  field: AnyField | DisplayBlock,
): field is AnyField {
  return field.type === "input";
}

const OPTION_FIELD_KINDS = {
  radio: true,
  select: true,
  multiselect: true,
  ranking: true,
} as const satisfies Partial<Record<FieldKind, true>>;

export type OptionField = Extract<
  AnyField,
  { kind: keyof typeof OPTION_FIELD_KINDS }
>;

export function fieldHasOptions(field: AnyField): field is OptionField {
  return Object.hasOwn(OPTION_FIELD_KINDS, field.kind);
}

/**
 * Every condition governing a form's input pages: `visibleIfFormula`
 * conditions on pages, elements and list sub-fields, plus `requiredIfFormula`
 * on question fields (only they carry one — see `baseFieldSchema`).
 *
 * Anything that reacts to which condition *kinds* a schema contains — which
 * values to fetch before evaluating, which source forms to load — should walk
 * with this instead of re-deriving the traversal, so a new place to hang a
 * condition only has to be taught about here.
 *
 * Output-view conditions are deliberately excluded: they're scoped to a view,
 * can't read answers or account state, and are validated separately in
 * `form-schema-validate.ts`.
 *
 * Return `true` from `visit` to stop the walk early; the return value says
 * whether it stopped — so passing a predicate that returns `true` on a match
 * doubles as `some`, short-circuiting on the first hit.
 */
export function forEachCondition(
  schema: FormSchema,
  visit: (condition: Condition) => boolean | void,
): boolean {
  const visitFormula = (formula: VisibleIfFormula | undefined): boolean => {
    for (const condition of Object.values(formula?.conditions ?? {})) {
      if (visit(condition) === true) return true;
    }
    return false;
  };
  const visitElement = (element: AnyField | DisplayBlock): boolean => {
    if (visitFormula(element.visibleIfFormula)) return true;
    if (!isQuestionField(element)) return false;
    return visitFormula(element.requiredIfFormula);
  };
  for (const page of schema.pages ?? []) {
    if (visitFormula(page.visibleIfFormula)) return true;
    for (const element of page.fields ?? []) {
      if (visitElement(element)) return true;
      if (isQuestionField(element) && element.kind === "list") {
        for (const sub of element.fields ?? []) {
          if (visitElement(sub)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * The conditions `forEachCondition` deliberately skips: those on output-view
 * blocks. Separate rather than a flag on the walk above, because the two
 * answer different questions — that one asks what governs the form being
 * filled out, this one what governs a rendered response.
 *
 * Same early-stop contract as `forEachCondition`.
 */
export function forEachOutputViewCondition(
  schema: FormSchema,
  visit: (condition: Condition) => boolean | void,
): boolean {
  for (const view of schema.outputViews ?? []) {
    for (const block of view.blocks ?? []) {
      for (const condition of Object.values(
        block.visibleIfFormula?.conditions ?? {},
      )) {
        if (visit(condition) === true) return true;
      }
    }
  }
  return false;
}

/** Scan a form schema for all sourceFormIds referenced in visibility conditions. */
export function collectSourceFormIds(schema: FormSchema): number[] {
  const ids = new Set<number>();
  forEachCondition(schema, (c) => {
    switch (c.kind) {
      case "equals":
      case "includesOption":
      case "anySelected":
      case "hasValue":
        if (typeof c.sourceFormId === "number") {
          ids.add(c.sourceFormId);
        }
        break;
      case "validator":
      case "deviceType":
      case "outputBlockVisible":
      case "userHasCity":
      case "firstContractSigned":
      case "completedActionCount":
        break;
      default:
        // A kind added in a newer build: it may reference a source form we
        // won't prefetch, but this runs during render, where throwing isn't an
        // option. The renderers block such a schema outright.
        c satisfies never;
        break;
    }
  });
  return Array.from(ids);
}

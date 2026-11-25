import { z } from "zod";
import { conversationExpertSchema } from "./expert-schema";
import { formValueSchema } from "./form-value";
import {
  categorizedOptionsShape,
  checkOptionCategories,
  checkOptionsFormula,
  hasUniqueValues,
  optionListSchema,
  optionSchema,
  uniqueValuesMessage,
} from "./options-schema";
import { rowConditionSchema } from "./row-list-schema";
import { optionsFormulaSchema } from "./variables";
import { visibleIfFormulaSchema } from "./visible-if-formula";

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
  rowCondition: rowConditionSchema.optional(),
});

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
  autoExtractUserData: z.boolean().optional(),
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

export const MIN_RANGE_OPTION_COUNT = 2;
export const MAX_RANGE_OPTION_COUNT = 50;

const rangeFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("range"),
  optionCount: z.number().optional(),
  startLabel: z.string().optional(),
  endLabel: z.string().optional(),
});
export type RangeField = z.infer<typeof rangeFieldSchema>;

export const CHECKBOX_EXTRACTION_TARGETS = [
  "shareInfoPublicly",
  "textNotifications",
  "emailNotifications",
] as const;
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
  "textarea",
  "file",
  "image",
  "toggle",
  "timePicker",
] as const;
export type AutoExtractFieldKind = (typeof AUTO_EXTRACT_FIELD_KINDS)[number];

const radioFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("radio"),
  options: optionListSchema,
  randomizeOptions: z.boolean().optional(),
});
export type RadioField = z.infer<typeof radioFieldSchema>;

const selectFieldSchema = z
  .strictObject({
    ...baseFieldSchema.shape,
    kind: z.literal("select"),
    searchable: z.boolean().optional(),
    ...categorizedOptionsShape,
    optionsFormula: optionsFormulaSchema.optional(),
    randomizeOptions: z.boolean().optional(),
  })
  .superRefine(checkOptionCategories)
  .superRefine(checkOptionsFormula);
export type SelectField = z.infer<typeof selectFieldSchema>;

const multiSelectFieldSchema = z
  .strictObject({
    ...baseFieldSchema.shape,
    kind: z.literal("multiselect"),
    dropdown: z.boolean().optional(),
    searchable: z.boolean().optional(),
    ...categorizedOptionsShape,
    optionsFormula: optionsFormulaSchema.optional(),
    randomizeOptions: z.boolean().optional(),
    maxSelections: z.number().optional(),
  })
  .refine((data) => !data.searchable || data.dropdown, {
    message: "searchable requires dropdown",
    path: ["searchable"],
  })
  .superRefine(checkOptionCategories)
  .superRefine(checkOptionsFormula);
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
  autoExtractUserData: z.boolean().optional(),
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

export const CUSTOM_COMPONENT_EXTRACTION_TARGETS = [
  "shareInfoPublicly",
] as const satisfies readonly CheckboxExtractionTarget[];

/** @deprecated do not add any new types of custom components */
const customComponentFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("custom"),
  componentId: z.string(),
  componentConfig: customComponentConfigSchema.optional(),
  autoExtractUserData: z
    .strictObject({ target: z.enum(CUSTOM_COMPONENT_EXTRACTION_TARGETS) })
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

const imageFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("image"),
  autoExtractUserData: z.boolean().optional(),
});
export type ImageField = z.infer<typeof imageFieldSchema>;

const toggleFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("toggle"),
  autoExtractUserData: z
    .strictObject({ target: checkboxExtractionTargetSchema })
    .optional(),
  /**
   * Another toggle's id. Turning either off while the other is off turns the
   * other on, and this one is required while the other is not on.
   */
  atLeastOneOnWith: z.string().optional(),
});
export type ToggleField = z.infer<typeof toggleFieldSchema>;

const timePickerFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("timePicker"),
  autoExtractUserData: z.boolean().optional(),
});
export type TimePickerField = z.infer<typeof timePickerFieldSchema>;

const conversationOptionSchema = z.strictObject({
  ...optionSchema.shape,
  /** Markdown the expert replies with after this option is picked. */
  reply: z.string().optional(),
  /** Present when picking this option shows the note box. */
  note: z
    .strictObject({
      required: z.boolean().optional(),
      /** Shown above the note box; blank falls back to "Your note". */
      label: z.string().optional(),
      placeholder: z.string().optional(),
    })
    .optional(),
});
export type ConversationOption = z.infer<typeof conversationOptionSchema>;

const conversationFieldSchema = z.strictObject({
  ...baseFieldSchema.shape,
  kind: z.literal("conversation"),
  expert: conversationExpertSchema.nullable(),
  /** Markdown the expert asks with. */
  message: z.string(),
  options: z
    .array(conversationOptionSchema)
    .refine(hasUniqueValues, uniqueValuesMessage),
  /** The answer key the member's note is stored under. */
  noteId: z.string(),
});
export type ConversationField = z.infer<typeof conversationFieldSchema>;

export const anyFieldSchema = z.discriminatedUnion("kind", [
  ...listSubFieldSchema.options,
  listFieldSchema,
  rankingFieldSchema,
  imageFieldSchema,
  toggleFieldSchema,
  timePickerFieldSchema,
  conversationFieldSchema,
]);
export type AnyField = z.infer<typeof anyFieldSchema>;
export type FieldKind = AnyField["kind"];

const OPTION_FIELD_KINDS = {
  radio: true,
  select: true,
  multiselect: true,
  ranking: true,
  conversation: true,
} as const satisfies Partial<Record<FieldKind, true>>;

export type OptionField = Extract<
  AnyField,
  { kind: keyof typeof OPTION_FIELD_KINDS }
>;

export function fieldHasOptions(field: AnyField): field is OptionField {
  return Object.hasOwn(OPTION_FIELD_KINDS, field.kind);
}

import z from "zod";

/**
 * Input names are written verbatim into the formula, so unlike variable names
 * they must be parseable as identifiers — a name outside this shape could never
 * be referenced by the formula that depends on it.
 */
export const VARIABLE_INPUT_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Bounded to a Postgres integer, the column type of a form id.
const sourceFormIdSchema = z.number().int().positive().max(2_147_483_647);

const listPropertiesSchema = z.record(
  z.string(),
  z.string().regex(VARIABLE_INPUT_NAME_REGEX),
);

const variableFieldInputSchema = z.strictObject({
  kind: z.literal("field"),
  fieldId: z.string(),
});

const variableListInputSchema = z.strictObject({
  kind: z.literal("list"),
  fieldId: z.string(),
  /** Row property name for each readable sub-field, keyed by sub-field id. */
  properties: listPropertiesSchema,
});

// Kinds of their own, not an optional id on `field` and `list`: a build that
// predates them fails the variable as an unknown input kind, where it would
// ignore an unknown key and read this form's answers instead.
const variableSourceFieldInputSchema = z.strictObject({
  kind: z.literal("sourceField"),
  sourceFormId: sourceFormIdSchema,
  fieldId: z.string(),
});

const variableSourceListInputSchema = z.strictObject({
  kind: z.literal("sourceList"),
  sourceFormId: sourceFormIdSchema,
  fieldId: z.string(),
  properties: listPropertiesSchema,
});

export const variableInputSchema = z.discriminatedUnion("kind", [
  variableFieldInputSchema,
  variableListInputSchema,
  variableSourceFieldInputSchema,
  variableSourceListInputSchema,
]);
export type VariableInput = z.infer<typeof variableInputSchema>;
export type VariableFieldInput = Extract<
  VariableInput,
  { kind: "field" | "sourceField" }
>;
export type VariableListInput = Extract<
  VariableInput,
  { kind: "list" | "sourceList" }
>;
export type VariableSourceInput = Extract<
  VariableInput,
  { kind: "sourceField" | "sourceList" }
>;

const LIST_INPUT_KINDS: Record<VariableInput["kind"], boolean> = {
  field: false,
  list: true,
  sourceField: false,
  sourceList: true,
};

export function isListInput(input: VariableInput): input is VariableListInput {
  return LIST_INPUT_KINDS[input.kind];
}

const SOURCE_INPUT_KINDS: Record<VariableInput["kind"], boolean> = {
  field: false,
  list: false,
  sourceField: true,
  sourceList: true,
};

export function isSourceInput(
  input: VariableInput,
): input is VariableSourceInput {
  return SOURCE_INPUT_KINDS[input.kind];
}

export function inputSourceFormId(input: VariableInput): number | undefined {
  return isSourceInput(input) ? input.sourceFormId : undefined;
}

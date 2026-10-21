import z from "zod";

export const ROW_FIELD_NAME_REGEX = /^[A-Za-z0-9_]+$/;

const rowValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type RowValue = z.infer<typeof rowValueSchema>;

const rowFieldNameSchema = z.string().regex(ROW_FIELD_NAME_REGEX);

const rowSchema = z.record(rowFieldNameSchema, rowValueSchema);
export type Row = z.infer<typeof rowSchema>;

/**
 * Rows the server hands out one per member. Members never receive the list:
 * the server serves each the form filled from their own row.
 */
export const rowListSchema = z.strictObject({
  rows: z.array(rowSchema),
  /** The fields whose values together identify a row across list edits. */
  keyFields: z.array(rowFieldNameSchema),
});
export type RowList = z.infer<typeof rowListSchema>;

export enum RowConditionKind {
  Equals = "equals",
  NotEquals = "notEquals",
  HasValue = "hasValue",
  IsEmpty = "isEmpty",
  IsOneOf = "isOneOf",
}

export const rowConditionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal(RowConditionKind.Equals),
    field: rowFieldNameSchema,
    value: rowValueSchema,
  }),
  z.strictObject({
    kind: z.literal(RowConditionKind.NotEquals),
    field: rowFieldNameSchema,
    value: rowValueSchema,
  }),
  z.strictObject({
    kind: z.literal(RowConditionKind.HasValue),
    field: rowFieldNameSchema,
  }),
  z.strictObject({
    kind: z.literal(RowConditionKind.IsEmpty),
    field: rowFieldNameSchema,
  }),
  z.strictObject({
    kind: z.literal(RowConditionKind.IsOneOf),
    field: rowFieldNameSchema,
    values: z.array(rowValueSchema),
  }),
]);
export type RowCondition = z.infer<typeof rowConditionSchema>;

/** The row a response was submitted with, as it read at submit time. */
export const assignedRowSchema = z.strictObject({
  key: z.string(),
  values: rowSchema,
});
export type AssignedRow = z.infer<typeof assignedRowSchema>;

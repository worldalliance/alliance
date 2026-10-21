import type { DisplayBlock } from "./display-blocks";
import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type OutputBlock,
  type PageItem,
} from "./form-schema";
import {
  RowConditionKind,
  type AssignedRow,
  type Row,
  type RowCondition,
  type RowList,
  type RowValue,
} from "./row-list-schema";
import {
  forEachInterpolatableText,
  rewriteDisplayBlock,
  rewriteFieldText,
  rewriteOutputFieldBlock,
  VARIABLE_TEXT_PATHS,
  type InterpolatedPaths,
  type TextRewrite,
} from "./variable-interpolation";

const rowPlaceholderPattern = () => /#\{row\.([A-Za-z0-9_]+)\}/g;

const ROW_TEXT_PATHS: InterpolatedPaths = {
  displayFields: {
    ...VARIABLE_TEXT_PATHS.displayFields,
    biglink: [...VARIABLE_TEXT_PATHS.displayFields.biglink, "url"],
  },
  fieldProps: [...VARIABLE_TEXT_PATHS.fieldProps, "defaultValue"],
};

/** Stable across list edits that don't touch the key fields. */
export function rowKey(row: Row, keyFields: readonly string[]): string {
  return JSON.stringify(keyFields.map((field) => row[field] ?? null));
}

export function rowValueText(value: RowValue | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Every field any row has, in the order rows first use them. */
export function rowFieldNames(list: RowList): string[] {
  return [...new Set(list.rows.flatMap((row) => Object.keys(row)))];
}

export function rowLabel(row: Row, keyFields: readonly string[]): string {
  return keyFields.map((field) => rowValueText(row[field])).join(" · ");
}

const isEmptyValue = (value: RowValue | undefined) =>
  value === null || value === undefined || value === "";

export function rowConditionMet(condition: RowCondition, row: Row): boolean {
  const value = row[condition.field];
  const { kind } = condition;
  switch (kind) {
    case RowConditionKind.Equals:
      return value === condition.value;
    case RowConditionKind.NotEquals:
      return value !== condition.value;
    case RowConditionKind.HasValue:
      return !isEmptyValue(value);
    case RowConditionKind.IsEmpty:
      return isEmptyValue(value);
    case RowConditionKind.IsOneOf:
      return condition.values.includes(value ?? null);
    default:
      throw new Error(`unknown row condition kind: ${kind satisfies never}`);
  }
}

export function collectRowFieldReferences(text: string): string[] {
  return [...text.matchAll(rowPlaceholderPattern())].map((match) => match[1]);
}

const rowRewrite =
  (row: Row): TextRewrite =>
  (text) =>
    text.replace(rowPlaceholderPattern(), (_whole, field: string) =>
      rowValueText(row[field]),
    );

const shownFor = (row: Row) => (item: { rowCondition?: RowCondition }) =>
  item.rowCondition === undefined || rowConditionMet(item.rowCondition, row);

// Serializes without the key, so no installed app ever receives a condition.
const withoutRowCondition = <T extends { rowCondition?: RowCondition }>(
  item: T,
): T =>
  item.rowCondition === undefined ? item : { ...item, rowCondition: undefined };

function fieldForRow<T extends AnyField>(field: T, row: Row): T {
  const rewritten = rewriteFieldText(
    withoutRowCondition(field),
    rowRewrite(row),
    ROW_TEXT_PATHS,
  );
  if (rewritten.kind !== "list") return rewritten;
  return {
    ...rewritten,
    fields: rewritten.fields
      .filter(shownFor(row))
      .map((sub) => fieldForRow(sub, row)),
  };
}

const blockForRow = <T extends DisplayBlock>(block: T, row: Row): T =>
  rewriteDisplayBlock(
    withoutRowCondition(block),
    rowRewrite(row),
    ROW_TEXT_PATHS,
  );

const itemForRow = (item: PageItem, row: Row): PageItem =>
  isQuestionField(item) ? fieldForRow(item, row) : blockForRow(item, row);

const outputBlockForRow = (block: OutputBlock, row: Row): OutputBlock =>
  "fieldId" in block
    ? rewriteOutputFieldBlock(block, rowRewrite(row))
    : blockForRow(block, row);

/**
 * The form as the member holding `row` is served it: placeholders filled, items
 * whose row condition fails dropped, and no trace of the list or the
 * conditions, which no installed app knows how to read.
 */
export function schemaForRow(schema: FormSchema, row: Row): FormSchema {
  const { rowList: _list, ...rest } = schema;
  return {
    ...rest,
    pages: rest.pages.map((page) => ({
      ...page,
      fields: page.fields
        .filter(shownFor(row))
        .map((item) => itemForRow(item, row)),
    })),
    outputViews: rest.outputViews.map((view) => ({
      ...view,
      blocks: view.blocks
        .filter((block) => "fieldId" in block || shownFor(row)(block))
        .map((block) => outputBlockForRow(block, row)),
    })),
  };
}

/** The `blockId` of errors in the list itself rather than in a block. */
export const ROW_LIST_BLOCK_ID = "rowList";

type RowListError = { blockId: string; message: string };

function forEachRowCondition(
  schema: FormSchema,
  visit: (condition: RowCondition, blockId: string) => void,
): void {
  const visitItem = (item: PageItem) => {
    const blockId = item.id ?? `<${item.kind}>`;
    if (item.rowCondition) visit(item.rowCondition, blockId);
    if (isQuestionField(item) && item.kind === "list") {
      item.fields.forEach(visitItem);
    }
  };
  for (const page of schema.pages) page.fields.forEach(visitItem);
  for (const view of schema.outputViews) {
    for (const block of view.blocks) {
      if (!("fieldId" in block)) visitItem(block);
    }
  }
}

export function rowListErrors(schema: FormSchema): RowListError[] {
  const list: RowList | undefined = schema.rowList;
  const errors: RowListError[] = [];
  const fields = new Set(list === undefined ? [] : rowFieldNames(list));
  const unknownField = (field: string) =>
    list === undefined
      ? `uses row field "${field}", but the form has no row list`
      : `uses row field "${field}", which no row has`;

  if (list !== undefined) {
    const push = (message: string) =>
      errors.push({ blockId: ROW_LIST_BLOCK_ID, message });
    if (list.rows.length === 0) push("The row list has no rows");
    if (list.keyFields.length === 0) {
      push("Pick at least one field that identifies a row");
    }
    for (const field of list.keyFields) {
      if (list.rows.some((row) => isEmptyValue(row[field]))) {
        push(`Every row needs a value for key field "${field}"`);
      }
    }
    const seen = new Set<string>();
    for (const row of list.rows) {
      const key = rowKey(row, list.keyFields);
      if (seen.has(key)) push(`Two rows share the key ${key}`);
      seen.add(key);
    }
  }
  forEachInterpolatableText(
    schema,
    (text, location) => {
      for (const field of collectRowFieldReferences(text)) {
        if (!fields.has(field)) {
          errors.push({
            blockId: location,
            message: `#{row.${field}} ${unknownField(field)}`,
          });
        }
      }
    },
    ROW_TEXT_PATHS,
  );
  forEachRowCondition(schema, (condition, blockId) => {
    if (!fields.has(condition.field)) {
      errors.push({
        blockId,
        message: `Row condition ${unknownField(condition.field)}`,
      });
    }
  });
  return errors;
}

/**
 * Any schema a member is sent: filled from the response's saved row, or with
 * the list stripped and placeholders blank where there is no row to fill from.
 */
export function memberSchema(
  schema: FormSchema,
  assignedRow: AssignedRow | null,
): FormSchema {
  return schema.rowList === undefined
    ? schema
    : schemaForRow(schema, assignedRow?.values ?? {});
}

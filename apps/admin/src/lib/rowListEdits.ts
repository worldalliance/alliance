import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import {
  rowListSchema,
  type RowCondition,
  type RowList,
} from "@alliance/common/forms/row-list-schema";
import { R, type Result } from "@alliance/common/result";

/** An item a row condition can hang on: a page item or an output view block. */
export type ConditionableItem = {
  id: string;
  label: string;
  where: string;
  rowCondition: RowCondition | undefined;
};

export function conditionableItems(schema: FormSchema): ConditionableItem[] {
  const describe = (item: PageItem, where: string): ConditionableItem[] =>
    item.id === undefined
      ? []
      : [
          {
            id: item.id,
            label: elementInternalDescriptor(item, { maxTextLength: 60 }),
            where,
            rowCondition: item.rowCondition,
          },
        ];
  return [
    ...schema.pages.flatMap((page, index) =>
      page.fields.flatMap((item) =>
        describe(item, page.title || `Page ${index + 1}`),
      ),
    ),
    ...schema.outputViews.flatMap((view) =>
      view.blocks.flatMap((block) =>
        "fieldId" in block
          ? []
          : describe(block, `Output: ${view.title || view.id}`),
      ),
    ),
  ];
}

export function withRowCondition(
  schema: FormSchema,
  params: { itemId: string; condition: RowCondition | undefined },
): FormSchema {
  const { itemId, condition } = params;
  const apply = <T extends PageItem>(item: T): T =>
    item.id === itemId ? { ...item, rowCondition: condition } : item;
  return {
    ...schema,
    pages: schema.pages.map((page) => ({
      ...page,
      fields: page.fields.map(apply),
    })),
    outputViews: schema.outputViews.map((view) => ({
      ...view,
      blocks: view.blocks.map((block) =>
        "fieldId" in block ? block : apply(block),
      ),
    })),
  };
}

/** Reads pasted JSON as list rows, keeping the key fields every row still has. */
export function parseRowsJson(
  text: string,
  keyFields: readonly string[],
): Result<RowList, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return R.failure(`Not valid JSON: ${R.toError(error).message}`);
  }
  const list = rowListSchema.safeParse({ rows: parsed, keyFields: [] });
  if (!list.success) {
    return R.failure(
      "Paste an array of objects whose values are text, numbers, true/false or null, with field names of letters, digits and underscores",
    );
  }
  const fields = new Set(list.data.rows.flatMap((row) => Object.keys(row)));
  return R.success({
    rows: list.data.rows,
    keyFields: keyFields.filter((field) => fields.has(field)),
  });
}

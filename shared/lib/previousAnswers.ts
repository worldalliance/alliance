import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import type {
  AnyField,
  FormSchema,
  FormValue,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import { asCards, isQuestionField } from "@alliance/common/forms/form-schema";

function findFieldInSchema(
  schema: FormSchema,
  fieldId: string,
): AnyField | undefined {
  for (const page of schema.pages) {
    for (const element of page.fields) {
      if (isQuestionField(element)) {
        if (element.id === fieldId) {
          return element;
        }
      }
    }
  }

  return undefined;
}

export const DEFAULT_PREVIOUS_ANSWER_EMPTY_TEXT =
  "No previous answer available";

export function previousAnswerEmptyText(block: PreviousAnswerBlock) {
  return block.emptyText || DEFAULT_PREVIOUS_ANSWER_EMPTY_TEXT;
}

export enum PreviousAnswerShape {
  List = "list",
  Single = "single",
}

export type PreviousAnswer =
  | { shape: PreviousAnswerShape.List; field: ListField; rows: ListFieldValue }
  | {
      shape: PreviousAnswerShape.Single;
      field: Exclude<AnyField, ListField>;
      value: FormValue;
    };

/** Null when the block shows its empty text instead of an answer. */
export function resolvePreviousAnswer({
  block,
  schema,
  answers,
}: {
  block: PreviousAnswerBlock;
  schema: FormSchema | undefined;
  answers: Record<string, unknown> | undefined;
}): PreviousAnswer | null {
  if (!schema || !answers) {
    return null;
  }
  const field = findFieldInSchema(schema, block.sourceFieldId);
  if (!field) {
    return null;
  }
  const value = answers[block.sourceFieldId] as FormValue | undefined;
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (field.kind === "list") {
    const rows = asCards(value);
    return rows?.length
      ? { shape: PreviousAnswerShape.List, field, rows }
      : null;
  }
  return { shape: PreviousAnswerShape.Single, field, value };
}

export function getVisiblePreviousAnswerSubFields(
  field: ListField,
  block: PreviousAnswerBlock,
) {
  if (!block.visibleSubFieldIds?.length) {
    return field.fields;
  }

  const visibleSubFieldIds = new Set(block.visibleSubFieldIds);
  return field.fields.filter((subField) => visibleSubFieldIds.has(subField.id));
}

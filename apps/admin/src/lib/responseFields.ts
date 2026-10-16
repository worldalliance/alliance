import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type AnyField,
  type FieldKind,
  type FormSchema,
} from "@alliance/common/forms/form-schema";

const ANSWER_FIELD_KINDS = new Set<FieldKind>([
  "text",
  "textarea",
  "email",
  "number",
  "range",
  "phone",
  "checkbox",
  "radio",
  "select",
  "multiselect",
  "ranking",
  "date",
  "time",
  "timezone",
  "city",
  "file",
]);

const isAnswerField = (node: AnyField | DisplayBlock): node is AnyField =>
  isQuestionField(node) && ANSWER_FIELD_KINDS.has(node.kind);

/** Labels of the schema's answer fields, keyed by field id in page order. */
export function answerFieldLabels(
  schema: FormSchema | undefined,
): Map<string, string> {
  const labels = new Map<string, string>();
  schema?.pages?.forEach((page) => {
    page.fields.forEach((field) => {
      if (!isAnswerField(field) || labels.has(field.id)) return;
      labels.set(field.id, elementInternalDescriptor(field));
    });
  });
  return labels;
}

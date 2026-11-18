import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type AnyField,
  type FieldKind,
  type FormSchema,
} from "@alliance/common/forms/form-schema";

const ANSWER_FIELD_KINDS: Record<FieldKind, boolean> = {
  text: true,
  textarea: true,
  email: true,
  phone: true,
  number: true,
  range: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  ranking: true,
  date: true,
  time: true,
  timezone: true,
  city: true,
  file: true,
  contract: false,
  list: false,
  custom: false,
  image: true,
  toggle: true,
  timePicker: true,
};

const isAnswerField = (node: AnyField | DisplayBlock): node is AnyField =>
  isQuestionField(node) && ANSWER_FIELD_KINDS[node.kind];

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

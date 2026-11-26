import {
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import { formatAnswerValue } from "./answerValues";

/** The option's label for a stored value, or the value when no option has it. */
export const optionLabel = (field: AnyField, value: string): string => {
  if (!fieldHasOptions(field)) return value;
  return field.options.find((option) => option.value === value)?.label ?? value;
};

/** An answer as staff read it: choices by their labels, anything else as formatted. */
export const answerText = (
  field: AnyField | undefined,
  value: unknown,
): string => {
  if (!field || !fieldHasOptions(field) || value == null) {
    return formatAnswerValue(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => optionLabel(field, String(item))).join(", ");
  }
  return optionLabel(field, String(value));
};

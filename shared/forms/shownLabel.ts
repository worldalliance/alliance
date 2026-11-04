import { type AnyField } from "@alliance/common/forms/form-schema";

export const shownLabel = (field: Pick<AnyField, "label">): string | null =>
  field.label?.trim() ? field.label : null;

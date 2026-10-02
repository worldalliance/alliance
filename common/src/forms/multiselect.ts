import type { MultiSelectField } from "./form-schema";

export function getMaxSelections(
  field: Pick<MultiSelectField, "maxSelections">,
): number | undefined {
  return typeof field.maxSelections === "number" && field.maxSelections > 0
    ? field.maxSelections
    : undefined;
}

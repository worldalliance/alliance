import type {
  FormValue,
  ListField,
  ListSubField,
} from "@alliance/common/forms/form-schema";

export const isOutputValueMissing = (value: FormValue | undefined): boolean => {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

export const outputCardSubFields = (
  listField: ListField,
  card: Record<string, FormValue>,
): ListSubField[] => {
  const hiddenInOutputIds = new Set(listField.outputViewHiddenFieldIds ?? []);
  return (listField.fields ?? []).filter(
    (subField) =>
      !hiddenInOutputIds.has(subField.id) &&
      !isOutputValueMissing(card[subField.id]),
  );
};

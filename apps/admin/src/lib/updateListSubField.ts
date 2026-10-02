import {
  fieldHasOptions,
  type AnyField,
  type ListSubField,
} from "@alliance/common/forms/form-schema";
import {
  findSingleOptionValueChange,
  getUpdatedVisibilityFormula,
} from "./optionValueRename";

/** Applies `updates` to one sub-field, carrying an option value rename into its siblings' conditions. */
export function updateListSubField(
  subFields: ListSubField[],
  index: number,
  updates: Partial<AnyField>,
): ListSubField[] {
  const edited = subFields[index];
  const rename =
    edited && fieldHasOptions(edited) && "options" in updates && updates.options
      ? findSingleOptionValueChange(edited.options, updates.options)
      : null;
  return subFields.map((sub, i) => {
    if (i === index) return { ...sub, ...updates } as ListSubField;
    if (!edited || !rename) return sub;
    const result = getUpdatedVisibilityFormula(
      sub.visibleIfFormula,
      edited.id,
      rename.previousValue,
      rename.nextValue,
    );
    return result.changed
      ? { ...sub, visibleIfFormula: result.visibleIfFormula }
      : sub;
  });
}

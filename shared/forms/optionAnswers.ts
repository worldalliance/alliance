import {
  asCards,
  type AnyField,
  type FormValue,
  type MultiSelectField,
  type RangeField,
} from "@alliance/common/forms/form-schema";
import { isValidRangeSelection } from "@alliance/common/forms/range";

function knownSelections(
  field: MultiSelectField | RangeField,
  value: FormValue | undefined,
): FormValue | undefined {
  if (field.kind === "range") {
    return isValidRangeSelection(field, value) ? value : "";
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const known = new Set(field.options.map((option) => option.value));
  return value.filter(
    (item): item is string => typeof item === "string" && known.has(item),
  );
}

// A formula's options aren't known until it resolves, and the renderer leaves
// out its unavailable selections then.
const hasFixedOptions = (
  field: AnyField,
): field is MultiSelectField | RangeField =>
  (field.kind === "multiselect" && field.optionsFormula === undefined) ||
  field.kind === "range";

/**
 * Removes multiselect selections naming a fixed option the field no longer
 * has, and clears a range answer outside the field's options. An answer left
 * with none stays `[]` or `""`, as a cleared field is stored, so restoring it
 * does not bring back the field's default.
 */
export function dropUnknownOptionAnswers(
  answers: Record<string, FormValue>,
  fields: Map<string, AnyField>,
): Record<string, FormValue> {
  const cleaned: Record<string, FormValue> = {};
  for (const [fieldId, value] of Object.entries(answers)) {
    const field = fields.get(fieldId);
    if (field !== undefined && hasFixedOptions(field)) {
      const kept = knownSelections(field, value);
      if (kept !== undefined) {
        cleaned[fieldId] = kept;
      }
      continue;
    }

    const subFields =
      field?.kind === "list"
        ? field.fields.flatMap((sub) => (hasFixedOptions(sub) ? [sub] : []))
        : [];
    const cards = subFields.length > 0 ? asCards(value) : null;
    if (!cards) {
      cleaned[fieldId] = value;
      continue;
    }

    cleaned[fieldId] = cards.map((card) => {
      const next = { ...card };
      for (const subField of subFields) {
        if (!(subField.id in next)) {
          continue;
        }
        const kept = knownSelections(subField, next[subField.id]);
        if (kept !== undefined) {
          next[subField.id] = kept;
        } else {
          delete next[subField.id];
        }
      }
      return next;
    });
  }
  return cleaned;
}

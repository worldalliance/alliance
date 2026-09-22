import type {
  AnyField,
  FormValue,
  MultiSelectField,
} from "@alliance/common/forms/form-schema";
import { asCards } from "./listCards";

function knownSelections(
  field: MultiSelectField,
  value: FormValue | undefined,
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const known = new Set(field.options.map((option) => option.value));
  return value.filter(
    (item): item is string => typeof item === "string" && known.has(item),
  );
}

/**
 * Removes multiselect selections naming an option the field no longer has.
 * An answer left with none stays `[]`, as a cleared field is stored, so
 * restoring it does not bring back the field's default.
 */
export function dropUnknownOptionAnswers(
  answers: Record<string, FormValue>,
  fields: Map<string, AnyField>,
): Record<string, FormValue> {
  const cleaned: Record<string, FormValue> = {};
  for (const [fieldId, value] of Object.entries(answers)) {
    const field = fields.get(fieldId);
    if (field?.kind === "multiselect") {
      const kept = knownSelections(field, value);
      if (kept) {
        cleaned[fieldId] = kept;
      }
      continue;
    }

    const subFields =
      field?.kind === "list"
        ? field.fields.flatMap((sub) =>
            sub.kind === "multiselect" ? [sub] : [],
          )
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
        if (kept) {
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

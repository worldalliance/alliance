import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import { asCards } from "./listCards";

function isUploadedImageKey(value: FormValue | undefined): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("://") &&
    !value.startsWith("data:")
  );
}

function fileSubFieldIds(field: AnyField): string[] {
  if (field.kind !== "list") {
    return [];
  }
  return (field.fields ?? [])
    .filter((sub) => sub.kind === "file")
    .map((sub) => sub.id);
}

/**
 * Removes local `file://`, `ph://`, and data URI values left in drafts by older
 * clients. Only server storage keys are valid file answers.
 */
export function dropUnuploadedFileAnswers(
  answers: Record<string, FormValue>,
  fields: Map<string, AnyField>,
): Record<string, FormValue> {
  const cleaned: Record<string, FormValue> = {};
  for (const [fieldId, value] of Object.entries(answers)) {
    const field = fields.get(fieldId);
    if (field?.kind === "file") {
      if (isUploadedImageKey(value)) {
        cleaned[fieldId] = value;
      }
      continue;
    }

    const subFieldIds = field ? fileSubFieldIds(field) : [];
    const cards = subFieldIds.length > 0 ? asCards(value) : null;
    if (!cards) {
      cleaned[fieldId] = value;
      continue;
    }

    cleaned[fieldId] = cards.map((card) => {
      const next = { ...card };
      for (const subFieldId of subFieldIds) {
        if (subFieldId in next && !isUploadedImageKey(next[subFieldId])) {
          delete next[subFieldId];
        }
      }
      return next;
    });
  }
  return cleaned;
}

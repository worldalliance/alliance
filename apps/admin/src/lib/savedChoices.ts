import type { FormulaChoices } from "@alliance/common/forms/formula-options";
import type { FormResponseDto } from "@alliance/shared/client";
import { parseFormulaChoices } from "@alliance/shared/parsed-dtos";
import { uniqBy } from "es-toolkit";
import { sortResponsesByCreatedAtAsc } from "./sortResponses";

/** Each choice any response saved, under the label it was first saved with. */
export function savedChoicesAcrossResponses(
  responses: FormResponseDto[],
): FormulaChoices {
  const merged: FormulaChoices = {};
  for (const response of sortResponsesByCreatedAtAsc(responses)) {
    const saved = parseFormulaChoices(response.formulaChoices);
    for (const [fieldId, choices] of Object.entries(saved)) {
      merged[fieldId] = uniqBy(
        [...(merged[fieldId] ?? []), ...choices],
        (choice) => choice.value,
      );
    }
  }
  return merged;
}

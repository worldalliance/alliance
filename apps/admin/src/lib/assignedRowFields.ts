import type { FormResponseDto } from "@alliance/shared/client";
import { parseAssignedRow } from "@alliance/shared/parsed-dtos";

/** Every field of the rows `responses` were submitted with, first-seen order. */
export function assignedRowFields(
  responses: readonly FormResponseDto[],
): string[] {
  return [
    ...new Set(
      responses.flatMap((response) =>
        Object.keys(parseAssignedRow(response.assignedRow)?.values ?? {}),
      ),
    ),
  ];
}

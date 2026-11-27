import type { ActionPartnershipResponseDto } from "@alliance/shared/client/types.gen";

/** The sidebar's queue counts the responses no one has written a note on. */
export const needsReview = (response: ActionPartnershipResponseDto) =>
  response.notesHistory.length === 0;

export const matchesSearch = (
  response: ActionPartnershipResponseDto,
  q: string,
) => {
  const needle = q.trim().toLowerCase();
  return [response.organizationName, response.personName].some((name) =>
    name.toLowerCase().includes(needle),
  );
};

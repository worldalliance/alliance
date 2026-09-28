import type { FormResponseDto } from "@alliance/shared/client";

export const sortResponsesByCreatedAtAsc = (
  list: FormResponseDto[],
): FormResponseDto[] => {
  return [...list].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
};

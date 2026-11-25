import type { StaffDirectoryEntryDto } from "@alliance/shared/client/types.gen";

/** Whether the order, a title or a link differs from what was saved; an empty field is null. */
export const staffDirectoryChanged = ({
  saved,
  items,
}: {
  saved: readonly StaffDirectoryEntryDto[];
  items: readonly StaffDirectoryEntryDto[];
}) =>
  items.length !== saved.length ||
  items.some((item, index) => {
    const original = saved[index];
    return (
      original.id !== item.id ||
      (original.staffTitle ?? null) !== (item.staffTitle ?? null) ||
      (original.staffLink ?? null) !== (item.staffLink ?? null)
    );
  });

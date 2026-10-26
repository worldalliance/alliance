import { Column, type ColumnOptions } from "typeorm";

/**
 * Maps a column that a later deploy drops. No query this release builds names
 * it, so the drop can run while this release still serves.
 */
export const RetiredColumn = (
  options: Required<Pick<ColumnOptions, "name" | "type">> &
    Pick<ColumnOptions, "enum">,
) =>
  Column({
    ...options,
    nullable: true,
    insert: false,
    update: false,
    select: false,
  });

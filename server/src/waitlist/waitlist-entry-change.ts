import type { EntityManager } from "typeorm";
import type { WaitlistEntryActionKind } from "./entities/waitlist-entry-action.entity";

/**
 * Applies `set` to the entries `differs` matches, recording `kind` for each
 * one. Both are fixed SQL that can read `value` as `$4`. Resolves to how many
 * changed.
 */
export async function recordEntryChange(params: {
  manager: EntityManager;
  entryIds: number[];
  set: string;
  differs: string;
  value?: string;
  kind: WaitlistEntryActionKind;
  staffUserId: number | null;
}): Promise<number> {
  if (!params.entryIds.length) return 0;
  const rows: unknown[] = await params.manager.query(
    `WITH changed AS (
       UPDATE waitlist_entry SET ${params.set}
       WHERE id = ANY($1) AND "deletedAt" IS NULL AND ${params.differs}
       RETURNING id
     )
     INSERT INTO waitlist_entry_action ("entryId", kind, "staffUserId")
     SELECT id, $2, $3 FROM changed
     RETURNING "entryId"`,
    [
      params.entryIds,
      params.kind,
      params.staffUserId,
      ...(params.value === undefined ? [] : [params.value]),
    ],
  );
  return rows.length;
}

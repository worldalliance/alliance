import type { EntityManager } from "typeorm";
import { WaitlistEntryActionKind } from "./entities/waitlist-entry-action.entity";

const MOBILIZES: Record<WaitlistEntryActionKind, boolean> = {
  [WaitlistEntryActionKind.ManualMobilize]: true,
  [WaitlistEntryActionKind.UndoMobilize]: false,
};

/**
 * Sets or clears the mobilized time of the entries whose status differs,
 * recording each change. Resolves to how many changed.
 */
export async function recordMobilization(params: {
  manager: EntityManager;
  entryIds: number[];
  kind: WaitlistEntryActionKind;
  staffUserId: number;
}): Promise<number> {
  if (!params.entryIds.length) return 0;
  const mobilizes = MOBILIZES[params.kind];
  const rows: unknown[] = await params.manager.query(
    `WITH changed AS (
       UPDATE waitlist_entry
       SET "mobilizedAt" = ${mobilizes ? "now()" : "NULL"}
       WHERE id = ANY($1)
         AND "mobilizedAt" IS ${mobilizes ? "NULL" : "NOT NULL"}
       RETURNING id
     )
     INSERT INTO waitlist_entry_action ("entryId", kind, "staffUserId")
     SELECT id, $2, $3 FROM changed
     RETURNING "entryId"`,
    [params.entryIds, params.kind, params.staffUserId],
  );
  return rows.length;
}

import type { EntityManager } from "typeorm";
import { WaitlistEntryActionKind } from "./entities/waitlist-entry-action.entity";
import { recordEntryChange } from "./waitlist-entry-change";

type MobilizationKind =
  | WaitlistEntryActionKind.ManualMobilize
  | WaitlistEntryActionKind.EmailMobilize
  | WaitlistEntryActionKind.UndoMobilize;

const MOBILIZES: Record<MobilizationKind, boolean> = {
  [WaitlistEntryActionKind.ManualMobilize]: true,
  [WaitlistEntryActionKind.EmailMobilize]: true,
  [WaitlistEntryActionKind.UndoMobilize]: false,
};

/**
 * Sets or clears the mobilized time of the entries whose status differs,
 * recording each change. Resolves to how many changed.
 */
export async function recordMobilization(params: {
  manager: EntityManager;
  entryIds: number[];
  kind: MobilizationKind;
  staffUserId: number | null;
}): Promise<number> {
  const mobilizes = MOBILIZES[params.kind];
  return recordEntryChange({
    manager: params.manager,
    entryIds: params.entryIds,
    set: `"mobilizedAt" = ${mobilizes ? "now()" : "NULL"}`,
    differs: `"mobilizedAt" IS ${mobilizes ? "NULL" : "NOT NULL"}`,
    kind: params.kind,
    staffUserId: params.staffUserId,
  });
}

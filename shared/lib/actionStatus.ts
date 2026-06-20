import { ActionStatus } from "../client";

/**
 * Human-readable, transition-friendly labels for each action status. Mirrors
 * `readableActionStatus` in the server entity
 * (server/src/actions/entities/action-event.entity.ts); the server map can't be
 * imported from web/mobile, so it's duplicated here. `Record<ActionStatus, …>`
 * keeps it exhaustive, so a new status is a compile error until it's labelled.
 */
export const readableActionStatus: Record<ActionStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  office_action: "Office action",
  member_action: "Members taking action",
  resolution: "Resolution ongoing",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

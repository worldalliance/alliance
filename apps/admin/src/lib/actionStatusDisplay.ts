import type { ActionStatus } from "@alliance/shared/client";
import { BADGE_TONE_CLASS } from "../ui/Badge";
import { phaseTone } from "../ui/PhaseBadge";

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  office_action: "Office action",
  member_action: "Member action",
  resolution: "Resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

const phaseClass = (status: ActionStatus) =>
  BADGE_TONE_CLASS[phaseTone(status)];

/** `PhaseBadge`'s tones, for pages that predate it. */
export const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  draft: phaseClass("draft"),
  planned: phaseClass("planned"),
  office_action: phaseClass("office_action"),
  member_action: phaseClass("member_action"),
  resolution: phaseClass("resolution"),
  completed: phaseClass("completed"),
  failed: phaseClass("failed"),
  abandoned: phaseClass("abandoned"),
};

export const DEFAULT_EVENT_NAMES: Record<ActionStatus, string> = {
  draft: "Draft",
  office_action: "Office taking action",
  member_action: "Members taking action",
  resolution: "Pending office resolution",
  completed: "Action completed",
  failed: "Action failed",
  abandoned: "Action dropped",
  planned: "Planned",
};

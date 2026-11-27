import type { ActionStatus } from "@alliance/shared/client";
import { StatusTone } from "./statusTone";

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

export const ACTION_STATUS_TONES: Record<ActionStatus, StatusTone> = {
  draft: StatusTone.Neutral,
  planned: StatusTone.Neutral,
  office_action: StatusTone.Neutral,
  member_action: StatusTone.Live,
  resolution: StatusTone.Attention,
  completed: StatusTone.Positive,
  failed: StatusTone.Negative,
  abandoned: StatusTone.Neutral,
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

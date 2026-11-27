import type { ActionStatus } from "@alliance/shared/client";
import Badge, { BadgeTone } from "./Badge";

const PHASE: Record<ActionStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: BadgeTone.Neutral },
  planned: { label: "Planned", tone: BadgeTone.Info },
  member_action: { label: "Members taking action", tone: BadgeTone.Success },
  office_action: { label: "Office taking action", tone: BadgeTone.Info },
  resolution: { label: "Resolution", tone: BadgeTone.Info },
  completed: { label: "Completed", tone: BadgeTone.Neutral },
  failed: { label: "Failed", tone: BadgeTone.Danger },
  abandoned: { label: "Abandoned", tone: BadgeTone.Neutral },
};

export const phaseLabel = (status: ActionStatus) => PHASE[status].label;
export const phaseTone = (status: ActionStatus) => PHASE[status].tone;

/** A task's or suite's phase: the same word and tone on every page. */
export default function PhaseBadge({ status }: { status: ActionStatus }) {
  return <Badge tone={PHASE[status].tone}>{PHASE[status].label}</Badge>;
}

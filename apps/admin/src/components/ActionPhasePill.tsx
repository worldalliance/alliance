import type { ActionStatus } from "@alliance/shared/client";
import { ActionPhase } from "../lib/actionPhase";
import Badge, { BadgeTone } from "../ui/Badge";
import PhaseBadge from "../ui/PhaseBadge";

type OpenPhase = Exclude<ActionPhase, ActionPhase.Closed>;

const OPEN_PHASE: Record<OpenPhase, { label: string; tone: BadgeTone }> = {
  [ActionPhase.Draft]: { label: "Draft", tone: BadgeTone.Neutral },
  [ActionPhase.StaffTesting]: {
    label: "Staff testing",
    tone: BadgeTone.Warning,
  },
  [ActionPhase.Scheduled]: { label: "Scheduled", tone: BadgeTone.Info },
  [ActionPhase.Live]: { label: "Live", tone: BadgeTone.Success },
};

/** Where a task stands before it closes; once closed, its final status. */
const ActionPhasePill = ({
  phase,
  status,
}: {
  phase: ActionPhase;
  status: ActionStatus;
}) =>
  phase === ActionPhase.Closed ? (
    <PhaseBadge status={status} />
  ) : (
    <Badge tone={OPEN_PHASE[phase].tone}>{OPEN_PHASE[phase].label}</Badge>
  );

export default ActionPhasePill;

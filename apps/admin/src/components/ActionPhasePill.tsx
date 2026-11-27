import type { ActionStatus } from "@alliance/shared/client";
import { ActionPhase } from "../lib/actionPhase";
import { StatusTone } from "../lib/statusTone";
import StatusPill, { ActionStatusPill } from "./ui/StatusPill";

type OpenPhase = Exclude<ActionPhase, ActionPhase.Closed>;

const PHASE_PILLS: Record<OpenPhase, { label: string; tone: StatusTone }> = {
  [ActionPhase.Draft]: { label: "Draft", tone: StatusTone.Neutral },
  [ActionPhase.StaffTesting]: {
    label: "Staff testing",
    tone: StatusTone.Attention,
  },
  [ActionPhase.Scheduled]: { label: "Scheduled", tone: StatusTone.Neutral },
  [ActionPhase.Live]: { label: "Live", tone: StatusTone.Live },
};

const ActionPhasePill = ({
  phase,
  status,
}: {
  phase: ActionPhase;
  status: ActionStatus;
}) =>
  phase === ActionPhase.Closed ? (
    <ActionStatusPill status={status} />
  ) : (
    <StatusPill {...PHASE_PILLS[phase]} />
  );

export default ActionPhasePill;

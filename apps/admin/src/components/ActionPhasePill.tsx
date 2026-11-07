import type { ActionStatus } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { ActionPhase } from "../lib/actionPhase";
import {
  COUNT_COLORS,
  COUNT_LABELS,
  STEP_COUNT_BUCKET,
} from "../lib/projectCards";

type OpenPhase = Exclude<ActionPhase, ActionPhase.Closed>;

const PHASE_LABELS: Record<OpenPhase, string> = {
  [ActionPhase.Draft]: "Draft",
  [ActionPhase.StaffTesting]: "Staff testing",
  [ActionPhase.Scheduled]: "Scheduled",
  [ActionPhase.Live]: "Live",
};

const PHASE_COLORS: Record<OpenPhase, string> = {
  [ActionPhase.Draft]: "bg-zinc-100 text-zinc-700",
  [ActionPhase.StaffTesting]: "bg-amber-100 text-amber-800",
  [ActionPhase.Scheduled]: "bg-blue-100 text-blue-800",
  [ActionPhase.Live]: "bg-purple-100 text-purple-800",
};

const ActionPhasePill = ({
  phase,
  status,
}: {
  phase: ActionPhase;
  status: ActionStatus;
}) => {
  const [label, color] =
    phase === ActionPhase.Closed
      ? [
          COUNT_LABELS[STEP_COUNT_BUCKET[status]],
          COUNT_COLORS[STEP_COUNT_BUCKET[status]],
        ]
      : [PHASE_LABELS[phase], PHASE_COLORS[phase]];
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
        color,
      )}
    >
      {label}
    </span>
  );
};

export default ActionPhasePill;

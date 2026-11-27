import type { ActionStatus } from "@alliance/shared/client";
import Badge, { BadgeTone } from "../../ui/Badge";
import PhaseBadge from "../../ui/PhaseBadge";

/** A suite's phase, or "Scheduled" once it has launched for a start still ahead. */
export function SuitePhaseBadge({
  phase,
  scheduled,
}: {
  phase: ActionStatus;
  scheduled: boolean;
}) {
  return scheduled ? (
    <Badge tone={BadgeTone.Info}>Scheduled</Badge>
  ) : (
    <PhaseBadge status={phase} />
  );
}

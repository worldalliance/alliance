import type { AdminActionDto } from "@alliance/shared/client";
import { ActionPhase, actionPhase } from "../../lib/actionPhase";
import Badge, { BadgeTone } from "../../ui/Badge";
import PhaseBadge from "../../ui/PhaseBadge";

const PRE_LAUNCH: Record<ActionPhase, string | null> = {
  [ActionPhase.Draft]: null,
  [ActionPhase.StaffTesting]: "Staff testing",
  [ActionPhase.Scheduled]: "Scheduled",
  [ActionPhase.Live]: null,
  [ActionPhase.Closed]: null,
};

/** The status in effect, with the pre-launch phase beside it while there is one. */
export function TaskPhaseBadge({
  task,
}: {
  task: Pick<AdminActionDto, "staffPreview" | "events" | "status">;
}) {
  const label = PRE_LAUNCH[actionPhase(task, new Date())];
  return (
    <>
      <PhaseBadge status={task.status} />
      {label && <Badge tone={BadgeTone.Info}>{label}</Badge>}
    </>
  );
}

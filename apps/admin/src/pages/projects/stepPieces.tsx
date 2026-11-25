import { ActionPhase, actionPhase } from "../../lib/actionPhase";
import { countOf, formatCount } from "../../lib/formatNumber";
import type { FunnelStep, ProjectStep } from "../../lib/projectCards";
import Badge, { BadgeTone } from "../../ui/Badge";
import { cn } from "../../ui/cn";
import PhaseBadge from "../../ui/PhaseBadge";
import { percent } from "./projectRules";

// What the phase adds to the status badge beside it; null where the status
// already says it.
const PHASE_NOTE: Record<ActionPhase, string | null> = {
  [ActionPhase.Draft]: null,
  [ActionPhase.StaffTesting]: "Staff testing",
  [ActionPhase.Scheduled]: "Scheduled",
  [ActionPhase.Live]: null,
  [ActionPhase.Closed]: null,
};

/** A task's status, and whether it is in staff testing or has a launch ahead. */
export function StepBadges({ step, now }: { step: ProjectStep; now: Date }) {
  const note = PHASE_NOTE[actionPhase(step, now)];
  return (
    <>
      <PhaseBadge status={step.status} />
      {note && <Badge tone={BadgeTone.Info}>{note}</Badge>}
    </>
  );
}

/**
 * A task's completions, as a number and as a bar against the project's
 * largest, with the share of the task before it that this one kept.
 */
export function StepFunnel({
  entry,
  maxCompletions,
  barClass,
  className,
}: {
  entry: FunnelStep | undefined;
  maxCompletions: number;
  /** The project's colour; a standalone task's bar is neutral. */
  barClass: string;
  className?: string;
}) {
  const completions = entry?.completions ?? 0;
  return (
    <div className={cn("flex shrink-0 flex-col gap-1 text-caption", className)}>
      <div className="flex items-baseline justify-between gap-2 text-fg-muted tabular-nums">
        <span>
          <span className="font-medium text-fg">
            {formatCount(completions)}
          </span>{" "}
          completed
        </span>
        {entry?.retention != null && (
          <span>{percent(entry.retention)} of previous</span>
        )}
      </div>
      <div className="h-1 rounded-full bg-line">
        <div
          className={cn("h-1 rounded-full", barClass)}
          style={{ width: percent(completions / maxCompletions) }}
        />
      </div>
    </div>
  );
}

/** The totals under a card or in the side panel, in the same words. */
export const totalsText = (totals: {
  completions: number;
  wontComplete: number;
  dismissed: number;
}) =>
  [
    `${formatCount(totals.completions)} completed`,
    `${formatCount(totals.wontComplete)} won't complete`,
    `${formatCount(totals.dismissed)} dismissed`,
  ].join(" · ");

export const taskCount = (count: number) => countOf(count, "task");

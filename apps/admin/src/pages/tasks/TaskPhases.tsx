import type { ActionEventDto } from "@alliance/shared/client";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { cn } from "../../ui/cn";
import { phaseLabel } from "../../ui/PhaseBadge";
import { PhaseStepState, phaseSteps } from "./taskFacts";

const STATE_WORD: Record<PhaseStepState, string | null> = {
  [PhaseStepState.Past]: null,
  [PhaseStepState.Current]: "Now",
  [PhaseStepState.Upcoming]: "Next",
};

/**
 * The phases a task's events move it through, oldest first, each with the
 * instant it starts in launch time. The current one says "Now".
 */
export function TaskPhases({
  events,
  now = new Date(),
}: {
  events: readonly ActionEventDto[];
  now?: Date;
}) {
  const steps = phaseSteps(events, now);
  if (steps.length === 0) {
    return <p className="text-fg-muted">No events, so it is a draft.</p>;
  }
  const firstUpcoming = steps.find(
    (step) => step.state === PhaseStepState.Upcoming,
  );
  return (
    <ol className="flex flex-col">
      {steps.map((step) => {
        const word =
          step.state === PhaseStepState.Upcoming && step !== firstUpcoming
            ? null
            : STATE_WORD[step.state];
        return (
          <li
            key={step.id}
            aria-current={step.state === PhaseStepState.Current || undefined}
            className={cn(
              "flex min-h-9 flex-col justify-center border-l-2 py-1 pl-3",
              step.state === PhaseStepState.Current
                ? "border-accent"
                : "border-line",
            )}
          >
            <span
              className={cn(
                "flex items-baseline gap-2",
                step.state === PhaseStepState.Current && "font-medium",
              )}
            >
              {phaseLabel(step.status)}
              {word && (
                <span className="text-caption font-medium text-fg-muted">
                  {word}
                </span>
              )}
            </span>
            <span className="text-caption text-fg-muted tabular-nums">
              {formatDateTime(step.date, {
                weekday: true,
                timeZone: LAUNCH_TIME_ZONE,
              })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

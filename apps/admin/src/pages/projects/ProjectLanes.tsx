import { formatDate } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import type { ProjectStep } from "../../lib/projectCards";
import { cn } from "../../ui/cn";
import { phaseLabel } from "../../ui/PhaseBadge";
import type { LaneBar, ProjectTimeline } from "./timelineRules";

const day = (date: Date) => formatDate(date, { timeZone: LAUNCH_TIME_ZONE });

/** "Members taking action, Nov 3 – Nov 10", or "from Nov 10" for a phase nothing ends. */
export const barText = (bar: LaneBar) =>
  `${phaseLabel(bar.status)}, ${
    bar.end ? `${day(bar.start)} – ${day(bar.end)}` : `from ${day(bar.start)}`
  }`;

/**
 * One task's phases on the project's scale: members taking action in the
 * project's colour, every other phase neutral, and a mark at now.
 */
export function Lane({
  step,
  timeline,
  memberActionClass,
  className,
}: {
  step: Pick<ProjectStep, "id" | "name">;
  timeline: ProjectTimeline;
  memberActionClass: string;
  /** The lane's height. */
  className: string;
}) {
  return (
    <div className={cn("relative rounded-sm bg-surface-2", className)}>
      {(timeline.barsByStepId.get(step.id) ?? []).map((bar) => (
        <div
          key={bar.start.getTime()}
          title={`${step.name}: ${barText(bar)}`}
          className={cn(
            "absolute inset-y-0 min-w-0.5 rounded-sm",
            bar.status === "member_action"
              ? memberActionClass
              : "bg-line-strong",
          )}
          style={{ left: bar.left, width: bar.width }}
        />
      ))}
      {timeline.now !== null && (
        <div
          title="Now"
          className="absolute -inset-y-px w-px bg-fg"
          style={{ left: timeline.now }}
        />
      )}
    </div>
  );
}

/** The dates the lanes run between, under them. */
export function LaneDates({ timeline }: { timeline: ProjectTimeline }) {
  return (
    <div className="flex justify-between text-caption text-fg-muted">
      <span>{day(timeline.start)}</span>
      <span>{day(timeline.end)}</span>
    </div>
  );
}

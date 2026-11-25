import type { ActionStatus } from "@alliance/shared/client";
import { milliseconds, startOfDay } from "date-fns";
import { Link } from "react-router";
import type {
  PhaseSegment,
  TimelineRow,
} from "../../../lib/actionTimelineData";
import { formatDateTime } from "../../../lib/formatDate";
import { taskHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { cn } from "../../../ui/cn";
import { phaseLabel } from "../../../ui/PhaseBadge";
import {
  labelFits,
  pixelsAt,
  PROJECT_CAT_CLASS,
  projectCat,
} from "./timelineRules";

const at = (date: Date) => formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

const NEUTRAL = "border-line-strong bg-canvas text-fg-muted";

const PHASE_CLASS: Record<ActionStatus, string> = {
  draft: NEUTRAL,
  planned: NEUTRAL,
  member_action: "",
  office_action: NEUTRAL,
  resolution: NEUTRAL,
  completed: NEUTRAL,
  failed: "border-danger bg-danger-soft text-danger",
  abandoned: NEUTRAL,
};

const memberActionClass = (project: TimelineRow["action"]["project"]) => {
  if (!project) return "border-fg-muted bg-surface-2 text-fg";
  const cat = PROJECT_CAT_CLASS[projectCat(project.id)];
  return cn(cat.border, cat.soft, "text-fg");
};

const barClass = "focus-ring scroll-mt-12 scroll-ml-80";

/**
 * One phase from its event to the next. A week-wide column can't show the time
 * of day an event fires, so a bar spans whole days from its first gridline.
 * The last phase has no event ending it: its solid part stops at now and a
 * dashed outline runs on.
 */
function PhaseBar({
  action,
  phase,
  open,
  start,
  now,
}: {
  action: TimelineRow["action"];
  phase: PhaseSegment;
  open: boolean;
  start: Date;
  now: Date;
}) {
  const label = phaseLabel(phase.status);
  const from = startOfDay(phase.startDate).getTime();
  const left = pixelsAt(from, start);
  if (phase.status === "completed") {
    const title = `${action.name}: ${label} (${at(phase.startDate)})`;
    return (
      <Link
        to={taskHref(action.id)}
        title={title}
        aria-label={title}
        className={cn(barClass, "absolute inset-y-3 w-0.5 bg-fg-muted")}
        style={{ left: `${left}px` }}
      />
    );
  }
  const to = open
    ? Math.max(phase.endDate.getTime(), from + milliseconds({ days: 7 }))
    : startOfDay(phase.endDate).getTime();
  const width = Math.max(pixelsAt(to, start) - left - 2, 4);
  const solid = open
    ? Math.min(Math.max(pixelsAt(now.getTime(), start) - left, 0), width)
    : width;
  const title = open
    ? `${action.name}: ${label} (from ${at(phase.startDate)}, no later event)`
    : `${action.name}: ${label} (${at(phase.startDate)} – ${at(phase.endDate)})`;
  const tone =
    phase.status === "member_action"
      ? memberActionClass(action.project)
      : PHASE_CLASS[phase.status];
  return (
    <Link
      to={taskHref(action.id)}
      title={title}
      aria-label={title}
      className={cn(
        barClass,
        "absolute inset-y-3 flex items-center overflow-hidden rounded-sm border",
        tone,
        open && "border-dashed bg-transparent",
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
    >
      {open && (
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0", tone)}
          style={{ width: `${solid}px` }}
        />
      )}
      {labelFits(label, width) && (
        <span className="relative truncate px-2 text-caption font-medium">
          {label}
        </span>
      )}
    </Link>
  );
}

/** A task's phases across the chart, each a link to the task. */
export function TimelineBars({
  row,
  start,
  now,
}: {
  row: TimelineRow;
  start: Date;
  now: Date;
}) {
  return row.phases.map((phase, index) => (
    <PhaseBar
      key={phase.event?.id ?? index}
      action={row.action}
      phase={phase}
      open={index === row.phases.length - 1}
      start={start}
      now={now}
    />
  ));
}

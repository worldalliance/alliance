import { type ReactNode, useMemo } from "react";
import {
  buildTimelineData,
  normalizeReminders,
  type TimelineAction,
  type TimelineReminder,
} from "../../../lib/actionTimelineData";
import type { CohortSegment } from "../../../lib/describeCohortExpression";
import { cn } from "../../../ui/cn";
import { TaskTimeline } from "./TaskTimeline";
import { GroupBy } from "./timelineRules";

const NO_REMINDERS: TimelineReminder[] = [];

/** One timeline of the tasks given, ungrouped: a suite's own, as its record shows it. */
export default function ActionTimeline({
  actions,
  title,
  header,
  className,
  reminders = NO_REMINDERS,
  onReminderClick,
  latestLaunchFirst = false,
  participantsById,
  emptyMessage = "No tasks with timeline events.",
}: {
  actions: TimelineAction[];
  title?: string;
  /** Controls in a bar above the chart, too wide for the corner over the names. */
  header?: ReactNode;
  className?: string;
  reminders?: TimelineReminder[];
  onReminderClick?: (reminderId: number) => void;
  latestLaunchFirst?: boolean;
  participantsById?: ReadonlyMap<number, CohortSegment[]>;
  emptyMessage?: ReactNode;
}) {
  const normalized = useMemo(
    () => normalizeReminders(reminders, actions),
    [reminders, actions],
  );
  const data = useMemo(
    () =>
      buildTimelineData({
        actions,
        normalizedReminders: normalized,
        latestLaunchFirst,
      }),
    [actions, normalized, latestLaunchFirst],
  );
  const range = useMemo(
    () => ({ start: data.globalStartDate, end: data.globalEndDate }),
    [data],
  );
  const timeline = (
    <TaskTimeline
      label={title ? `${title} timeline` : "Task timeline"}
      groups={[
        {
          key: "all",
          kind: GroupBy.Suite,
          id: null,
          name: title ?? "Tasks",
          rows: data.timelineData,
          phase: null,
          span: null,
        },
      ]}
      groupHeaders={false}
      range={range}
      corner={
        <span className="truncate pl-page font-semibold">
          {title ?? "Tasks"}
        </span>
      }
      reminders={normalized}
      onReminderClick={onReminderClick}
      participantsById={participantsById}
      className={header ? "flex-1" : className}
      empty={
        <div className="px-card py-10 text-center text-fg-muted">
          {emptyMessage}
        </div>
      }
    />
  );
  if (!header) return timeline;
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-page py-2">
        {header}
      </div>
      {timeline}
    </div>
  );
}

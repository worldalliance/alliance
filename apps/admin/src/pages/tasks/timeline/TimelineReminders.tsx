import type { NormalizedReminder } from "../../../lib/actionTimelineData";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { cn } from "../../../ui/cn";
import type { XForTime } from "./timelineRules";

const at = (date: Date) => formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

/** A suite's reminders over every row: a line at a send time, a band over a send window. */
export function TimelineReminders({
  reminders,
  x,
  onReminderClick,
}: {
  reminders: NormalizedReminder[];
  x: XForTime;
  onReminderClick?: (reminderId: number) => void;
}) {
  return reminders.map((reminder) => {
    const left = x(reminder.startDate);
    const width = reminder.isRange
      ? Math.max(x(reminder.endDate) - left, 2)
      : 2;
    const name = reminder.label ? `: ${reminder.label}` : "";
    const title = reminder.isRange
      ? `Reminder window${name}`
      : `Reminder${name}`;
    const when = reminder.isRange
      ? `${at(reminder.startDate)} – ${at(reminder.endDate)}`
      : at(reminder.startDate);
    return (
      <button
        key={reminder.id}
        type="button"
        title={title}
        aria-label={`${title}, ${when}`}
        onClick={() => onReminderClick?.(reminder.original.id)}
        className={cn(
          "pointer-events-auto absolute inset-y-0 focus-ring",
          reminder.isRange
            ? "border-x-2 border-accent bg-accent-soft/60"
            : "bg-accent",
        )}
        style={{ left: `${left}px`, width: `${width}px` }}
      />
    );
  });
}

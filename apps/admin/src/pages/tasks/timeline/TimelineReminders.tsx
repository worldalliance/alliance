import type { NormalizedReminder } from "../../../lib/actionTimelineData";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { cn } from "../../../ui/cn";
import { NAME_COLUMN_PX, pixelsAt } from "./timelineRules";

const at = (date: Date) => formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

/** A suite's reminders over every row: a line at a send time, a band over a send window. */
export function TimelineReminders({
  reminders,
  start,
  onReminderClick,
}: {
  reminders: NormalizedReminder[];
  start: Date;
  onReminderClick?: (reminderId: number) => void;
}) {
  return reminders.map((reminder) => {
    const left = pixelsAt(reminder.startDate.getTime(), start);
    const width = reminder.isRange
      ? Math.max(pixelsAt(reminder.endDate.getTime(), start) - left, 2)
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
          "absolute inset-y-0 focus-ring",
          reminder.isRange
            ? "border-x-2 border-accent bg-accent-soft/60"
            : "bg-accent",
        )}
        style={{ left: `${NAME_COLUMN_PX + left}px`, width: `${width}px` }}
      />
    );
  });
}

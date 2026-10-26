import { millisecondsInDay } from "date-fns/constants";
import type { NormalizedReminder } from "../lib/actionTimelineData";

const ActionTimelineReminderOverlay = ({
  reminders,
  globalStartDate,
  pixelsPerDay,
  height,
  onReminderClick,
}: {
  reminders: NormalizedReminder[];
  globalStartDate: Date;
  pixelsPerDay: number;
  height: number;
  onReminderClick?: (reminderId: number) => void;
}) => (
  <div
    className="absolute left-0 right-0 z-30 pointer-events-none"
    style={{
      top: "50px",
      height: `${height}px`,
    }}
  >
    {reminders.map((reminder) => {
      const pixelsPerMillisecond = pixelsPerDay / millisecondsInDay;
      const startOffset =
        reminder.startDate.getTime() - globalStartDate.getTime();
      const left = startOffset * pixelsPerMillisecond;

      if (reminder.isRange) {
        const endOffset =
          reminder.endDate.getTime() - globalStartDate.getTime();
        const width = Math.max(
          2,
          (endOffset - startOffset) * pixelsPerMillisecond,
        );

        return (
          <div
            key={`reminder-range-${reminder.id}`}
            className="absolute cursor-pointer rounded-sm"
            style={{
              left: `${left}px`,
              width: `${width}px`,
              top: 0,
              height: "100%",
              backgroundColor: "rgba(220, 38, 38, 0.2)",
              borderLeft: "2px solid rgba(220, 38, 38, 0.6)",
              borderRight: "2px solid rgba(220, 38, 38, 0.6)",
              pointerEvents: "auto",
            }}
            title={
              reminder.label
                ? `Reminder window: ${reminder.label}`
                : "Reminder window"
            }
            onClick={() => {
              if (onReminderClick) {
                onReminderClick(reminder.original.id);
              }
            }}
          />
        );
      }

      return (
        <div
          key={`reminder-${reminder.id}`}
          className="absolute cursor-pointer"
          style={{
            left: `${left}px`,
            width: "2px",
            top: 0,
            height: "100%",
            backgroundColor: "rgba(220, 38, 38, 0.85)",
            pointerEvents: "auto",
          }}
          title={reminder.label ? `Reminder: ${reminder.label}` : "Reminder"}
          onClick={() => {
            if (onReminderClick) {
              onReminderClick(reminder.original.id);
            }
          }}
        />
      );
    })}
  </div>
);

export default ActionTimelineReminderOverlay;

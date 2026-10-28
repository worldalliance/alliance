import { cn } from "@alliance/shared/styles/util";
import LaunchCheck from "./LaunchCheck";
import {
  remindersBeforeLaunch,
  type ReminderSendWindow,
} from "./launchReminders";
import { inLaunchZone, type LaunchSchedule } from "./launchSchedule";

const LaunchRemindersCheck = ({
  windows,
  schedule,
}: {
  windows: ReminderSendWindow[];
  schedule: LaunchSchedule;
}) => {
  const early = new Set(remindersBeforeLaunch(windows, schedule));
  return (
    <LaunchCheck
      title="Reminders"
      passed={early.size === 0}
      summary={`${windows.length} created on launch`}
    >
      <ul className="text-sm">
        {[...windows]
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .map((window) => (
            <li
              key={window.name}
              className={cn(
                "flex justify-between gap-4 py-0.5",
                early.has(window) && "text-red-600",
              )}
            >
              <span>{window.name}</span>
              <span className="text-zinc-500">
                {inLaunchZone(window.start)}
                {window.end.getTime() !== window.start.getTime() &&
                  ` – ${inLaunchZone(window.end)}`}
              </span>
            </li>
          ))}
      </ul>
    </LaunchCheck>
  );
};

export default LaunchRemindersCheck;

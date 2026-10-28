import type { CreateReminderGroupDto } from "@alliance/shared/client";
import { subSeconds } from "date-fns";
import type { LaunchSchedule } from "./launchSchedule";

export type ReminderSendWindow = { name: string; start: Date; end: Date };

const fromDeadline = (
  schedule: LaunchSchedule,
  seconds: number | null | undefined,
) => subSeconds(schedule.officeActionAt, seconds ?? 0);

/** When each reminder sends, with the office action event as the deadline. */
export function reminderSendWindows(params: {
  bodies: CreateReminderGroupDto[];
  schedule: LaunchSchedule;
}): ReminderSendWindow[] {
  const { bodies, schedule } = params;
  return bodies.map((body) => {
    const { name } = body;
    switch (body.timingMode) {
      case "event_launch":
        return {
          name,
          start: schedule.memberActionAt,
          end: schedule.memberActionAt,
        };
      case "from_deadline": {
        const at = fromDeadline(schedule, body.sendAtSecondsFromDeadline);
        return { name, start: at, end: at };
      }
      case "within_relative_range":
        return {
          name,
          start: fromDeadline(
            schedule,
            body.relative_range_start_seconds_from_deadline,
          ),
          end: fromDeadline(
            schedule,
            body.relative_range_end_seconds_from_deadline,
          ),
        };
      case "absolute":
      case "within_range":
        throw new Error(
          `a launch reminder can't use fixed dates: ${body.timingMode}`,
        );
      default:
        throw new Error(
          `unknown timing mode: ${body.timingMode satisfies never}`,
        );
    }
  });
}

export const remindersBeforeLaunch = (
  windows: ReminderSendWindow[],
  schedule: LaunchSchedule,
) => windows.filter((window) => window.start < schedule.memberActionAt);

import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addHours,
  addMinutes,
  differenceInMinutes,
  formatDuration,
  set,
  startOfHour,
} from "date-fns";
import { millisecondsInDay, minutesInHour } from "date-fns/constants";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";

const MIN_LEAD_MINUTES = 30;

/** The member contract's completion period. */
export const COMPLETION_PERIOD_DAYS = 7;

export type LaunchSchedule = { memberActionAt: Date; officeActionAt: Date };

export const scheduleProblems = (
  schedule: LaunchSchedule,
  now: Date,
): string[] => [
  ...(schedule.memberActionAt <= now
    ? ["Members taking action must start in the future."]
    : []),
  ...(schedule.officeActionAt <= schedule.memberActionAt
    ? ["Office taking action must come after members start."]
    : []),
];

export function defaultLaunchSchedule(now: Date): LaunchSchedule {
  const earliest = new TZDate(
    addMinutes(now, MIN_LEAD_MINUTES),
    LAUNCH_TIME_ZONE,
  );
  const sevenPm = set(new TZDate(now, LAUNCH_TIME_ZONE), {
    hours: 19,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
  const onTheHour = startOfHour(earliest);
  const memberActionAt =
    sevenPm >= earliest
      ? sevenPm
      : onTheHour.getTime() === earliest.getTime()
        ? onTheHour
        : addHours(onTheHour, 1);
  const officeActionAt = set(addDays(memberActionAt, COMPLETION_PERIOD_DAYS), {
    hours: 23,
    minutes: 59,
    seconds: 0,
    milliseconds: 0,
  });
  return {
    memberActionAt: new Date(memberActionAt.getTime()),
    officeActionAt: new Date(officeActionAt.getTime()),
  };
}

/**
 * Whole days from members starting to the office deadline, by Pacific
 * wall-clock time, so the default 11:59pm deadline a period out holds across a
 * daylight saving change.
 */
export function completionDays(schedule: LaunchSchedule): number {
  const start = new TZDate(schedule.memberActionAt, LAUNCH_TIME_ZONE);
  const end = schedule.officeActionAt;
  // Pacific time's UTC offset varies by at most an hour, so n wall-clock days
  // span n × 24h ± 1h and this starts at most two days short.
  let days = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / millisecondsInDay) - 1,
  );
  while (addDays(start, days + 1) <= end) days++;
  return days;
}

/**
 * `completionDays`, then the real hours and minutes past the last whole day.
 * Those reach 24 hours on the day clocks fall back.
 */
export function completionTime(schedule: LaunchSchedule): string {
  const days = completionDays(schedule);
  const minutes = differenceInMinutes(
    schedule.officeActionAt,
    addDays(new TZDate(schedule.memberActionAt, LAUNCH_TIME_ZONE), days),
  );
  return formatDuration({
    days,
    hours: Math.floor(minutes / minutesInHour),
    minutes: minutes % minutesInHour,
  });
}

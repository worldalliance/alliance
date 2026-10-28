import { TZDate } from "@date-fns/tz";
import { addDays, addHours, addMinutes, set, startOfHour } from "date-fns";

export const LAUNCH_TIME_ZONE = "America/Los_Angeles";
const MIN_LEAD_MINUTES = 30;

export const inLaunchZone = (date: Date) =>
  `${date.toLocaleString("en-US", {
    timeZone: LAUNCH_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  })} PT`;

export type LaunchSchedule = { memberActionAt: Date; officeActionAt: Date };

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
  const officeActionAt = set(addDays(memberActionAt, 7), {
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

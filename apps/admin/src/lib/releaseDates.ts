import { TZDate } from "@date-fns/tz";
import { addDays, format, isTuesday, nextTuesday, set } from "date-fns";

export const RELEASE_TIME_ZONE = "America/Los_Angeles";

const LAUNCH_TIME = { hours: 18, minutes: 0, seconds: 0, milliseconds: 0 };
const DEADLINE_TIME = { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 };

export const defaultReleaseDates = (now: Date) => {
  const pacificNow = new TZDate(now, RELEASE_TIME_ZONE);
  const today = set(pacificNow, LAUNCH_TIME);
  const launch =
    isTuesday(pacificNow) && today > pacificNow
      ? today
      : set(nextTuesday(pacificNow), LAUNCH_TIME);
  return {
    launch: new Date(launch),
    deadline: new Date(set(addDays(launch, 7), DEADLINE_TIME)),
  };
};

export const toPacificInput = (date: Date) =>
  format(new TZDate(date, RELEASE_TIME_ZONE), "yyyy-MM-dd'T'HH:mm");

export const fromPacificInput = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  return new Date(
    new TZDate(year, month - 1, day, hours, minutes, 0, 0, RELEASE_TIME_ZONE),
  );
};

export const releaseOrderError = (launch: Date, deadline: Date | null) =>
  deadline && deadline <= launch
    ? "The deadline must be after the launch."
    : null;

export const formatPacific = (date: Date | string) =>
  format(
    new TZDate(new Date(date), RELEASE_TIME_ZONE),
    "EEE MMM d, h:mm a 'PT'",
  );

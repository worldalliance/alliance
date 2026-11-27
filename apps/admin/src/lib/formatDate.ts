type DateInput = Date | string | number;

export type FormatDateOptions = {
  /** Lead with the weekday, where the day of the week matters: "Tue, Nov 24". */
  weekday?: boolean;
  /**
   * An IANA zone, such as `LAUNCH_TIME_ZONE`, to show the date in. A time shown
   * in a named zone ends with the zone's name ("PT"). Omit for the viewer's own.
   */
  timeZone?: string;
  /** Today, for deciding whether the year is shown. */
  now?: Date;
};

const LOCALE = "en-US";
const UTC_ZONES = new Set(["UTC", "Etc/UTC"]);

/** "Nov 30", with the year only when it isn't this year: "Nov 30, 2025". */
export function formatDate(
  input: DateInput,
  { weekday = false, timeZone, now = new Date() }: FormatDateOptions = {},
): string {
  const date = new Date(input);
  const year = (d: Date) =>
    new Intl.DateTimeFormat(LOCALE, { year: "numeric", timeZone }).format(d);
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    weekday: weekday ? "short" : undefined,
    year: year(date) === year(now) ? undefined : "numeric",
    timeZone,
  }).format(date);
}

/** "7:00 PM", or "7:00 PM PT" in a named zone ("7:00 PM UTC" in UTC). */
export function formatTime(
  input: DateInput,
  { timeZone }: Pick<FormatDateOptions, "timeZone"> = {},
): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    // UTC has no generic name, so "shortGeneric" calls it "GMT+0".
    timeZoneName: timeZone
      ? UTC_ZONES.has(timeZone)
        ? "short"
        : "shortGeneric"
      : undefined,
  }).format(new Date(input));
}

/** "Nov 30, 7:00 PM"; a deadline or event passes `timeZone`: "Tue, Nov 24, 7:00 PM PT". */
export function formatDateTime(
  input: DateInput,
  options: FormatDateOptions = {},
): string {
  return `${formatDate(input, options)}, ${formatTime(input, options)}`;
}

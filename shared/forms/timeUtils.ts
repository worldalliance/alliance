const MINUTES_IN_DAY = 24 * 60;
// Seconds are optional because a Postgres `time` column renders as `HH:MM:SS`,
// while form answers and `<input type="time">` use `HH:MM`.
const TIME_24H_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const TIME_12H_REGEX = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;

export type ParsedTime = {
  minutes: number;
  normalized: string;
};

export function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = TIME_24H_REGEX.exec(trimmed);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function formatMinutesAs24h(totalMinutes: number): string {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatMinutesAs12h(totalMinutes: number): string {
  const normalized =
    ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, "0");
  return `${displayHour}:${mm} ${period}`;
}

export function parseTimeInput(raw: string): ParsedTime | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = TIME_12H_REGEX.exec(trimmed.replace(/\s+/g, " "));
  if (!match) return null;

  const hours = Number(match[1]);
  const minutesPart = match[2];
  const meridiem = match[3].toLowerCase();

  if (hours < 1 || hours > 12) return null;
  const minutes = minutesPart ? Number(minutesPart) : 0;
  if (Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  let normalizedHours = hours % 12;
  if (meridiem === "pm") {
    normalizedHours += 12;
  }

  const totalMinutes = normalizedHours * 60 + minutes;
  return {
    minutes: totalMinutes,
    normalized: formatMinutesAs24h(totalMinutes),
  };
}

export function formatTimeForDisplay(value: string | undefined | null): string {
  if (!value) return "";
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return value;
  return formatMinutesAs12h(minutes);
}

/**
 * The form a `time` column round-trips in, and what the API expects for
 * `preferredReminderTime`. The server accepts `HH:MM` too, but sending the
 * canonical form keeps what the client holds identical to what it reads back.
 */
export function formatMinutesAsWireTime(totalMinutes: number): string {
  return `${formatMinutesAs24h(totalMinutes)}:00`;
}

/** Canonicalizes a time for the wire; `null` for blank or unparseable input. */
export function toWireTime(value: string | undefined | null): string | null {
  const minutes = parseTimeToMinutes(value);
  return minutes === null ? null : formatMinutesAsWireTime(minutes);
}

/** Strips the seconds an `<input type="time">` cannot round-trip. */
export function toTimeInputValue(value: string | undefined | null): string {
  const minutes = parseTimeToMinutes(value);
  return minutes === null ? "" : formatMinutesAs24h(minutes);
}

export type TimeOfDayOption = {
  /** Wire form, so it can be sent as-is. */
  value: string;
  label: string;
};

/** Every time of day on a `stepMinutes` grid, for a picker to list. */
export function buildTimeOfDayOptions(stepMinutes: number): TimeOfDayOption[] {
  return Array.from({ length: MINUTES_IN_DAY / stepMinutes }, (_, i) => {
    const minutes = i * stepMinutes;
    return {
      value: formatMinutesAsWireTime(minutes),
      label: formatMinutesAs12h(minutes),
    };
  });
}

export { TIME_12H_REGEX };

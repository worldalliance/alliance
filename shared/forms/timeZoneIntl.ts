import { R } from "@alliance/common/result";
import {
  millisecondsInMinute,
  millisecondsInSecond,
  minutesInHour,
} from "date-fns/constants";

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();
let defaultIsEnUS: boolean | null = null;

export function resetFormatterCache(): void {
  formatterCache.clear();
  defaultIsEnUS = null;
}

type FormatterRequest = {
  key: string;
  opts: Intl.DateTimeFormatOptions;
  locale?: string;
};

// Intl refuses a zone or a style it has no data for with a RangeError, and no
// error out of it is worth taking the picker down over. An engine that
// substitutes a zone rather than refusing is still not covered.
function askIntl<T>(ask: () => T): T | null {
  return R.toNullable(R.fromThrowable(ask));
}

function getFormatter({
  key,
  opts,
  locale,
}: FormatterRequest): Intl.DateTimeFormat | null {
  let fmt = formatterCache.get(key);
  if (fmt === undefined) {
    fmt = askIntl(() => new Intl.DateTimeFormat(locale, opts));
    formatterCache.set(key, fmt);
  }
  return fmt;
}

// Hermes on Android builds a formatter for a locale it is handed in about three
// times the time it takes for its default one.
function enUS(): string | undefined {
  defaultIsEnUS ??=
    askIntl(() => new Intl.DateTimeFormat().resolvedOptions().locale) ===
    "en-US";
  return defaultIsEnUS ? undefined : "en-US";
}

// A runtime can build a formatter that formats and still not write parts, so
// the parts are asked for at the reads that need them rather than at the
// construction the clock shares. Anything but a list is a refusal too, and
// answering with it would only move the throw to the callers walking it. A
// part whose value is not a string is a refusal too, for the same reason:
// every reader below takes the value as one, and the throw would come out of
// the hook the picker renders from. The whole list goes rather than that one
// part, since a reader that finds a part missing reads the rest as if the
// engine had meant it: the dayPeriod refusal below would take a 12-hour clock
// for a 24-hour one and put the row half a day out.
function partsOf(
  fmt: Intl.DateTimeFormat | null,
  when: Date,
): Intl.DateTimeFormatPart[] | null {
  const parts = fmt && askIntl(() => fmt.formatToParts(when));
  return Array.isArray(parts) && parts.every((p) => typeof p.value === "string")
    ? parts
    : null;
}

export function formatTimeInTz(
  tz: string,
  hour12: boolean,
  when: Date,
): string | null {
  const fmt = getFormatter({
    key: `time:${tz}:${hour12}`,
    opts: {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12,
    },
  });
  return fmt ? askIntl(() => fmt.format(when)) : null;
}

// One formatter writes every zone's clock off its offset, since building one
// per zone costs Hermes on Android over a millisecond each.
export function formatTimeAtOffset(
  offsetMins: number,
  hour12: boolean,
  when: Date,
): string | null {
  return formatTimeInTz(
    "UTC",
    hour12,
    new Date(when.getTime() + offsetMins * millisecondsInMinute),
  );
}

export function formatNowTimeInTz(
  tz: string,
  hour12: boolean = true,
): string | null {
  return formatTimeInTz(tz, hour12, new Date());
}

const MAX_OFFSET_MINUTES = 16 * minutesInHour;

// The offset comes off the wall clock because JavaScriptCore renders the
// shortOffset of every zero-offset zone as a bare "GMT", which the parse below
// cannot read at all.
//
// The calendar and the numbering system are named because an engine with no
// en-US data falls back to its own locale and brings both with it; the range
// check is what catches one that ignores them.
function offsetFromWallClock(tz: string, when: Date): number | null {
  const fmt = getFormatter({
    key: `offset:${tz}`,
    opts: {
      timeZone: tz,
      hour12: false,
      hourCycle: "h23",
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
    locale: enUS(),
  });
  if (!fmt) return null;

  let wall = checkedWallClocks.has(fmt) ? wallFromString(fmt, when) : null;
  if (wall === null) {
    wall = wallFromParts(fmt, when);
    if (
      wall !== null &&
      askIntl(() => fmt.resolvedOptions().locale) === "en-US" &&
      wallFromString(fmt, when) === wall
    ) {
      checkedWallClocks.add(fmt);
    }
  }
  if (wall === null) return null;

  // The parts carry whole seconds, so the instant has to as well for the
  // difference to be the offset rather than the offset less a stray -0.4ms.
  const truncated =
    Math.floor(when.getTime() / millisecondsInSecond) * millisecondsInSecond;
  const offset = Math.round((wall - truncated) / millisecondsInMinute);
  return Math.abs(offset) > MAX_OFFSET_MINUTES ? null : offset;
}

function wallFromParts(fmt: Intl.DateTimeFormat, when: Date): number | null {
  // A 12-hour reading lands near enough to UTC for the range check above to
  // take it, and an engine can answer for the cycle it resolved or for the
  // dayPeriod without answering for both, so each is refused on its own.
  const resolved = askIntl(() => fmt.resolvedOptions());
  if (!resolved || resolved.hour12) return null;

  const parts = partsOf(fmt, when);
  if (!parts) return null;
  if (parts.some((p) => p.type === "dayPeriod")) return null;

  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    // h24 writes midnight as hour 24 on the date it belongs to.
    at("hour") % 24,
    at("minute"),
    at("second"),
  );
  return Number.isNaN(wall) ? null : wall;
}

// formatToParts costs Hermes on Android about twenty times what format does,
// and the list reads every zone's offset each minute it is open. An en-US
// formatter whose string once read the same wall clock as its parts writes
// that layout every time, so its string answers from then on.
const checkedWallClocks = new WeakSet<Intl.DateTimeFormat>();

const EN_US_WALL_CLOCK = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})$/;

function wallFromString(fmt: Intl.DateTimeFormat, when: Date): number | null {
  const written: unknown = askIntl(() => fmt.format(when));
  const m = typeof written === "string" && EN_US_WALL_CLOCK.exec(written);
  if (!m) return null;
  const [month, day, year, hour, minute, second] = m.slice(1).map(Number);
  return Date.UTC(year, month - 1, day, hour % 24, minute, second);
}

// The wall clock asks Intl for six fields and four options that shortOffset
// does not, so an engine supporting fewer of them keeps the offset it already
// had. Every zone this parse misses is one the wall clock reads, so the two
// only ever meet on a runtime that would otherwise have no offset at all.
function offsetFromShortOffset(tz: string, when: Date): number | null {
  const parts = partsOf(
    getFormatter({
      key: `shortOffset:${tz}`,
      opts: { timeZone: tz, timeZoneName: "shortOffset", hour: "2-digit" },
      locale: "en",
    }),
    when,
  );

  const m = parts
    ?.find((p) => p.type === "timeZoneName")
    ?.value.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * minutesInHour + Number(m[3] ?? 0));
}

export function getOffsetMinutes(
  tz: string,
  when: Date = new Date(),
): number | null {
  return offsetFromWallClock(tz, when) ?? offsetFromShortOffset(tz, when);
}

// Hermes on iOS breaks a name into a part per word and types only some of them
// timeZoneName, by no rule the reader can lean on: "Time" comes back
// timeZoneName for Asia/Kolkata and literal for Asia/Kathmandu. Where a name
// starts is the one boundary this engine gets right, and a name it writes
// empty leaves only the separators between its words.
//
// An engine with no en-US data answers in its own language rather than
// refusing, which would put a Vietnamese name in a row whose second line,
// search and sort are all English. The slice gives that guard a second job:
// what a locale writes after the name is its own, and the slice takes it. vi
// puts the whole date there, eu closes a bracket.
export function getGenericLabelFromIntl(tz: string): string | null {
  const fmt = getFormatter({
    key: `generic:${tz}`,
    opts: {
      timeZone: tz,
      timeZoneName: "longGeneric",
    },
    locale: enUS(),
  });

  const locale = fmt && askIntl(() => fmt.resolvedOptions().locale);
  if (typeof locale !== "string" || !/^en(-|$)/.test(locale)) return null;

  const parts = partsOf(fmt, new Date());
  if (!parts) return null;

  const start = parts.findIndex(
    (p) => p.type === "timeZoneName" && p.value.trim() !== "",
  );
  if (start < 0) return null;

  return (
    parts
      .slice(start)
      .map((p) => p.value)
      .join("")
      .trim() || null
  );
}

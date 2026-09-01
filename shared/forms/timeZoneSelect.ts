import { R } from "@alliance/common/result";
import { useEffect, useMemo, useState } from "react";
import { minuteStart, useClockMinute } from "../lib/useClockMinute";

export type TzOption = {
  group: string;
  label: string;
  tz: string;
};

export const TZ_OPTIONS: TzOption[] = [
  // US
  { group: "US", label: "Pacific Time", tz: "America/Los_Angeles" },
  { group: "US", label: "Mountain Time", tz: "America/Denver" },
  { group: "US", label: "Central Time", tz: "America/Chicago" },
  { group: "US", label: "Eastern Time", tz: "America/New_York" },
  { group: "US", label: "Alaska Time", tz: "America/Anchorage" },
  { group: "US", label: "Arizona Time", tz: "America/Phoenix" },
  { group: "US", label: "Hawaii Time", tz: "Pacific/Honolulu" },

  // Canada gets its own zones rather than sharing the US ones beside it.
  // America/Los_Angeles belongs to the US whatever an option is labelled, so
  // sharing it leaves a Vancouver member indistinguishable from a Seattle one.
  { group: "Canada", label: "Pacific Time", tz: "America/Vancouver" },
  { group: "Canada", label: "Mountain Time", tz: "America/Edmonton" },
  { group: "Canada", label: "Saskatchewan Time", tz: "America/Regina" },
  { group: "Canada", label: "Central Time", tz: "America/Winnipeg" },
  { group: "Canada", label: "Eastern Time", tz: "America/Toronto" },
  { group: "Canada", label: "Atlantic Time", tz: "America/Halifax" },
  { group: "Canada", label: "Newfoundland Time", tz: "America/St_Johns" },
  { group: "Canada", label: "Yukon Time", tz: "America/Whitehorse" },

  // America
  { group: "America", label: "Mexico City Time", tz: "America/Mexico_City" },
  {
    group: "America",
    label: "Bogota, Jamaica, Lima Time",
    tz: "America/Bogota",
  },
  { group: "America", label: "Caracas Time", tz: "America/Caracas" },
  { group: "America", label: "Santiago Time", tz: "America/Santiago" },
  {
    group: "America",
    label: "Buenos Aires Time",
    tz: "America/Argentina/Buenos_Aires",
  },
  { group: "America", label: "Brasilia Time", tz: "America/Sao_Paulo" },

  // Europe
  { group: "Europe", label: "UK, Ireland, Lisbon Time", tz: "Europe/London" },
  { group: "Europe", label: "Central European Time", tz: "Europe/Paris" },
  { group: "Europe", label: "Eastern European Time", tz: "Europe/Athens" },
  { group: "Europe", label: "Turkey Time", tz: "Europe/Istanbul" },
  { group: "Europe", label: "Moscow Time", tz: "Europe/Moscow" },

  // Africa
  { group: "Africa", label: "West Africa Time", tz: "Africa/Lagos" },
  { group: "Africa", label: "Central Africa Time", tz: "Africa/Kinshasa" },
  { group: "Africa", label: "South Africa Time", tz: "Africa/Johannesburg" },
  { group: "Africa", label: "East Africa Time", tz: "Africa/Nairobi" },
  { group: "Africa", label: "Egypt Time", tz: "Africa/Cairo" },

  // Asia
  { group: "Asia", label: "Dubai Time", tz: "Asia/Dubai" },
  { group: "Asia", label: "Tehran Time", tz: "Asia/Tehran" },
  { group: "Asia", label: "Pakistan, Maldives Time", tz: "Asia/Karachi" },
  //   { group: "Asia", label: "India, Sri Lanka Time", tz: "Asia/Kolkata" }, //TODO: react native intl does not support
  { group: "Asia", label: "Kathmandu Time", tz: "Asia/Kathmandu" },
  { group: "Asia", label: "Bangladesh Time", tz: "Asia/Dhaka" },
  { group: "Asia", label: "Indochina Time", tz: "Asia/Bangkok" },
  { group: "Asia", label: "China, Singapore, Perth", tz: "Asia/Shanghai" },
  { group: "Asia", label: "Japan, Korea Time", tz: "Asia/Tokyo" },

  // Australia
  {
    group: "Australia",
    label: "Western Australia Time",
    tz: "Australia/Perth",
  },
  {
    group: "Australia",
    label: "Central Australia Time",
    tz: "Australia/Darwin",
  },
  { group: "Australia", label: "Adelaide Time", tz: "Australia/Adelaide" },
  { group: "Australia", label: "Brisbane Time", tz: "Australia/Brisbane" },
  {
    group: "Australia",
    label: "Sydney, Melbourne Time",
    tz: "Australia/Sydney",
  },
  { group: "Australia", label: "Lord Howe Time", tz: "Australia/Lord_Howe" },

  // Pacific
  { group: "Pacific", label: "Auckland Time", tz: "Pacific/Auckland" },
  { group: "Pacific", label: "Chatham Time", tz: "Pacific/Chatham" },
  { group: "Pacific", label: "Fiji Time", tz: "Pacific/Fiji" },
  { group: "Pacific", label: "Samoa Time", tz: "Pacific/Apia" },
  { group: "Pacific", label: "Line Islands Time", tz: "Pacific/Kiritimati" },
];

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

type FormatterRequest = {
  key: string;
  opts: Intl.DateTimeFormatOptions;
  locale?: string;
};

// ECMA-402 says a runtime short of data for a zone or a style refuses with a
// RangeError, but Hermes is what this guard exists for and nobody has run it on
// Android, so no error out of Intl is worth taking the picker down over. An
// engine that substitutes a zone rather than refusing is still not covered.
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

// A runtime can build a formatter that formats and still not write parts, so
// the parts are asked for at the reads that need them rather than at the
// construction the clock shares. Anything but a list is a refusal too, and
// answering with it would only move the throw to the callers walking it.
function partsOf(
  fmt: Intl.DateTimeFormat | null,
  when: Date,
): Intl.DateTimeFormatPart[] | null {
  const parts = fmt && askIntl(() => fmt.formatToParts(when));
  return Array.isArray(parts) ? parts : null;
}

function formatTimeInTz(
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

export function formatNowTimeInTz(
  tz: string,
  hour12: boolean = true,
): string | null {
  return formatTimeInTz(tz, hour12, new Date());
}

const MAX_OFFSET_MINUTES = 16 * 60;

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
    locale: "en-US",
  });

  // A 12-hour reading lands near enough to UTC for the range check below to
  // take it, and an engine can answer for the cycle it resolved or for the
  // dayPeriod without answering for both, so each is refused on its own.
  const resolved = fmt && askIntl(() => fmt.resolvedOptions());
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
  if (Number.isNaN(wall)) return null;
  // The parts carry whole seconds, so the instant has to as well for the
  // difference to be the offset rather than the offset less a stray -0.4ms.
  const truncated = Math.floor(when.getTime() / 1000) * 1000;
  const offset = Math.round((wall - truncated) / 60_000);
  return Math.abs(offset) > MAX_OFFSET_MINUTES ? null : offset;
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
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export function getOffsetMinutes(
  tz: string,
  when: Date = new Date(),
): number | null {
  return offsetFromWallClock(tz, when) ?? offsetFromShortOffset(tz, when);
}

export function getGenericLabelFromIntl(tz: string): string | null {
  const parts = partsOf(
    getFormatter({
      key: `generic:${tz}`,
      opts: {
        timeZone: tz,
        timeZoneName: "longGeneric",
      },
      locale: "en-US",
    }),
    new Date(),
  );
  return parts?.find((p) => p.type === "timeZoneName")?.value || null;
}

export function prettyCityFromIana(tz: string): string {
  const seg = tz.split("/").pop() ?? tz;
  return seg.replace(/_/g, " ");
}

export type TimeZoneSelectItem = {
  tz: string;
  labelLeft: string;
  searchText: string;
  offsetMins: number | null;
  timeLabel: string | null;
};

export const NO_TIME_LABEL = "—";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

type BaseLabel = { tz: string; labelLeft: string; searchText: string };
let cachedLabels: BaseLabel[] | null = null;

export function resetTimeZoneCaches(): void {
  formatterCache.clear();
  cachedLabels = null;
  cachedBase = null;
}

// A zone this runtime cannot format is still one the server schedules in, so
// its row stays, under the curated label when Intl has no name for it.
function getBaseLabels(): BaseLabel[] {
  if (cachedLabels) return cachedLabels;

  cachedLabels = TZ_OPTIONS.map(({ tz, label }) => {
    const generic = getGenericLabelFromIntl(tz);
    const city = prettyCityFromIana(tz);
    const left = `${generic ?? label} — ${city}`;
    return {
      tz,
      labelLeft: left,
      searchText: `${left} ${tz}`.toLowerCase(),
    };
  });

  return cachedLabels;
}

type BaseItem = Omit<TimeZoneSelectItem, "timeLabel">;

let cachedBase: { minute: number; items: BaseItem[] } | null = null;

// Keyed on the minute and shared by every picker on the page, so opening one a
// second time, or closing it, costs nothing.
function baseItems(minute: number): BaseItem[] {
  if (cachedBase?.minute === minute) return cachedBase.items;

  const when = minuteStart(minute);
  const items = getBaseLabels().map((label) => ({
    ...label,
    offsetMins: getOffsetMinutes(label.tz, when),
  }));

  items.sort(
    (a, b) =>
      (a.offsetMins ?? 0) - (b.offsetMins ?? 0) ||
      a.labelLeft.localeCompare(b.labelLeft),
  );

  cachedBase = { minute, items };
  return items;
}

export type UseTimeZoneSelectParams = {
  value?: string;
  defaultValue?: string;
  onChange?: (tz: string) => void;
  hour12?: boolean;
  disabled?: boolean;
};

export function useTimeZoneSelect({
  value,
  defaultValue = DEFAULT_TIMEZONE,
  onChange,
  hour12 = true,
  disabled,
}: UseTimeZoneSelectParams) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [internalValue, setInternalValue] = useState<string>(
    value ?? defaultValue,
  );

  // The closed trigger shows a clock too, so the refresh cannot wait for open.
  const minute = useClockMinute();

  useEffect(() => {
    if (value != null) setInternalValue(value);
  }, [value]);

  const base = useMemo(() => baseItems(minute), [minute]);

  const items = useMemo<TimeZoneSelectItem[]>(() => {
    const when = minuteStart(minute);
    return base.map((item) => ({
      ...item,
      timeLabel: formatTimeInTz(item.tz, hour12, when),
    }));
  }, [base, hour12, minute]);

  const selected = useMemo<TimeZoneSelectItem>(() => {
    const when = minuteStart(minute);
    return (
      items.find((i) => i.tz === internalValue) ?? {
        tz: internalValue,
        labelLeft: internalValue,
        searchText: internalValue.toLowerCase(),
        offsetMins: getOffsetMinutes(internalValue, when),
        timeLabel: formatTimeInTz(internalValue, hour12, when),
      }
    );
  }, [items, internalValue, hour12, minute]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? items.filter((i) => i.searchText.includes(q)) : items;
    return list;
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const commit = (tz: string) => {
    if (disabled) return;
    if (value == null) setInternalValue(tz);
    onChange?.(tz);
    setOpen(false);
  };

  return {
    items,
    filtered,
    selected,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    commit,
    open,
    setOpen,
    disabled,
  };
}

import { R } from "@alliance/common/result";
import {
  type CountryCode,
  getAllCountries,
  getAllTimezones,
  getTimezone,
} from "countries-and-timezones";
import {
  millisecondsInMinute,
  millisecondsInSecond,
  minutesInHour,
} from "date-fns/constants";
import { deburr, groupBy } from "es-toolkit";
import { useEffect, useMemo, useState } from "react";
import { minuteStart, useClockMinute } from "../lib/useClockMinute";

export type TzCountry = {
  name: string;
  /** Names a search finds the country by that tzdata does not use. */
  alsoCalled: string[];
};

export type TzOption = {
  tz: string;
  countries: TzCountry[];
};

const UTC_ZONE = "Etc/UTC";
const ANTARCTICA = "AQ";
const COUNTRIES = getAllCountries();

const ALSO_CALLED: Partial<Record<CountryCode, string[]>> = {
  AE: ["UAE"],
  CD: ["DRC"],
  CI: ["Côte d'Ivoire"],
  CV: ["Cape Verde"],
  CZ: ["Czech Republic"],
  GB: [
    "UK",
    "Great Britain",
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
  ],
  MM: ["Burma"],
  NL: ["Holland"],
  SZ: ["Swaziland"],
  TL: ["East Timor"],
  TR: ["Turkey"],
  US: ["United States", "USA", "US", "America"],
  VA: ["Vatican"],
};

// A country's zones sort west to east like every other row, which buries the
// one nearly everyone searching for that country means: Honolulu for "usa",
// Urumqi for "china", Beulah, North Dakota for "central". The zones below lead
// the rows they tie with. No field in tzdata picks them out; nothing there says
// Denver over Boise.
export const PRINCIPAL_ZONES: Partial<Record<CountryCode, string[]>> = {
  AR: ["America/Argentina/Buenos_Aires"],
  AU: ["Australia/Sydney"],
  BR: ["America/Sao_Paulo"],
  CA: [
    "America/Toronto",
    "America/Vancouver",
    "America/Edmonton",
    "America/Winnipeg",
    "America/Halifax",
    "America/St_Johns",
  ],
  CL: ["America/Santiago"],
  CN: ["Asia/Shanghai"],
  EC: ["America/Guayaquil"],
  ES: ["Europe/Madrid"],
  FR: ["Europe/Paris"],
  ID: ["Asia/Jakarta"],
  KZ: ["Asia/Almaty"],
  MX: ["America/Mexico_City"],
  NZ: ["Pacific/Auckland"],
  PT: ["Europe/Lisbon"],
  RU: ["Europe/Moscow"],
  UA: ["Europe/Kyiv"],
  US: [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
  ],
  UZ: ["Asia/Tashkent"],
};

const PRINCIPAL_TZS = new Set<string>(Object.values(PRINCIPAL_ZONES).flat());

const tzCountry = (code: CountryCode): TzCountry => ({
  name: COUNTRIES[code].name,
  alsoCalled: ALSO_CALLED[code] ?? [],
});

// Of the zones no country claims, UTC is the only one a member means: the rest
// are Factory and Etc/GMT±N, whose sign runs opposite to the offset.
//
// Antarctica stays only on a zone no country shares, or Singapore's row reads
// "Singapore · Antarctica · Malaysia".
export const TZ_OPTIONS: TzOption[] = Object.values(getAllTimezones())
  .filter(({ name, countries }) => countries.length > 0 || name === UTC_ZONE)
  .map(({ name, countries }) => ({
    tz: name,
    countries: countries
      .filter((code) => code !== ANTARCTICA || countries.length === 1)
      .map(tzCountry),
  }));

const CITY_AREA =
  /^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\//;

// tzdata keeps a retired or merged zone as a link to the zone that replaced it,
// so Africa/Kinshasa and Asia/Calcutta have no row of their own. A link outside
// the Area/City folders, like Brazil/West, ends in no place, and would find
// Manaus for "west".
const LINKED_ZONES = groupBy(
  Object.values(getAllTimezones({ deprecated: true })).flatMap(
    ({ name, aliasOf }) =>
      aliasOf && CITY_AREA.test(name) ? [{ name, aliasOf }] : [],
  ),
  ({ aliasOf }): string => aliasOf,
);

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

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
  const truncated =
    Math.floor(when.getTime() / millisecondsInSecond) * millisecondsInSecond;
  const offset = Math.round((wall - truncated) / millisecondsInMinute);
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
function getGenericLabelFromIntl(tz: string): string | null {
  const fmt = getFormatter({
    key: `generic:${tz}`,
    opts: {
      timeZone: tz,
      timeZoneName: "longGeneric",
    },
    locale: "en-US",
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

function prettyCityFromIana(tz: string): string {
  const seg = tz.split("/").pop() ?? tz;
  return seg.replace(/_/g, " ");
}

// What an id says between its area and its city: North_Dakota, Argentina,
// Indiana. The area itself is no help to a search, since it would put every
// Pacific/* island ahead of Pacific Time and answer "indian" with the Indian
// Ocean.
const regionsOf = (tz: string) => tz.split("/").slice(1, -1);

export type TimeZoneSelectItem = {
  tz: string;
  labelLeft: string;
  labelSub: string | null;
  searchText: string;
  /** What the row holds as its own: its city, the name Intl gives the zone, and
   * the names of the country tzdata lists first for it. */
  ownNames: string[];
  /** The names of the other countries the zone lists. */
  sharedNames: string[];
  offsetMins: number | null;
  timeLabel: string | null;
};

export const NO_TIME_LABEL = "—";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

const NO_ACTIVE_ROW = -1;

type BaseLabel = Omit<TimeZoneSelectItem, "offsetMins" | "timeLabel">;
let cachedLabels: BaseLabel[] | null = null;

export function resetTimeZoneCaches(): void {
  formatterCache.clear();
  cachedLabels = null;
  cachedBase = null;
}

// Both sides of a search fold, so "São Paulo" reaches a row spelled Sao Paulo.
const fold = (text: string) => deburr(text).toLowerCase();

const WORD_CHAR = /[\p{L}\p{N}]/u;

// A query lands on the start of a word, or "China" reaches Indochina Time and
// the list opens on a row an hour out.
function matchesQuery({
  foldedText,
  foldedQuery,
}: {
  foldedText: string;
  foldedQuery: string;
}): boolean {
  for (
    let at = foldedText.indexOf(foldedQuery);
    at >= 0;
    at = foldedText.indexOf(foldedQuery, at + 1)
  ) {
    if (at === 0 || !WORD_CHAR.test(foldedText[at - 1])) return true;
  }
  return false;
}

const namesOf = ({ name, alsoCalled }: TzCountry) => [name, ...alsoCalled];

// A zone this runtime cannot format is still one the server schedules in, so
// its row stays, under its city alone when Intl has no name for it.
function labelFor({ tz, countries }: TzOption): BaseLabel {
  const generic = getGenericLabelFromIntl(tz);
  const city = prettyCityFromIana(tz);
  const left = generic ? `${generic} — ${city}` : city;
  return {
    tz,
    labelLeft: left,
    // A country name can hold a comma: "Saint Helena, Ascension and Tristan da Cunha".
    labelSub: countries.map(({ name }) => name).join(" · ") || null,
    searchText: fold(
      [
        left,
        ...countries.flatMap(namesOf),
        ...regionsOf(tz),
        ...(LINKED_ZONES[tz] ?? []).map(({ name }) => prettyCityFromIana(name)),
      ].join(" "),
    ),
    ownNames: [
      city,
      // Intl gives Denver "Mountain Time" and the zones beside it that skip DST
      // "Mountain Standard Time", so "mountain" leads with Denver's family.
      ...(generic ? [generic.replace(/ Time$/, "")] : []),
      ...countries.slice(0, 1).flatMap(namesOf),
    ].map(fold),
    sharedNames: countries.slice(1).flatMap(namesOf).map(fold),
  };
}

function getBaseLabels(): BaseLabel[] {
  if (cachedLabels) return cachedLabels;

  cachedLabels = TZ_OPTIONS.map(labelFor);
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
      Number(a.offsetMins === null) - Number(b.offsetMins === null) ||
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
  const [open, setOpenState] = useState(false);
  const [query, setQueryState] = useState("");
  const [activeOverride, setActiveOverride] = useState<number | null>(null);
  const [internalValue, setInternalValue] = useState<string>(
    value ?? defaultValue,
  );

  // The closed trigger shows a clock too, so the refresh cannot wait for open.
  const minute = useClockMinute();

  useEffect(() => {
    if (value != null) setInternalValue(value);
  }, [value]);

  // The list asks Intl for about three formatters a zone, so a trigger labels
  // itself from the saved zone alone until the picker first opens. The list then
  // stays, since a modal still renders it while animating closed.
  const [listed, setListed] = useState(false);
  if (open && !listed) setListed(true);

  const base = useMemo(
    () => (listed ? baseItems(minute) : []),
    [listed, minute],
  );

  const items = useMemo<TimeZoneSelectItem[]>(() => {
    const when = minuteStart(minute);
    return base.map((item) => ({
      ...item,
      timeLabel: formatTimeInTz(item.tz, hour12, when),
    }));
  }, [base, hour12, minute]);

  const selected = useMemo<TimeZoneSelectItem>(() => {
    const when = minuteStart(minute);
    const resolved = getTimezone(internalValue)?.aliasOf ?? internalValue;
    const current = resolved === "Etc/GMT" ? UTC_ZONE : resolved;
    const option = TZ_OPTIONS.find(({ tz }) => tz === current);
    const row = option
      ? labelFor(option)
      : {
          tz: internalValue,
          labelLeft: internalValue,
          labelSub: null,
          searchText: fold(internalValue),
          ownNames: [],
          sharedNames: [],
        };
    return {
      ...row,
      offsetMins: getOffsetMinutes(row.tz, when),
      timeLabel: formatTimeInTz(row.tz, hour12, when),
    };
  }, [internalValue, hour12, minute]);

  // A row the query names leads: "india" opens on Kolkata, not the Indiana
  // zones. The city or the country tzdata lists first outranks any other country
  // on the row, so "vietnam" opens on Ho Chi Minh rather than Bangkok, and
  // "netherlands", first on no zone, on Brussels. Rows that tie there put their
  // country's principal zone first.
  //
  // Enter on web saves the active row, so the first row starts active only when
  // it ranks alone. "eastern" leads with New York, which a Canadian member did
  // not mean.
  const { filtered, leadIndex } = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return { filtered: items, leadIndex: NO_ACTIVE_ROW };
    const rank = ({ ownNames, sharedNames }: TimeZoneSelectItem) =>
      ownNames.includes(q) ? 0 : sharedNames.includes(q) ? 1 : 2;
    const matches = items
      .filter((item) =>
        matchesQuery({ foldedText: item.searchText, foldedQuery: q }),
      )
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          Number(PRINCIPAL_TZS.has(b.tz)) - Number(PRINCIPAL_TZS.has(a.tz)),
      );
    const [first, second] = matches;
    const singledOut = first && (!second || rank(first) < rank(second));
    return { filtered: matches, leadIndex: singledOut ? 0 : NO_ACTIVE_ROW };
  }, [items, query]);

  // An override rather than a reset on open, which would land after the
  // trigger's ArrowDown and wipe the row it asked for.
  const activeIndex = activeOverride ?? leadIndex;

  // Opening starts a fresh search. Closing leaves the query alone, or the list
  // would repopulate behind a modal still fading out.
  const setOpen = (next: boolean) => {
    if (next) {
      setQueryState("");
      setActiveOverride(null);
    }
    setOpenState(next);
  };

  const setQuery = (next: string) => {
    setQueryState(next);
    setActiveOverride(null);
  };

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
    setActiveIndex: (index: number) => setActiveOverride(index),
    commit,
    open,
    setOpen,
    disabled,
  };
}

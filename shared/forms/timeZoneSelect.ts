import { isCatalogued, isTimeZoneIdentifier } from "@alliance/common/timezone";
import {
  TIME_ZONE_ALIASES,
  TIME_ZONE_CATALOG,
  type TimeZoneCatalogEntry,
} from "@alliance/common/timezone-catalog.gen";
import { minutesInHour } from "date-fns/constants";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { minuteStart, useClockMinute } from "../lib/useClockMinute";
import { fold } from "./optionSearch";
import { aliasesOf } from "./timeZoneAliases";
import { commonCountryNamesOf, curatedNamesOf } from "./timeZoneCuratedNames";
import {
  formatTimeAtOffset,
  formatTimeInTz,
  getGenericLabelFromIntl,
  getOffsetMinutes,
  resetFormatterCache,
} from "./timeZoneIntl";

export type TimeZoneSelectItem = {
  tz: string;
  city: string;
  zoneName: string | null;
  labelLeft: string;
  /** Country and current UTC offset. */
  labelSub: string | null;
  searchText: string;
  placeNames: string[];
  curatedNames: string[];
  offsetMins: number | null;
  offsetName: string | null;
  timeLabel: string | null;
};

export const NO_TIME_LABEL = "—";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

type BaseLabel = {
  tz: string;
  city: string;
  country: string | null;
  zoneName: string | null;
  labelLeft: string;
  searchText: string;
  placeNames: string[];
  curatedNames: string[];
};
const cachedLabels: BaseLabel[] = [];
let warming: number | null = null;

export function resetTimeZoneCaches(): void {
  resetFormatterCache();
  cachedLabels.length = 0;
  cachedBase = null;
  if (warming !== null) cancelIdleCallback(warming);
  warming = null;
}

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

// So "india" puts Kolkata ahead of the Indiana zones before it in offset order.
function rankFor(item: TimeZoneSelectItem, foldedQuery: string): number {
  if (item.curatedNames.includes(foldedQuery)) return 0;
  if (item.placeNames.includes(foldedQuery)) return 1;
  if (item.curatedNames.some((name) => name.startsWith(foldedQuery))) return 2;
  if (item.placeNames.some((name) => name.startsWith(foldedQuery))) return 3;
  return 4;
}

const search = (items: TimeZoneSelectItem[], foldedQuery: string) =>
  items
    .filter((i) => matchesQuery({ foldedText: i.searchText, foldedQuery }))
    .sort((a, b) => rankFor(a, foldedQuery) - rankFor(b, foldedQuery));

type OffsetQuery = { name: string; prefix: string | null };

// So "utc-1" puts UTC-1 ahead of UTC-11, which sorts before it.
const byOffset = (items: TimeZoneSelectItem[], { name, prefix }: OffsetQuery) =>
  items
    .filter(
      (i) =>
        i.offsetName === name ||
        (prefix !== null && i.offsetName?.startsWith(prefix)),
    )
    .sort(
      (a, b) =>
        Number(b.offsetName === name) - Number(a.offsetName === name) ||
        Number(b.tz === "UTC") - Number(a.tz === "UTC"),
    );

// A query with no letters names no place, and "-" would otherwise open on the
// Congo zones CLDR writes "Congo - Kinshasa".
const LETTER = /\p{L}/u;

const OFFSET_QUERY =
  /^(utc|gmt)?\s*([+\-\u2212]?)\s*(?:(\d{1,2})?:(\d{0,2})|(\d{0,4}))$/;

// Packed digits take two of hour where those are 14 or less, so "+053" is
// partway to UTC+5:30 rather than UTC+0:53, and "+530" is UTC+5:30.
function splitPacked(digits: string): [string, string] {
  if (digits.length <= 2) return [digits, ""];
  const hourDigits = Number(digits.slice(0, 2)) <= 14 ? 2 : 1;
  return [digits.slice(0, hourDigits), digits.slice(hourDigits)];
}

// "gmt+01:00", "+1", and "utc 1" name the offset a row writes as "UTC+1". Two
// hour digits or a colon end the hour, so "utc+01" leaves out UTC+10 to
// UTC+14, and two minute digits or a 0, which starts no zone's minutes, end
// the offset. Pasted offsets often carry U+2212 for their minus.
function asOffsetName(foldedQuery: string): OffsetQuery | null {
  const match = OFFSET_QUERY.exec(foldedQuery);
  if (!match) return null;
  const [, utc, typedSign, typedHours, typedMinutes, packed] = match;
  const sign = typedSign?.replace("\u2212", "-");
  const [hours, minutes] =
    typedMinutes === undefined
      ? splitPacked(packed ?? "")
      : [typedHours ?? "", typedMinutes];
  if (!sign && !(utc && hours)) return null;
  if (!hours) return { name: `utc${sign}`, prefix: `utc${sign}` };
  const whole = !Number(minutes);
  const signed = Number(hours) === 0 && whole ? "+" : sign || "+";
  const name = `utc${signed}${Number(hours)}${whole ? "" : `:${minutes}`}`;
  if (minutes.length === 2 || minutes === "0") return { name, prefix: null };
  const hourDone = hours.length === 2 || typedMinutes !== undefined;
  return { name, prefix: whole && hourDone ? `${name}:` : name };
}

// No row spells "hawaii time" or "moscow time", so a query finding nothing
// retries without the "time" after the place, or as much of it as is typed.
const TRAILING_TIME = /\s+t(?:i(?:me?)?)?$/;

// Intl names a zone it has no name for, such as UTC, by its offset, which the
// second line already shows. Where ICU writes a zero offset as plain "GMT",
// UTC's name is just that.
const OFFSET_NAME = /^GMT(?:[+-]|$)/;

// CLDR writes "Trinidad & Tobago", "Côte d’Ivoire", "St. Lucia",
// "Guinea-Bissau", "U.S. Virgin Islands", and "Myanmar (Burma)", and tzdb
// "St Johns", where many type "and", "'", "Saint", or no punctuation.
function typedPlaces(name: string): string[] {
  const spelled = name.replace(/&/g, "and").replace(/’/g, "'");
  return [
    spelled,
    spelled.replace(/\bSt\.? /g, "Saint "),
    spelled.replace(/[.'()]/g, "").replace(/\s*-\s*/g, " "),
  ];
}

function labelFor({ tz, city, country }: TimeZoneCatalogEntry): BaseLabel {
  const intlName = getGenericLabelFromIntl(tz);
  const generic = intlName && !OFFSET_NAME.test(intlName) ? intlName : null;
  const curated = curatedNamesOf(tz);
  const placeNames = [
    ...new Set(
      [
        city,
        ...typedPlaces(city),
        ...(country ? [country, ...typedPlaces(country)] : []),
        ...curated,
        ...commonCountryNamesOf(tz),
      ].map(fold),
    ),
  ];
  return {
    tz,
    city,
    country,
    zoneName: generic,
    labelLeft: generic ? `${generic} · ${city}` : city,
    searchText: fold(
      [generic, ...placeNames, tz, ...aliasesOf(tz)].filter(Boolean).join(" "),
    ),
    placeNames,
    curatedNames: curated.map(fold),
  };
}

const allLabelled = () => cachedLabels.length === TIME_ZONE_CATALOG.length;

function labelNext(): TimeZoneCatalogEntry {
  const entry = TIME_ZONE_CATALOG[cachedLabels.length];
  cachedLabels.push(labelFor(entry));
  return entry;
}

function getBaseLabels(): BaseLabel[] {
  while (!allLabelled()) labelNext();
  return cachedLabels;
}

const canWarm = () => typeof requestIdleCallback === "function";

// A browser that never idles would leave the list spinning, so it runs a step
// after this long regardless, with no time remaining, and the step labels for
// FORCED_STEP_MS. React Native flags a step this late as timed out yet still
// gives it idle time, so only a step starting with none is forced, and a
// React Native step yields once the scheduler takes that time back.
const WARM_STEP_TIMEOUT = { timeout: 100 };
const FORCED_STEP_MS = 8;

const labelledListeners = new Set<() => void>();

function subscribeLabelled(listener: () => void): () => void {
  labelledListeners.add(listener);
  return () => labelledListeners.delete(listener);
}

// Building every zone's formatters takes seconds on Android's Hermes, so a
// mounted picker builds them a zone at a time while the runtime is idle, and
// an open before that ends waits for it rather than freezing the app.
function warmWhileIdle(): void {
  if (!canWarm()) return;
  if (warming !== null || allLabelled()) return;
  const step = (deadline: IdleDeadline) => {
    const now = new Date();
    const forced = deadline.didTimeout && deadline.timeRemaining() <= 0;
    const forcedUntil = performance.now() + FORCED_STEP_MS;
    while (!allLabelled()) {
      const { tz } = labelNext();
      getOffsetMinutes(tz, now);
      if (
        deadline.timeRemaining() <= 0 &&
        (!forced || performance.now() >= forcedUntil)
      )
        break;
    }
    if (!allLabelled()) {
      warming = requestIdleCallback(step, WARM_STEP_TIMEOUT);
      return;
    }
    warming = null;
    for (const listener of labelledListeners) listener();
  };
  warming = requestIdleCallback(step, WARM_STEP_TIMEOUT);
}

// A saved or detected zone the catalog lacks, such as a device's Etc/GMT+8 or
// a zone newer than the pinned tzdb, is still the member's own, so it gets a
// row named after its identifier.
function uncataloguedLabel(tz: string): BaseLabel | null {
  if (isCatalogued(tz)) return null;
  if (!isTimeZoneIdentifier(tz)) return null;
  return labelFor({ tz, city: tz, country: null });
}

const CATALOG_BY_TZ = new Map(
  TIME_ZONE_CATALOG.map((entry) => [entry.tz, entry]),
);

function selectedLabel(tz: string): BaseLabel | null {
  const entry = CATALOG_BY_TZ.get(TIME_ZONE_ALIASES.get(tz) ?? tz);
  return entry ? labelFor(entry) : null;
}

function rowTzOf(tz: string): string | null {
  const listed = TIME_ZONE_ALIASES.get(tz) ?? tz;
  if (CATALOG_BY_TZ.has(listed)) return listed;
  return isTimeZoneIdentifier(tz) ? tz : null;
}

function formatOffset(mins: number): string {
  const abs = Math.abs(mins);
  const hours = Math.floor(abs / minutesInHour);
  const rest = abs % minutesInHour;
  return `UTC${mins < 0 ? "-" : "+"}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

type BaseItem = Omit<TimeZoneSelectItem, "timeLabel">;

function withOffset(label: BaseLabel, when: Date): BaseItem {
  const offsetMins = getOffsetMinutes(label.tz, when);
  const offset = offsetMins === null ? null : formatOffset(offsetMins);
  const sub = [label.country, offset].filter(Boolean);
  return {
    tz: label.tz,
    city: label.city,
    zoneName: label.zoneName,
    labelLeft: label.labelLeft,
    labelSub: sub.length ? sub.join(" · ") : null,
    searchText: label.searchText,
    placeNames: label.placeNames,
    curatedNames: label.curatedNames,
    offsetMins,
    offsetName: offset?.toLowerCase() ?? null,
  };
}

function unlabelledItem(tz: string, when: Date): BaseItem {
  const offsetMins = getOffsetMinutes(tz, when);
  return {
    tz,
    city: tz,
    zoneName: null,
    labelLeft: tz,
    labelSub: null,
    searchText: fold(tz),
    placeNames: [],
    curatedNames: [],
    offsetMins,
    offsetName:
      offsetMins === null ? null : formatOffset(offsetMins).toLowerCase(),
  };
}

const clockOf = (item: BaseItem, hour12: boolean, when: Date) =>
  item.offsetMins === null
    ? formatTimeInTz(item.tz, hour12, when)
    : formatTimeAtOffset(item.offsetMins, hour12, when);

// localeCompare costs Hermes on Android twelve times what one collator does.
const collator = new Intl.Collator();

const byOffsetThenLocation = (a: BaseItem, b: BaseItem) =>
  Number(a.offsetMins === null) - Number(b.offsetMins === null) ||
  (a.offsetMins ?? 0) - (b.offsetMins ?? 0) ||
  collator.compare(a.city, b.city);

let cachedBase: { minute: number; items: BaseItem[] } | null = null;

// Keyed on the minute and shared by every picker on the page, so opening one a
// second time, or closing it, costs nothing.
function baseItems(minute: number): BaseItem[] {
  if (cachedBase?.minute === minute) return cachedBase.items;

  const when = minuteStart(minute);
  const items = getBaseLabels()
    .map((label) => withOffset(label, when))
    .sort(byOffsetThenLocation);

  cachedBase = { minute, items };
  return items;
}

export type UseTimeZoneSelectParams = {
  value?: string;
  defaultValue?: string;
  onChange?: (tz: string) => void;
  hour12?: boolean;
  disabled?: boolean;
  deviceTimeZone?: string;
};

export function useTimeZoneSelect({
  value,
  defaultValue = DEFAULT_TIMEZONE,
  onChange,
  hour12 = true,
  disabled,
  deviceTimeZone,
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

  // The closed trigger shows only the selected zone, so mounting a page of
  // pickers labels other zones only a zone at a time in the background. The
  // list stays once built, since the mobile modal keeps showing it as it fades
  // out, but refreshes only while open.
  const [listedMinute, setListedMinute] = useState<number | null>(null);
  if (open && listedMinute !== minute) setListedMinute(minute);

  useEffect(warmWhileIdle, []);

  const labelled = useSyncExternalStore(
    subscribeLabelled,
    allLabelled,
    allLabelled,
  );
  const loading = !labelled && canWarm();

  const uncatalogued = useMemo(
    () => uncataloguedLabel(internalValue),
    [internalValue],
  );
  const uncataloguedDevice = useMemo(
    () =>
      deviceTimeZone === undefined || deviceTimeZone === internalValue
        ? null
        : uncataloguedLabel(deviceTimeZone),
    [deviceTimeZone, internalValue],
  );
  const deviceTz = useMemo(
    () => (deviceTimeZone === undefined ? null : rowTzOf(deviceTimeZone)),
    [deviceTimeZone],
  );

  const items = useMemo<TimeZoneSelectItem[]>(() => {
    if (listedMinute === null || loading) return [];
    const when = minuteStart(listedMinute);
    const base = baseItems(listedMinute);
    const extra = [uncatalogued, uncataloguedDevice].filter((l) => l !== null);
    const rows = extra.length
      ? [...base, ...extra.map((l) => withOffset(l, when))].sort(
          byOffsetThenLocation,
        )
      : base;
    return rows.map((item) => ({
      ...item,
      timeLabel: clockOf(item, hour12, when),
    }));
  }, [listedMinute, loading, uncatalogued, uncataloguedDevice, hour12]);

  const label = useMemo(
    () => selectedLabel(internalValue) ?? uncatalogued,
    [internalValue, uncatalogued],
  );

  const selected = useMemo<TimeZoneSelectItem>(() => {
    const when = minuteStart(minute);
    const item = label
      ? withOffset(label, when)
      : unlabelledItem(internalValue, when);
    return { ...item, timeLabel: clockOf(item, hour12, when) };
  }, [label, internalValue, hour12, minute]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) {
      const device = items.find((i) => i.tz === deviceTz);
      return device ? [device, ...items.filter((i) => i !== device)] : items;
    }
    // A query naming a zone, as "gmt+0" names UTC, lists it ahead of the other
    // zones at the offset it reads as.
    const searchFor = (typed: string) => {
      const byName = LETTER.test(typed) ? search(items, typed) : [];
      const offset = asOffsetName(typed);
      return offset === null
        ? byName
        : [...new Set([...byName, ...byOffset(items, offset)])];
    };
    const found = searchFor(q);
    const place = q.replace(TRAILING_TIME, "");
    return found.length || place === q ? found : searchFor(place);
  }, [items, query, deviceTz]);

  const selectedIndex = filtered.findIndex((i) => i.tz === selected.tz);

  useEffect(() => {
    setActiveIndex(query ? 0 : Math.max(selectedIndex, 0));
  }, [query, open, selectedIndex]);

  // Cleared on close rather than on open: the mobile trigger scrolls the
  // still-mounted list by index as it reopens, before a clear could render.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

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
    selectedIndex,
    deviceTz,
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    commit,
    open,
    setOpen,
    disabled,
    loading,
  };
}

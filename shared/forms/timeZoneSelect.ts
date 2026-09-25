import {
  TIME_ZONE_CATALOG,
  type TimeZoneCatalogEntry,
} from "@alliance/common/timezone-catalog.gen";
import { minutesInHour } from "date-fns/constants";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { minuteStart, useClockMinute } from "../lib/useClockMinute";
import { fold } from "./optionSearch";
import { aliasesOf } from "./timeZoneAliases";
import { curatedNamesOf } from "./timeZoneCuratedNames";
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

// No row spells "hawaii time" or "moscow time", so a query finding nothing
// retries without the "time" after the place, or as much of it as is typed.
const TRAILING_TIME = /\s+t(?:i(?:me?)?)?$/;

// Intl names a zone it has no name for, such as UTC, by its offset, which the
// second line already shows.
const OFFSET_NAME = /^GMT[+-]/;

function labelFor({ tz, city, country }: TimeZoneCatalogEntry): BaseLabel {
  const intlName = getGenericLabelFromIntl(tz);
  const generic = intlName && !OFFSET_NAME.test(intlName) ? intlName : null;
  const curated = curatedNamesOf(tz);
  const places = [city, country, ...curated].filter((name) => name != null);
  return {
    tz,
    city,
    country,
    zoneName: generic,
    labelLeft: generic ? `${generic} · ${city}` : city,
    searchText: fold(
      [generic, ...places, tz, ...aliasesOf(tz)].filter(Boolean).join(" "),
    ),
    placeNames: places.map(fold),
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

const CATALOG_BY_TZ = new Map(
  TIME_ZONE_CATALOG.map((entry) => [entry.tz, entry]),
);

function selectedLabel(tz: string): BaseLabel | null {
  const entry = CATALOG_BY_TZ.get(tz);
  return entry ? labelFor(entry) : null;
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
  const sub = [
    label.country,
    offsetMins === null ? null : formatOffset(offsetMins),
  ].filter(Boolean);
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

  const items = useMemo<TimeZoneSelectItem[]>(() => {
    if (listedMinute === null || loading) return [];
    const when = minuteStart(listedMinute);
    return baseItems(listedMinute).map((item) => ({
      ...item,
      timeLabel: clockOf(item, hour12, when),
    }));
  }, [listedMinute, loading, hour12]);

  const label = useMemo(() => selectedLabel(internalValue), [internalValue]);

  const selected = useMemo<TimeZoneSelectItem>(() => {
    const when = minuteStart(minute);
    const item: BaseItem = label
      ? withOffset(label, when)
      : {
          tz: internalValue,
          city: internalValue,
          zoneName: null,
          labelLeft: internalValue,
          labelSub: null,
          searchText: fold(internalValue),
          placeNames: [],
          curatedNames: [],
          offsetMins: getOffsetMinutes(internalValue, when),
        };
    return { ...item, timeLabel: clockOf(item, hour12, when) };
  }, [label, internalValue, hour12, minute]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return items;
    const found = search(items, q);
    const place = q.replace(TRAILING_TIME, "");
    return found.length || place === q ? found : search(items, place);
  }, [items, query]);

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

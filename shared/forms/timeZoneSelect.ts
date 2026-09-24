import { useEffect, useMemo, useState } from "react";
import { minuteStart, useClockMinute } from "../lib/useClockMinute";
import { fold } from "./optionSearch";
import { aliasesOf } from "./timeZoneAliases";
import {
  formatTimeAtOffset,
  formatTimeInTz,
  getGenericLabelFromIntl,
  getOffsetMinutes,
  resetFormatterCache,
} from "./timeZoneIntl";

export type TzOption = {
  group: string;
  label: string;
  tz: string;
  /** Names a search matches the row on, beyond what its labels write. */
  searchTerms?: string[];
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
  {
    group: "Europe",
    label: "UK, Ireland, Lisbon Time",
    tz: "Europe/London",
    searchTerms: ["Greenwich"],
  },
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
  { group: "Asia", label: "India, Sri Lanka Time", tz: "Asia/Kolkata" },
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

function prettyCityFromIana(tz: string): string {
  const seg = tz.split("/").pop() ?? tz;
  return seg.replace(/_/g, " ");
}

export type TimeZoneSelectItem = {
  tz: string;
  labelLeft: string;
  /** The line under the name: the curated label where it names a place the
   * name does not, or the search term the query matched. */
  labelSub: string | null;
  searchTerms: string[];
  searchText: string;
  offsetMins: number | null;
  timeLabel: string | null;
};

export const NO_TIME_LABEL = "—";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

type BaseLabel = {
  tz: string;
  labelLeft: string;
  labelSub: string | null;
  searchTerms: string[];
  searchText: string;
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

const wordsOf = (text: string) => fold(text).match(/\p{L}+/gu) ?? [];

// "Australian Western Standard Time" already says "Western Australia Time" and
// "Türkiye Time" says "Turkey Time", so two words on a shared stem count as one
// word said.
const sameWord = (a: string, b: string) =>
  a === b ||
  (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));

// Most of the list would carry a second line otherwise, and most of those
// would repeat the first: "Gulf Standard Time — Dubai" over "Dubai Time".
function namesMoreThan({
  label,
  shown,
}: {
  label: string;
  shown: string;
}): boolean {
  const said = wordsOf(shown);
  return wordsOf(label).some(
    (word) => word !== "time" && !said.some((seen) => sameWord(word, seen)),
  );
}

// A zone this runtime cannot format is still one the server schedules in, so
// its row stays, under the curated label when Intl has no name for it.
//
// It stays searchable where Intl's name displaces it: Intl calls Asia/Kolkata
// "India Standard Time", which answers nobody searching for Sri Lanka.
function labelFor({
  tz,
  label,
  searchTerms: curated = [],
}: TzOption): BaseLabel {
  const generic = getGenericLabelFromIntl(tz);
  const city = prettyCityFromIana(tz);
  const left = `${generic ?? label} — ${city}`;
  const searchTerms = [...curated, ...aliasesOf(tz)];
  const searchable = [left, ...(generic ? [label] : []), ...searchTerms, tz];
  return {
    tz,
    labelLeft: left,
    labelSub: generic && namesMoreThan({ label, shown: left }) ? label : null,
    searchTerms,
    searchText: fold(searchable.join(" ")),
  };
}

const allLabelled = () => cachedLabels.length === TZ_OPTIONS.length;

function labelNext(): TzOption {
  const option = TZ_OPTIONS[cachedLabels.length];
  cachedLabels.push(labelFor(option));
  return option;
}

function getBaseLabels(): BaseLabel[] {
  while (!allLabelled()) labelNext();
  return cachedLabels;
}

// Building every zone's formatters is slow on Android's Hermes, so a
// mounted picker builds them a zone at a time while the runtime is idle, and
// an open finds them cached.
function warmWhileIdle(): void {
  if (typeof requestIdleCallback !== "function") return;
  if (warming !== null || allLabelled()) return;
  const step = (deadline: IdleDeadline) => {
    const now = new Date();
    while (!allLabelled()) {
      const { tz } = labelNext();
      getOffsetMinutes(tz, now);
      if (deadline.timeRemaining() <= 0) break;
    }
    warming = allLabelled() ? null : requestIdleCallback(step);
  };
  warming = requestIdleCallback(step);
}

const OPTION_BY_TZ = new Map(TZ_OPTIONS.map((option) => [option.tz, option]));

function selectedLabel(tz: string): BaseLabel | null {
  const option = OPTION_BY_TZ.get(tz);
  return option ? labelFor(option) : null;
}

type BaseItem = Omit<TimeZoneSelectItem, "timeLabel">;

const clockOf = (item: BaseItem, hour12: boolean, when: Date) =>
  item.offsetMins === null
    ? formatTimeInTz(item.tz, hour12, when)
    : formatTimeAtOffset(item.offsetMins, hour12, when);

// localeCompare costs Hermes on Android twelve times what one collator does.
const collator = new Intl.Collator();

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
      collator.compare(a.labelLeft, b.labelLeft),
  );

  cachedBase = { minute, items };
  return items;
}

// A row holding none of what was typed reads as a wrong answer, so a term that
// matched off the row takes the second line while the query stands. A row its
// own identifier matched keeps its label, since an alias there would read as
// the reason it matched.
function subForQuery(
  item: TimeZoneSelectItem,
  foldedQuery: string,
): string | null {
  const shown = fold(`${item.labelLeft} ${item.labelSub ?? ""}`);
  if (
    matchesQuery({ foldedText: shown, foldedQuery }) ||
    matchesQuery({ foldedText: fold(item.tz), foldedQuery })
  ) {
    return item.labelSub;
  }
  return (
    item.searchTerms.find((term) =>
      matchesQuery({ foldedText: fold(term), foldedQuery }),
    ) ?? item.labelSub
  );
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
  // pickers labels no other zone until the runtime is idle. The list stays
  // once built, since the mobile modal keeps showing it as it fades out, but
  // refreshes only while open.
  const [listedMinute, setListedMinute] = useState<number | null>(null);
  if (open && listedMinute !== minute) setListedMinute(minute);

  useEffect(warmWhileIdle, []);

  const items = useMemo<TimeZoneSelectItem[]>(() => {
    if (listedMinute === null) return [];
    const when = minuteStart(listedMinute);
    return baseItems(listedMinute).map((item) => ({
      ...item,
      timeLabel: clockOf(item, hour12, when),
    }));
  }, [listedMinute, hour12]);

  const label = useMemo(() => selectedLabel(internalValue), [internalValue]);

  const selected = useMemo<TimeZoneSelectItem>(() => {
    const when = minuteStart(minute);
    const offsetMins = getOffsetMinutes(internalValue, when);
    const item: BaseItem = label
      ? { ...label, offsetMins }
      : {
          tz: internalValue,
          labelLeft: internalValue,
          labelSub: null,
          searchTerms: [],
          searchText: fold(internalValue),
          offsetMins,
        };
    return { ...item, timeLabel: clockOf(item, hour12, when) };
  }, [label, internalValue, hour12, minute]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return items;
    return items
      .filter((i) => matchesQuery({ foldedText: i.searchText, foldedQuery: q }))
      .map((i) => ({ ...i, labelSub: subForQuery(i, q) }));
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
  };
}

import { useEffect, useMemo, useState } from "react";

export type TzOption = {
  group: string;
  label: string;
  tz: string;
};

export const TZ_OPTIONS: TzOption[] = [
  // US/Canada
  {
    group: "US/Canada",
    label: "Pacific Time - US & Canada",
    tz: "America/Los_Angeles",
  },
  {
    group: "US/Canada",
    label: "Mountain Time - US & Canada",
    tz: "America/Denver",
  },
  {
    group: "US/Canada",
    label: "Central Time - US & Canada",
    tz: "America/Chicago",
  },
  {
    group: "US/Canada",
    label: "Eastern Time - US & Canada",
    tz: "America/New_York",
  },
  { group: "US/Canada", label: "Alaska Time", tz: "America/Anchorage" },
  { group: "US/Canada", label: "Arizona, Yukon Time", tz: "America/Phoenix" },
  { group: "US/Canada", label: "Newfoundland Time", tz: "America/St_Johns" },
  { group: "US/Canada", label: "Hawaii Time", tz: "Pacific/Honolulu" },

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
  { group: "Australia", label: "Australia/Perth", tz: "Australia/Perth" },
  { group: "Australia", label: "Australia/Darwin", tz: "Australia/Darwin" },
  { group: "Australia", label: "Adelaide Time", tz: "Australia/Adelaide" },
  { group: "Australia", label: "Brisbane Time", tz: "Australia/Brisbane" },
  {
    group: "Australia",
    label: "Sydney, Melbourne Time",
    tz: "Australia/Sydney",
  },
  {
    group: "Australia",
    label: "Australia/Lord Howe",
    tz: "Australia/Lord_Howe",
  },

  // Pacific
  { group: "Pacific", label: "Auckland Time", tz: "Pacific/Auckland" },
  { group: "Pacific", label: "Pacific/Chatham", tz: "Pacific/Chatham" },
  { group: "Pacific", label: "Pacific/Fiji", tz: "Pacific/Fiji" },
  { group: "Pacific", label: "Pacific/Apia", tz: "Pacific/Apia" },
  { group: "Pacific", label: "Pacific/Kiritimati", tz: "Pacific/Kiritimati" },
];

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getCachedFormatter(
  key: string,
  opts: Intl.DateTimeFormatOptions,
  locale?: string,
): Intl.DateTimeFormat {
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

export function formatNowTimeInTz(tz: string, hour12: boolean = true): string {
  return getCachedFormatter(`time:${tz}:${hour12}`, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(new Date());
}

export function getOffsetMinutes(tz: string): number | null {
  try {
    const parts = getCachedFormatter(
      `offset:${tz}`,
      {
        timeZone: tz,
        timeZoneName: "shortOffset",
        hour: "2-digit",
      },
      "en",
    ).formatToParts(new Date());

    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = off.match(/([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const hh = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (hh * 60 + mm);
  } catch {
    return null;
  }
}

export function getGenericLabelFromIntl(tz: string): string | null {
  const parts = getCachedFormatter(
    `generic:${tz}`,
    {
      timeZone: tz,
      timeZoneName: "longGeneric",
    },
    "en-US",
  ).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? null;
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
  timeLabel: string;
};

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

const OBSERVER_REFRESH_MS = 30_000;

type BaseLabel = { tz: string; labelLeft: string; searchText: string };
let cachedLabels: BaseLabel[] | null = null;

function getBaseLabels(): BaseLabel[] {
  if (cachedLabels) return cachedLabels;
  cachedLabels = TZ_OPTIONS.map(({ tz }) => {
    const generic = getGenericLabelFromIntl(tz);
    const city = prettyCityFromIana(tz);
    const left = generic ? `${generic} — ${city}` : city;
    return {
      tz,
      labelLeft: `${left}`.trim(),
      searchText: `${left} ${tz}`.toLowerCase(),
    };
  });
  return cachedLabels;
}

function baseItems(): Omit<TimeZoneSelectItem, "timeLabel">[] {
  const items = getBaseLabels().map((label) => ({
    ...label,
    offsetMins: getOffsetMinutes(label.tz),
  }));

  items.sort(
    (a, b) =>
      (a.offsetMins ?? 0) - (b.offsetMins ?? 0) ||
      a.labelLeft.localeCompare(b.labelLeft),
  );

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

  const [tick, forceTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    forceTick((x) => x + 1);
    const id = setInterval(() => forceTick((x) => x + 1), OBSERVER_REFRESH_MS);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (value != null) setInternalValue(value);
  }, [value]);

  const items = useMemo<TimeZoneSelectItem[]>(() => {
    const base = baseItems();
    return base.map((item) => ({
      ...item,
      timeLabel: formatNowTimeInTz(item.tz, hour12),
    }));
  }, [hour12, tick]);

  const selected = useMemo<TimeZoneSelectItem>(() => {
    return (
      items.find((i) => i.tz === internalValue) ?? {
        tz: internalValue,
        labelLeft: internalValue,
        searchText: internalValue.toLowerCase(),
        offsetMins: getOffsetMinutes(internalValue),
        timeLabel: formatNowTimeInTz(internalValue, hour12),
      }
    );
  }, [items, internalValue, hour12]);

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

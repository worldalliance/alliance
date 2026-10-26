import type { CitySearchDto } from "@alliance/shared/client";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type CityGeo, useCitySearch } from "./useCitySearch";

export type CityAutosuggestParams = {
  value?: string;
  minLength?: number;
  debounceMs?: number;
  allowCustomValue?: boolean;
  onSelect: (city: CitySearchDto | string) => void;
};

export type CityAutosuggestState = {
  query: string;
  setQuery: (next: string) => void;
  results: CitySearchDto[];
  open: boolean;
  setOpen: (next: boolean) => void;
  highlighted: number;
  setHighlighted: Dispatch<SetStateAction<number>>;
  selectCity: (city: CitySearchDto) => void;
  commitCustomValue: () => void;
  fetchGeolocation: () => Promise<void>;
};

type CitySearch = {
  id: number;
  name: string;
  geo: CityGeo | null;
  at: number;
};

let cachedGeo: CityGeo | null = null;
let cachedGeoFetched = false;

export async function fetchApproximateGeo(): Promise<CityGeo | null> {
  if (cachedGeoFetched) return cachedGeo;
  cachedGeoFetched = true;
  try {
    // eslint-disable-next-line no-restricted-globals
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    if (data?.latitude && data?.longitude) {
      cachedGeo = { latitude: data.latitude, longitude: data.longitude };
    }
  } catch (err) {
    console.error("Failed to fetch geolocation:", err);
  }
  return cachedGeo;
}

export function useCityAutosuggest({
  value = "",
  minLength = 1,
  debounceMs = 150,
  allowCustomValue = true,
  onSelect,
}: CityAutosuggestParams): CityAutosuggestState {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CitySearchDto[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [didSelect, setDidSelect] = useState(false);
  const [geo, setGeo] = useState<CityGeo | null>(cachedGeo);
  const [search, setSearch] = useState<CitySearch | null>(null);
  const [shownSearchId, setShownSearchId] = useState<number | null>(null);
  const nextSearchId = useRef(0);

  useEffect(() => {
    setQuery(value);
    if (value.trim().length > 0) {
      setDidSelect(true);
    }
  }, [value]);

  const fetchGeolocation = useCallback(async () => {
    if (geo) return;
    const found = await fetchApproximateGeo();
    if (found) setGeo(found);
  }, [geo]);

  useEffect(() => {
    if (didSelect) return;
    const id = setTimeout(() => {
      setSearch({
        id: nextSearchId.current++,
        name: query,
        geo,
        at: Date.now(),
      });
    }, debounceMs);
    return () => clearTimeout(id);
  }, [query, geo, debounceMs, didSelect]);

  const searchable = search !== null && search.name.trim().length >= minLength;
  const cities = useCitySearch({
    text: search ? citySearchText(search.name) : "",
    geo: search?.geo ?? null,
    enabled: searchable,
  });

  // A search landing on a text whose cached answer is a failure from before it
  // asks again rather than showing that failure.
  const failedBefore =
    searchable && cities.isError && cities.errorUpdatedAt < search.at;
  const { refetch } = cities;
  useEffect(() => {
    if (failedBefore) void refetch();
  }, [failedBefore, refetch]);

  useEffect(() => {
    if (cities.error) console.error("Geo search failed", cities.error);
  }, [cities.error]);

  if (search && search.id !== shownSearchId) {
    if (!searchable) {
      setShownSearchId(search.id);
      setResults([]);
    } else if (!cities.isPending && !failedBefore) {
      setShownSearchId(search.id);
      setResults(cities.data ?? []);
      setOpen(true);
      setHighlighted(-1);
    }
  }

  const commitCustomValue = useCallback(() => {
    if (!allowCustomValue || didSelect) return;
    const trimmed = query.trim();
    onSelect(trimmed);
    setDidSelect(true);
    setSearch(null);
    setResults([]);
    setOpen(false);
    setHighlighted(-1);
    setQuery(trimmed);
  }, [allowCustomValue, didSelect, onSelect, query]);

  const selectCity = useCallback(
    (city: CitySearchDto) => {
      onSelect(city);
      setDidSelect(true);
      setSearch(null);
      const label = formatCityDisplay(city);
      setQuery(label);
      setResults([]);
      setOpen(false);
    },
    [onSelect],
  );

  return {
    query,
    setQuery: (next) => {
      setDidSelect(false);
      setQuery(next);
    },
    results,
    open,
    setOpen,
    highlighted,
    setHighlighted,
    selectCity,
    commitCustomValue,
    fetchGeolocation,
  };
}

function citySearchText(name: string): string {
  return name.includes(",") ? name.split(",")[0].trim() : name.trim();
}

export function formatCityDisplay(city: CitySearchDto): string {
  const admin = city.admin1 ? `${city.admin1}, ` : "";
  return `${city.name}, ${admin}${city.countryName}`;
}

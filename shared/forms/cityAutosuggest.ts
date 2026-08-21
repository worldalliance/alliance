import type { CitySearchDto } from "@alliance/shared/client";
import { geoSearchCity } from "@alliance/shared/client";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type CityGeo = {
  latitude?: number;
  longitude?: number;
};

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

let cachedGeo: CityGeo | null = null;
let cachedGeoFetched = false;

export async function fetchApproximateGeo(): Promise<CityGeo | null> {
  if (cachedGeoFetched) return cachedGeo;
  cachedGeoFetched = true;
  try {
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

export async function fetchCitySuggestions(
  name: string,
  opts: { minLength?: number; geo?: CityGeo; signal?: AbortSignal } = {},
): Promise<CitySearchDto[]> {
  const minLength = opts.minLength ?? 1;
  if (name.trim().length < minLength) {
    return [];
  }
  console.log("name", name);
  console.log(name.split(",")[0]);
  const res = await geoSearchCity({
    query: {
      query: name.includes(",") ? name.split(",")[0].trim() : name.trim(),
      latitude: opts.geo?.latitude,
      longitude: opts.geo?.longitude,
    },
    signal: opts.signal,
  });
  if (!res.data) {
    console.error("Geo search failed", res.error);
    return [];
  }
  return res.data;
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
  const ctrl = useRef<AbortController | null>(null);

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

  const fetchCities = useCallback(
    async (name: string) => {
      if (name.trim().length < minLength) {
        setResults([]);
        return;
      }
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        const data = await fetchCitySuggestions(name, {
          minLength,
          geo: geo ?? undefined,
          signal: ctrl.current.signal,
        });
        setResults(data);
        setOpen(true);
        setHighlighted(-1);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error(err);
        }
      }
    },
    [minLength, geo],
  );

  useEffect(() => {
    if (didSelect) return;
    const id = setTimeout(() => {
      fetchCities(query);
    }, debounceMs);
    return () => clearTimeout(id);
  }, [query, fetchCities, debounceMs, didSelect]);

  const commitCustomValue = useCallback(() => {
    if (!allowCustomValue || didSelect) return;
    const trimmed = query.trim();
    onSelect(trimmed);
    setDidSelect(true);
    setResults([]);
    setOpen(false);
    setHighlighted(-1);
    setQuery(trimmed);
  }, [allowCustomValue, didSelect, onSelect, query]);

  const selectCity = useCallback(
    (city: CitySearchDto) => {
      onSelect(city);
      setDidSelect(true);
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

export function formatCityDisplay(city: CitySearchDto): string {
  const admin = city.admin1 ? `${city.admin1}, ` : "";
  return `${city.name}, ${admin}${city.countryName}`;
}

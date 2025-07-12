import { CitySearchDto, geoSearchCity } from "@alliance/shared/client";
import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * <CityAutosuggest /> — lightweight, headless, fully‑typed city picker.
 *
 * Props
 * ────────────────────────────────────────────────────────────────────────────
 * • onSelect(city)     – required callback fired when user picks a suggestion.
 * • value              – controlled value (optional).
 * • placeholder        – input placeholder (default "Search a city …").
 * • minLength          – minimum chars before querying (default 2).
 * • debounceMs         – debounce delay in ms (default 300).
 * • className          – wrapper class name for custom styling.
 * • endpoint           – geoSearchCity endpoint path (default "/api/geo/city").
 *
 */

export interface CityAutosuggestProps {
  value?: string;
  onSelect(city: CitySearchDto): void;
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
  className?: string;
}

const CityAutosuggest: React.FC<CityAutosuggestProps> = ({
  value = "",
  onSelect,
  placeholder = "Search a city …",
  minLength = 1,
  debounceMs = 100,
  className = "",
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CitySearchDto[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [didSelect, setDidSelect] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [geoFetched, setGeoFetched] = useState(false);

  const fetchGeolocation = useCallback(async () => {
    if (geoFetched) return;
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setLatitude(data.latitude);
        setLongitude(data.longitude);
      }
    } catch (err) {
      console.error("Failed to fetch geolocation:", err);
    }
    setGeoFetched(true);
  }, [geoFetched]);

  // ─────────────────────────────────── helpers ──────────────────────────────
  const fetchCities = useCallback(
    async (name: string) => {
      if (name.length < minLength) {
        setResults([]);
        return;
      }
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        const res = await geoSearchCity({
          query: { query: name, latitude, longitude },
        });
        if (!res.data) {
          console.log(res.error);
          throw new Error("Geo search failed");
        }
        const data: CitySearchDto[] = res.data;
        setResults(data);
        setOpen(true);
        setHighlighted(-1);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") console.error(err);
      }
    },
    [minLength, latitude, longitude]
  );

  // Debounce network calls
  useEffect(() => {
    if (didSelect) return;
    const id = window.setTimeout(() => fetchCities(query), debounceMs);
    return () => window.clearTimeout(id);
  }, [query, fetchCities, debounceMs, didSelect]);

  // Close dropdown when clicking outside
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  // ────────────────────────────────── handlers ──────────────────────────────
  const select = useCallback(
    (city: CitySearchDto) => {
      onSelect(city);
      setDidSelect(true);
      setQuery(`${city.name}, ${city.countryName}`);
      setResults([]);
      setOpen(false);
    },
    [onSelect]
  );

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> =
    useCallback(
      (e) => {
        if (!open) return;
        setDidSelect(false);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlighted((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (results[highlighted]) select(results[highlighted]);
        } else if (e.key === "Escape") {
          setOpen(false);
        }
      },
      [open, results, highlighted, select]
    );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setDidSelect(false);
        }}
        onFocus={() => {
          fetchGeolocation();
          query.length >= minLength && results.length && setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-600"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-300 bg-white">
          {results.map((city: CitySearchDto, idx: number) => (
            <div
              key={`${city.name}-${city.admin1}-${city.countryCode}`}
              onMouseDown={() => select(city)}
              className={`cursor-pointer px-3 py-2 gap-2 flex flex-row ${
                idx === highlighted ? "bg-gray-200 " : "hover:bg-gray-100"
              }`}
            >
              <p>{city.name}</p>
              <p className="text-gray-500">
                {city.admin1 ? `${city.admin1}, ` : ""}
                {city.countryName}
              </p>
            </div>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CityAutosuggest;

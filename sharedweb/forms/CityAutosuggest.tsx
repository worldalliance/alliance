import type { CitySearchDto } from "@alliance/shared/client";
import {
  formatCityDisplay,
  useCityAutosuggest,
} from "@alliance/shared/forms/cityAutosuggest";
import { cn } from "@alliance/shared/styles/util";
import React, { useCallback, useEffect, useRef } from "react";

export interface CityAutosuggestProps {
  value?: string;
  onSelect(city: CitySearchDto | string): void;
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
}

const CityAutosuggest: React.FC<CityAutosuggestProps> = ({
  value = "",
  onSelect,
  placeholder = "Search for a city …",
  minLength = 1,
  debounceMs = 100,
  className = "",
  inputClassName = "",
  disabled = false,
  allowCustomValue = true,
}) => {
  const {
    query,
    setQuery,
    results,
    open,
    setOpen,
    highlighted,
    setHighlighted,
    selectCity,
    commitCustomValue,
    fetchGeolocation,
  } = useCityAutosuggest({
    value,
    minLength,
    debounceMs,
    allowCustomValue,
    onSelect,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> =
    useCallback(
      (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (open && results[highlighted]) {
            selectCity(results[highlighted]);
          } else {
            commitCustomValue();
          }
          return;
        }
        if (!open) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlighted((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === "Escape") {
          setOpen(false);
        }
      },
      [open, results, highlighted, selectCity, commitCustomValue, setOpen],
    );

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        onFocus={() => {
          fetchGeolocation();
          if (query.length >= minLength && results.length) setOpen(true);
        }}
        onBlur={commitCustomValue}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        className={cn(
          "w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-600 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500",
          inputClassName,
        )}
      />

      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-300 bg-white">
          {results.map((city: CitySearchDto, idx: number) => (
            <div
              key={`${city.name}-${city.admin1}-${city.countryCode}`}
              onMouseDown={() => selectCity(city)}
              className={cn(
                "cursor-pointer px-3 py-2 gap-2 flex flex-row",
                idx === highlighted ? "bg-gray-200" : "hover:bg-gray-100",
              )}
            >
              <p>{formatCityDisplay(city)}</p>
            </div>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CityAutosuggest;

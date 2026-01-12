import { useEffect, useMemo, useState, useRef } from "react";
import type { UserDto } from "@alliance/shared/client";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import type {
  AnyField,
  CityField,
  CityFieldValue,
  FormValue,
  RangeField,
  TimeField,
} from "@alliance/shared/forms/formschema";
import { shuffleWithSeed } from "./randomutils";
import { formatTimeForDisplay, parseTimeInput } from "./timeUtils";
import DropdownIcon from "../ui/icons/DropdownIcon";
import { getCustomComponentById } from "./components";
import { getApiUrl } from "../lib/config";
import TimeZoneSelect from "./TimeZoneSelect";
import CityAutosuggest from "./CityAutosuggest";
import ImageLightbox from "../ui/ImageLightbox";

export type RenderFieldProps = {
  field: AnyField;
  value?: FormValue;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  // File upload hooks (used by file field)
  onFileSelected?: (file: File) => void;
  uploading?: boolean;
  uploadError?: string | null;
  error?: string | null;
  randomizationKey?: string;
  disableOptionRandomization?: boolean;
  user?: Omit<UserDto, "email">;
};

const sharedInputClasses =
  "w-full px-3 py-2 rounded-md focus:outline-none bg-white disabled:!bg-transparent";
const DEFAULT_RANGE_OPTION_COUNT = 10;
const MIN_RANGE_OPTION_COUNT = 2;
const MAX_RANGE_OPTION_COUNT = 50;
const formatCityValue = (city: CityFieldValue): string => {
  const region = city.admin1?.trim();
  const country = city.countryName?.trim();
  const locationParts = [region, country].filter(
    (part): part is string => !!part && part.length > 0
  );
  const suffix = locationParts.length ? `, ${locationParts.join(", ")}` : "";
  return `${city.name}${suffix}`;
};

const isCityValue = (candidate: unknown): candidate is CityFieldValue => {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  return (
    typeof value.name === "string" &&
    typeof value.countryName === "string" &&
    "id" in value
  );
};

const getRangeValues = (field: RangeField): number[] => {
  const desired = field.optionCount ?? DEFAULT_RANGE_OPTION_COUNT;
  const normalized = Number.isFinite(desired)
    ? Math.floor(desired)
    : DEFAULT_RANGE_OPTION_COUNT;
  const optionCount = Math.min(
    MAX_RANGE_OPTION_COUNT,
    Math.max(MIN_RANGE_OPTION_COUNT, normalized)
  );
  return Array.from({ length: optionCount }, (_, index) => index + 1);
};

export function RenderLabel({
  field,
  error,
}: {
  field: AnyField;
  error?: string | null;
}) {
  const hasError = Boolean(error);
  return (
    <label className={`block ${hasError ? "text-red-600" : "text-zinc-700"}`}>
      {field.label !== null && (
        <FormMarkdownWrapper markdownContent={field.label} inline />
      )}
      {field.required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export function RenderField({
  field,
  value,
  onChange,
  disabled,
  onFileSelected,
  uploading,
  uploadError,
  error,
  randomizationKey,
  disableOptionRandomization,
  user,
}: RenderFieldProps) {
  const errorMessage =
    typeof error === "string" && error.trim().length > 0 ? error : null;
  const hasError = Boolean(errorMessage);
  const randomizationSeedBase =
    randomizationKey && randomizationKey.length > 0
      ? `${randomizationKey}:${field.id}`
      : field.id;
  const randomizedOptions = useMemo(() => {
    if (
      field.kind !== "radio" &&
      field.kind !== "multiselect" &&
      field.kind !== "select"
    ) {
      return null;
    }
    const options = field.options ?? [];
    if (
      disableOptionRandomization ||
      !field.randomizeOptions ||
      options.length <= 1
    ) {
      return options;
    }
    return shuffleWithSeed(options, randomizationSeedBase);
  }, [field, randomizationSeedBase, disableOptionRandomization]);

  const composeClassName = (
    base: string,
    overrides: { normal?: string; error?: string } = {}
  ) => {
    const normal =
      overrides.normal ??
      "border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent";
    const errorCls =
      overrides.error ??
      "border border-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent";
    return `${base} ${hasError ? errorCls : normal}`;
  };

  const renderValidationMessage = () =>
    hasError ? <p className="text-sm text-red-600">{errorMessage}</p> : null;

  switch (field.kind) {
    case "text":
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(sharedInputClasses, {
              normal:
                "border border-zinc-300 focus:ring-1 focus:ring-green focus:border-transparent",
              error:
                "border border-red-500 focus:ring-1 focus:ring-red-500 focus:border-transparent",
            })}
            placeholder={field.placeholder}
          />
          {renderValidationMessage()}
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <textarea
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
              onChange?.(target.value);
            }}
            rows={disabled ? 1 : field.rows || 3}
            maxLength={field.maxLength}
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(
              sharedInputClasses + " resize-none overflow-hidden"
            )}
            placeholder={field.placeholder}
          />
          {renderValidationMessage()}
          {field.maxLength && (
            <p className="text-xs text-zinc-500 mt-1">
              Maximum {field.maxLength} characters
            </p>
          )}
        </div>
      );

    case "email":
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <input
            type="email"
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(sharedInputClasses)}
            placeholder="example@email.com"
          />
          {renderValidationMessage()}
        </div>
      );

    case "phone":
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <input
            type="tel"
            value={(value as string) ?? ""}
            onChange={
              onChange
                ? (e) => {
                    const raw = e.target.value;
                    const sanitized = raw.replace(/[^0-9+\-()\s]/g, "");
                    onChange(sanitized);
                  }
                : undefined
            }
            required={field.required}
            disabled={disabled}
            pattern={field.pattern}
            aria-invalid={hasError}
            className={composeClassName(sharedInputClasses)}
            placeholder={field.placeholder || "Enter phone number"}
          />
          {renderValidationMessage()}
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <input
            type="number"
            value={
              value === undefined || value === null
                ? ""
                : (value as number | string)
            }
            onChange={
              onChange
                ? (e) =>
                    onChange(
                      e.target.value === "" ? "" : parseFloat(e.target.value)
                    )
                : undefined
            }
            required={field.required}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            aria-invalid={hasError}
            className={composeClassName(sharedInputClasses)}
          />
          {renderValidationMessage()}
          {field.min !== undefined || field.max !== undefined ? (
            <p className="text-xs text-zinc-500 mt-1">
              {field.min !== undefined && field.max !== undefined
                ? `Range: ${field.min} - ${field.max}`
                : field.min !== undefined
                ? `Minimum: ${field.min}`
                : `Maximum: ${field.max}`}
            </p>
          ) : null}
        </div>
      );

    case "range": {
      const values = getRangeValues(field);
      const numericValue =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim().length > 0
          ? Number(value)
          : undefined;
      const normalizedValue = Number.isFinite(numericValue)
        ? Number(numericValue)
        : undefined;

      return (
        <div className="relative pb-6">
          <RenderLabel field={field} error={errorMessage} />
          <div className="flex items-center justify-between text-xs text-zinc-500 py-1">
            <span className="text-black">{field.startLabel}</span>
            <span className="text-black">{field.endLabel}</span>
          </div>
          <div className="flex w-full divide-x divide-zinc-300 border-x border-zinc-300">
            {values.map((optionValue) => {
              const checked = normalizedValue === optionValue;
              return (
                <label
                  key={optionValue}
                  className={`flex flex-col items-center text-sm font-medium  flex-1 w-[${
                    100 / values.length
                  }%] ${
                    disabled
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  <input
                    type="radio"
                    name={field.id}
                    value={optionValue}
                    className="sr-only"
                    checked={checked}
                    onChange={
                      onChange && !disabled
                        ? () => onChange(optionValue)
                        : undefined
                    }
                    disabled={disabled}
                  />
                  <span
                    className={`w-full rounded-none border-y  px-3 py-1 text-center ${
                      checked
                        ? "bg-green text-white border-green"
                        : hasError
                        ? "border-red-500 text-red-600"
                        : "border-zinc-300 text-zinc-700"
                    }`}
                  >
                    {optionValue}
                  </span>
                </label>
              );
            })}
          </div>
          {renderValidationMessage()}
          {!field.required && normalizedValue !== undefined && onChange && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs text-zinc-600 hover:text-zinc-800 absolute bottom-0 right-0"
            >
              Clear selection
            </button>
          )}
        </div>
      );
    }

    case "checkbox": {
      const checkboxPosition = field.checkboxPosition ?? "left";
      const checkboxInput = (
        <input
          type="checkbox"
          checked={!!value}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          required={field.required}
          disabled={disabled}
          aria-invalid={hasError}
          className={composeClassName(
            `shrink-0 mt-1 h-5 w-5 cursor-pointer ${
              checkboxPosition === "right" ? "ml-2 pr-5" : "mr-2"
            } ${
              hasError ? "text-red-600" : "text-blue-600"
            } focus:outline-none rounded`,
            {
              normal: "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
              error: "border border-red-500 focus:ring-red-500 focus:ring-2",
            }
          )}
        />
      );
      const checkboxLabel = (
        <span className={hasError ? "text-red-600" : "text-zinc-700"}>
          {field.label !== null && (
            <FormMarkdownWrapper markdownContent={field.label} inline />
          )}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </span>
      );
      return (
        <div className="space-y-1 pr-5">
          <label className={`flex items-start`}>
            {checkboxPosition === "right" ? (
              <>
                {checkboxLabel}
                {checkboxInput}
              </>
            ) : (
              <>
                {checkboxInput}
                {checkboxLabel}
              </>
            )}
          </label>
          {renderValidationMessage()}
        </div>
      );
    }

    case "radio": {
      const options = randomizedOptions ?? field.options;
      return (
        <div className="space-y-2">
          <RenderLabel field={field} error={errorMessage} />
          <div
            className={`space-y-2 ${
              hasError ? "border-l-2 border-red-500 pl-3" : ""
            }`}
          >
            {options.map((option, optIndex) => (
              <label key={optIndex} className="flex items-start">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={
                    onChange ? (e) => onChange(e.target.value) : undefined
                  }
                  required={field.required}
                  disabled={disabled}
                  aria-invalid={hasError}
                  className={composeClassName(
                    `shrink-0 mt-1 mr-2 h-4 w-4 ${
                      hasError ? "text-red-600" : "text-blue-600"
                    } focus:outline-none`,
                    {
                      normal:
                        "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
                      error:
                        "border border-red-500 focus:ring-red-500 focus:ring-2",
                    }
                  )}
                />
                <span className={hasError ? "text-red-600" : "text-zinc-700"}>
                  <FormMarkdownWrapper markdownContent={option.label} inline />
                </span>
              </label>
            ))}
          </div>
          {renderValidationMessage()}
        </div>
      );
    }

    case "select": {
      const options = randomizedOptions ?? field.options;
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <select
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(
              sharedInputClasses +
                " has-[option.placeholder:checked]:text-zinc-400"
            )}
          >
            <option value="" className="placeholder" disabled>
              Select an option
            </option>
            {options.map((option, optIndex) => (
              <option key={optIndex} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {renderValidationMessage()}
        </div>
      );
    }

    case "multiselect": {
      const selections = Array.isArray(value) ? value : [];
      const selectedCount = selections.length;
      const options = randomizedOptions ?? field.options ?? [];
      const maxSelections =
        typeof field.maxSelections === "number" && field.maxSelections > 0
          ? field.maxSelections
          : undefined;
      const maxReached =
        maxSelections !== undefined && selectedCount >= maxSelections;

      return (
        <div className="space-y-2">
          <RenderLabel field={field} error={errorMessage} />
          <div
            className={`space-y-2 ${
              hasError ? "border-l-2 border-red-500 pl-3" : ""
            }`}
          >
            {options.map((option, optIndex) => (
              <label key={optIndex} className="flex">
                <input
                  type="checkbox"
                  name={field.id}
                  checked={selections.includes(option.value)}
                  onChange={
                    onChange
                      ? (e) => {
                          const currentValues = Array.isArray(value)
                            ? value
                            : [];
                          if (e.target.checked) {
                            onChange([...currentValues, option.value]);
                          } else {
                            onChange(
                              currentValues.filter((v) => v !== option.value)
                            );
                          }
                        }
                      : undefined
                  }
                  required={
                    !!field.required && selectedCount === 0 && optIndex === 0
                  }
                  disabled={
                    disabled ||
                    (!selections.includes(option.value) && maxReached)
                  }
                  aria-invalid={hasError}
                  style={{ marginTop: "4px" }}
                  className={composeClassName(
                    `shrink-0 mr-2 h-4 w-4 disabled:ring-1 disabled:ring-zinc-400 ${
                      hasError ? "text-red-600" : "text-blue-600"
                    } focus:outline-none rounded`,
                    {
                      normal:
                        "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
                      error:
                        "border border-red-500 focus:ring-red-500 focus:ring-2",
                    }
                  )}
                />
                <span className={hasError ? "text-red-600" : "text-zinc-700"}>
                  <FormMarkdownWrapper markdownContent={option.label} inline />
                </span>
              </label>
            ))}
          </div>
          {maxSelections !== undefined && (
            <p className={`text-xs text-gray-500`}>
              Select up to {maxSelections} option
              {maxSelections === 1 ? "" : "s"}
            </p>
          )}
          {renderValidationMessage()}
        </div>
      );
    }

    case "date":
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <input
            type="date"
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(sharedInputClasses)}
          />
          {renderValidationMessage()}
        </div>
      );

    case "time":
      return (
        <TimeInputField
          field={field as TimeField}
          value={value}
          onChange={onChange}
          disabled={disabled}
          baseError={errorMessage}
        />
      );

    case "timezone": {
      return (
        <div className="space-y-1">
          <RenderLabel field={field} error={errorMessage} />
          <TimeZoneSelect
            value={(value as string) ?? "America/Los_Angeles"}
            onChange={onChange ? (tz) => onChange(tz) : undefined}
            disabled={disabled}
            aria-invalid={hasError}
          />
          {renderValidationMessage()}
        </div>
      );
    }

    case "city": {
      const cityValue = isCityValue(value) ? value : undefined;
      const displayValue =
        cityValue !== undefined
          ? formatCityValue(cityValue)
          : typeof value === "string"
          ? value
          : "";
      return (
        <div className="space-y-1">
          <RenderLabel field={field as CityField} error={errorMessage} />
          <CityAutosuggest
            key={`city-${cityValue?.id ?? field.id}`}
            value={displayValue}
            placeholder={(field as CityField).placeholder}
            minLength={(field as CityField).minLength}
            debounceMs={(field as CityField).debounceMs}
            inputClassName={
              hasError
                ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "focus:border-green focus:ring-1 focus:ring-green"
            }
            disabled={disabled}
            allowCustomValue
            onSelect={(city) => onChange?.(city)}
          />
          {renderValidationMessage()}
        </div>
      );
    }

    case "file": {
      const fileValue = value;
      const isUploading = !!uploading;
      const err = uploadError;
      const imageUrl =
        typeof fileValue === "string" && fileValue
          ? getApiUrl() + "/images/" + fileValue
          : null;
      return (
        <div className="space-y-2">
          <RenderLabel field={field} error={errorMessage} />
          {imageUrl && (
            <div className="mb-2">
              <ImageLightbox
                images={[imageUrl]}
                renderPreview={(openLightbox) => (
                  <button
                    type="button"
                    className="focus:outline-none cursor-zoom-in"
                    onClick={(e) => openLightbox(0, e)}
                  >
                    <img
                      src={imageUrl}
                      alt="Uploaded file"
                      className="max-w-full h-auto max-h-32 rounded"
                    />
                  </button>
                )}
              />
            </div>
          )}
          {!(disabled && fileValue) && (
            <div className="flex items-center space-x-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || disabled) return;
                  if (onFileSelected) onFileSelected(file);
                }}
                required={field.required && !fileValue}
                disabled={disabled || isUploading}
                aria-invalid={hasError}
                className={composeClassName(
                  sharedInputClasses +
                    " max-w-full flex-1 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                )}
              />
              {isUploading && (
                <span className=" text-blue-600">Uploading...</span>
              )}
            </div>
          )}

          {renderValidationMessage()}

          {err && <p className=" text-red-600">{err}</p>}
        </div>
      );
    }

    case "custom": {
      const definition = getCustomComponentById(field.componentId);
      if (!definition) {
        return (
          <div className="space-y-2 border border-red-200 bg-red-50 p-3 rounded">
            <RenderLabel field={field} error={errorMessage} />
            <p className="text-sm text-red-700">
              Unable to render this field because the selected custom component
              is not registered.
            </p>
          </div>
        );
      }
      const CustomComponent = definition.component;
      return (
        <div className="space-y-2">
          <CustomComponent
            field={field}
            value={typeof value === "string" ? value : null}
            onChange={(next) => onChange?.(next)}
            user={user}
            disabled={disabled}
          />
          {renderValidationMessage()}
        </div>
      );
    }

    default:
      return null;
  }
}

export default RenderField;

type TimeInputFieldProps = {
  field: TimeField;
  value: FormValue | undefined;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  baseError: string | null;
};

export function TimeInputField({
  field,
  value,
  onChange,
  disabled,
  baseError,
}: TimeInputFieldProps) {
  const normalizedValue = typeof value === "string" && value ? value : "";
  const [inputValue, setInputValue] = useState<string>(() =>
    formatTimeForDisplay(normalizedValue)
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing || localError) return;
    const nextDisplay = normalizedValue
      ? formatTimeForDisplay(normalizedValue)
      : "";
    setInputValue(nextDisplay);
  }, [normalizedValue, isEditing, field.id, localError]);

  // --- Handle clicking outside dropdown ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commitValue = () => {
    const raw = inputValue.trim();
    if (!raw) {
      setLocalError(field.required ? "Enter a time such as 7:30 PM" : null);
      onChange?.("");
      return;
    }
    const parsed = parseTimeInput(raw);
    if (!parsed) {
      setLocalError("Enter a time such as 7:30 PM");
      return;
    }
    setLocalError(null);
    const normalized = parsed.normalized;
    onChange?.(normalized);
    setInputValue(formatTimeForDisplay(normalized));
  };

  const effectiveError = localError ?? baseError ?? null;
  const hasError = Boolean(effectiveError);

  // --- Generate dropdown time options (every 30 minutes) ---
  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
    const hours = Math.floor(i / 2);
    const minutes = i % 2 === 0 ? "00" : "30";
    const ampm = hours < 12 ? "AM" : "PM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes} ${ampm}`;
  });

  const handleSelectTime = (time: string) => {
    setInputValue(time);
    setShowDropdown(false);
    setIsEditing(false);
    setLocalError(null);
    const parsed = parseTimeInput(time);
    if (parsed) onChange?.(parsed.normalized);
  };

  return (
    <div className="space-y-1 relative">
      <RenderLabel field={field} error={effectiveError} />
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onFocus={() => {
            setIsEditing(true);
            setShowDropdown(true);
          }}
          onBlur={() => {
            setIsEditing(false);
            commitValue();
          }}
          onChange={(e) => {
            setInputValue(e.target.value);
            setLocalError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setIsEditing(false);
              commitValue();
              setShowDropdown(false);
            }
          }}
          placeholder="7:30 PM"
          required={field.required}
          disabled={disabled}
          aria-invalid={hasError}
          className={`w-full px-3 py-2 rounded-md focus:outline-none bg-white disabled:!bg-transparent ${
            hasError
              ? "border border-red-500 focus:ring-1 focus:ring-red-500 focus:border-transparent"
              : "border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          }`}
          inputMode="text"
        />

        {/* ▼ Dropdown Icon */}
        <button
          type="button"
          onClick={() => setShowDropdown((prev) => !prev)}
          className="absolute right-2 sm:right-3 h-full"
          tabIndex={-1}
        >
          <DropdownIcon size="mini" fill="black" />
        </button>

        {/* Dropdown List */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-20 w-full mt-1 border border-zinc-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {timeOptions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectTime(t)}
                className={`w-full text-left px-3 py-2 bg-white text-sm hover:bg-zinc-50 ${
                  t === inputValue ? "bg-zinc-50 font-medium" : ""
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasError && <p className="text-sm text-red-600">{effectiveError}</p>}
    </div>
  );
}

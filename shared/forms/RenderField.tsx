import { useEffect, useMemo, useState, useRef } from "react";
import type { UserDto } from "@alliance/shared/client";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import type { AnyField, FormValue, TimeField } from "./formschema";
import { shuffleWithSeed } from "./randomutils";
import { formatTimeForDisplay, parseTimeInput } from "./timeUtils";
import DropdownIcon from "../ui/icons/DropdownIcon";
import { getCustomComponentById } from "./components";

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
      <FormMarkdownWrapper markdownContent={field.label} inline />
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
            className={composeClassName(
              "w-full px-3 py-2 rounded focus:outline-none",
              {
                normal:
                  "border border-zinc-300 focus:ring-1 focus:ring-green focus:border-transparent",
                error:
                  "border border-red-500 focus:ring-1 focus:ring-red-500 focus:border-transparent",
              }
            )}
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
            rows={field.rows || 3}
            maxLength={field.maxLength}
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(
              "w-full px-3 py-2 rounded-md focus:outline-none resize-none overflow-hidden"
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
            className={composeClassName(
              "w-full px-3 py-2 rounded focus:outline-none"
            )}
            placeholder="Enter email address..."
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
            className={composeClassName(
              "w-full px-3 py-2 rounded focus:outline-none"
            )}
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
            className={composeClassName(
              "w-full px-3 py-2 rounded-md focus:outline-none"
            )}
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

    case "checkbox":
      return (
        <div className="space-y-1">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={!!value}
              onChange={
                onChange ? (e) => onChange(e.target.checked) : undefined
              }
              required={field.required}
              disabled={disabled}
              aria-invalid={hasError}
              className={composeClassName(
                `mt-1 mr-2 h-4 w-4 ${
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
            <RenderLabel field={field} error={errorMessage} />
          </label>
          {renderValidationMessage()}
        </div>
      );

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
                    `mt-1 mr-2 h-4 w-4 ${
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
              "w-full px-3 py-2 rounded-md focus:outline-none has-[option.placeholder:checked]:text-zinc-400"
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
                    `mr-2 h-4 w-4 disabled:ring-1 disabled:ring-zinc-400 ${
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
                  {option.label}
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
            className={composeClassName(
              "w-full px-3 py-2 rounded-md focus:outline-none"
            )}
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
          <select
            value={value as string}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            aria-invalid={hasError}
            className={composeClassName(
              "w-full px-3 py-2 rounded-md focus:outline-none has-[option.placeholder:checked]:text-gray-400"
            )}
          >
            {/* https://en.wikipedia.org/wiki/List_of_tz_database_time_zones */}
            <option value="Etc/GMT+12">(GMT -12:00) Eniwetok, Kwajalein</option>
            <option value="Pacific/Midway">
              (GMT -11:00) Midway Island, Samoa
            </option>
            <option value="Pacific/Honolulu">(GMT -10:00) Hawaii</option>
            <option value="Pacific/Marquesas">(GMT -9:30) Taiohae</option>
            <option value="America/Anchorage">(GMT -9:00) Alaska</option>
            <option value="America/Los_Angeles">
              (GMT -8:00) Pacific Time (US &amp; Canada)
            </option>
            <option value="America/Denver">
              (GMT -7:00) Mountain Time (US &amp; Canada)
            </option>
            <option value="America/Chicago">
              (GMT -6:00) Central Time (US &amp; Canada), Mexico City
            </option>
            <option value="America/New_York">
              (GMT -5:00) Eastern Time (US &amp; Canada), Bogota, Lima
            </option>
            <option value="America/Caracas">(GMT -4:30) Caracas</option>
            <option value="America/Halifax">
              (GMT -4:00) Atlantic Time (Canada), Caracas, La Paz
            </option>
            <option value="America/St_Johns">(GMT -3:30) Newfoundland</option>
            <option value="America/Sao_Paulo">
              (GMT -3:00) Brazil, Buenos Aires, Georgetown
            </option>
            <option value="Atlantic/South_Georgia">
              (GMT -2:00) Mid-Atlantic
            </option>
            <option value="Atlantic/Azores">
              (GMT -1:00) Azores, Cape Verde Islands
            </option>
            <option value="Europe/London">
              (GMT) Western Europe Time, London, Lisbon, Casablanca
            </option>
            <option value="Europe/Paris">
              (GMT +1:00) Brussels, Copenhagen, Madrid, Paris
            </option>
            <option value="Africa/Johannesburg">
              (GMT +2:00) Kaliningrad, South Africa
            </option>
            <option value="Europe/Moscow">
              (GMT +3:00) Baghdad, Riyadh, Moscow, St. Petersburg
            </option>
            <option value="Asia/Tehran">(GMT +3:30) Tehran</option>
            <option value="Asia/Dubai">
              (GMT +4:00) Abu Dhabi, Muscat, Baku, Tbilisi
            </option>
            <option value="Asia/Kabul">(GMT +4:30) Kabul</option>
            <option value="Asia/Karachi">
              (GMT +5:00) Ekaterinburg, Islamabad, Karachi, Tashkent
            </option>
            <option value="Asia/Kolkata">
              (GMT +5:30) Bombay, Calcutta, Madras, New Delhi
            </option>
            <option value="Asia/Kathmandu">
              (GMT +5:45) Kathmandu, Pokhara
            </option>
            <option value="Asia/Dhaka">
              (GMT +6:00) Almaty, Dhaka, Colombo
            </option>
            <option value="Asia/Yangon">(GMT +6:30) Yangon, Mandalay</option>
            <option value="Asia/Bangkok">
              (GMT +7:00) Bangkok, Hanoi, Jakarta
            </option>
            <option value="Asia/Singapore">
              (GMT +8:00) Beijing, Perth, Singapore, Hong Kong
            </option>
            <option value="Australia/Eucla">(GMT +8:45) Eucla</option>
            <option value="Asia/Tokyo">
              (GMT +9:00) Tokyo, Seoul, Osaka, Sapporo, Yakutsk
            </option>
            <option value="Australia/Darwin">
              (GMT +9:30) Adelaide, Darwin
            </option>
            <option value="Australia/Sydney">
              (GMT +10:00) Eastern Australia, Guam, Vladivostok
            </option>
            <option value="Australia/Lord_Howe">
              (GMT +10:30) Lord Howe Island
            </option>
            <option value="Pacific/Guadalcanal">
              (GMT +11:00) Magadan, Solomon Islands, New Caledonia
            </option>
            <option value="Pacific/Norfolk">(GMT +11:30) Norfolk Island</option>
            <option value="Pacific/Auckland">
              (GMT +12:00) Auckland, Wellington, Fiji, Kamchatka
            </option>
            <option value="Pacific/Chatham">
              (GMT +12:45) Chatham Islands
            </option>
            <option value="Pacific/Apia">(GMT +13:00) Apia, Nukualofa</option>
            <option value="Pacific/Kiritimati">
              (GMT +14:00) Line Islands, Tokelau
            </option>
          </select>
          {renderValidationMessage()}
        </div>
      );
    }

    case "file": {
      const fileValue = value;
      const isUploading = !!uploading;
      const err = uploadError;
      return (
        <div className="space-y-2">
          <RenderLabel field={field} error={errorMessage} />
          {typeof fileValue === "string" && fileValue && (
            <div className="mb-2">
              <img
                src={fileValue}
                alt="Uploaded file"
                className="max-w-full h-auto max-h-32 rounded border"
              />
            </div>
          )}
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
                "flex-1 px-3 py-2 rounded-md focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              )}
            />
            {isUploading && (
              <span className=" text-blue-600">Uploading...</span>
            )}
          </div>

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
          className={`w-full px-3 py-2 rounded-md focus:outline-none ${
            hasError
              ? "border border-red-500 focus:ring-1 focus:ring-red-500 focus:border-transparent"
              : "border border-zinc-300 focus:ring-1 focus:ring-green focus:border-transparent"
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
            className="absolute z-20 w-full mt-1 bg-white border border-zinc-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {timeOptions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleSelectTime(t)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 ${
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

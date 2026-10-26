import type { TimeField } from "@alliance/common/forms/form-schema";
import {
  buildTimeOfDayOptions,
  commitTimeInput,
  formatTimeForDisplay,
  parseTimeInput,
} from "@alliance/shared/forms/timeUtils";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type FieldInputProps,
  RenderLabel,
  useQuestionLabelId,
  ValidationMessage,
} from "./fieldParts";

export function TimeInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TimeField>) {
  const labelId = useQuestionLabelId(field);
  const normalizedValue = typeof value === "string" && value ? value : "";
  const [inputValue, setInputValue] = useState<string>(() =>
    formatTimeForDisplay(normalizedValue),
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
    const { answer, error } = commitTimeInput({ raw: inputValue, required });
    setLocalError(error);
    if (answer === null) return;
    onChange?.(answer);
    if (answer) setInputValue(formatTimeForDisplay(answer));
  };

  const effectiveError = localError ?? errorMessage;
  const hasError = Boolean(effectiveError);

  const timeOptions = buildTimeOfDayOptions(30).map((option) => option.label);

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
      <RenderLabel
        field={field}
        labelId={labelId}
        error={effectiveError}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <div className="relative">
        <input
          ref={inputRef}
          aria-labelledby={labelId}
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
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          className={cn(
            "w-full px-3 py-2 rounded-md focus:outline-none bg-white disabled:bg-transparent!",
            hasError
              ? "border border-red-500 focus:ring-1 focus:ring-red-500 focus:border-transparent"
              : "border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          )}
          inputMode="text"
        />

        <button
          type="button"
          onClick={() => setShowDropdown((prev) => !prev)}
          className="absolute right-2 sm:right-3 h-full"
          tabIndex={-1}
        >
          <ChevronDown className="h-2.5 w-2.5 text-black" />
        </button>

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
                className={cn(
                  "w-full text-left px-3 py-2 bg-white text-sm hover:bg-zinc-50",
                  t === inputValue && "bg-zinc-50 font-medium",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <ValidationMessage message={effectiveError} />
    </div>
  );
}

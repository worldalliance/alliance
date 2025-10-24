import React, { useMemo } from "react";

export type DatePrecision = "minute" | "second";

export interface DateTimePickerChange {
  utcValue: string | null;
  localValue: string;
  date: Date | null;
}

export interface DateTimePickerProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  > {
  value?: string | Date | null;
  onChange: (change: DateTimePickerChange) => void;
  precision?: DatePrecision;
  label?: string;
  helperText?: string;
  showTimezoneHint?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  onLocalChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const DEFAULT_INPUT_CLASS =
  "w-full p-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500";

export function resolveDateValue(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLocalDateTime(
  date: Date | null,
  precision: DatePrecision
): string {
  if (!date) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const base = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  if (precision === "second") {
    const ss = pad(date.getSeconds());
    return `${base}:${ss}`;
  }
  return base;
}

export function parseLocalDateTime(localValue: string): Date | null {
  if (!localValue) {
    return null;
  }
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  precision = "minute",
  label,
  helperText,
  showTimezoneHint = false,
  wrapperClassName,
  inputClassName,
  onLocalChange,
  className,
  ...rest
}) => {
  const resolvedValue = useMemo(() => resolveDateValue(value), [value]);
  const resolvedPrecision: DatePrecision =
    precision === "second" ? "second" : "minute";

  const localValue = useMemo(
    () => formatLocalDateTime(resolvedValue, resolvedPrecision),
    [resolvedValue, resolvedPrecision]
  );

  const timezoneLabel = useMemo(() => {
    if (!showTimezoneHint) {
      return "";
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz
      ? `All times are shown in your local timezone (${tz}).`
      : "All times are shown in your local timezone.";
  }, [showTimezoneHint]);

  const combinedInputClass = [DEFAULT_INPUT_CLASS, className, inputClassName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onLocalChange?.(event);
    const nextLocalValue = event.target.value;
    const nextDate = parseLocalDateTime(nextLocalValue);
    const utcValue = nextDate ? nextDate.toISOString() : null;
    onChange({
      utcValue,
      localValue: nextLocalValue,
      date: nextDate,
    });
  };

  return (
    <div className={wrapperClassName}>
      {label ? (
        <label
          className="block text-zinc-700 font-medium mb-2"
          htmlFor={rest.id}
        >
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        type="datetime-local"
        className={combinedInputClass}
        value={localValue}
        onChange={handleChange}
      />
      {helperText ? (
        <p className="mt-1 text-sm text-zinc-500">{helperText}</p>
      ) : null}
      {timezoneLabel ? (
        <p className="mt-1 text-xs text-zinc-500">{timezoneLabel}</p>
      ) : null}
    </div>
  );
};

export default DateTimePicker;

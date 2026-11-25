import {
  formatLocalDateTime,
  parseLocalDateTime,
  resolveDateValue,
  type DatePrecision,
  type DateTimePickerChange,
} from "@alliance/sharedweb/ui/DateTimePicker";
import React, { useMemo } from "react";
import { cn } from "./cn";
import { Input } from "./Input";

// The parsing and formatting are the shared picker's: only the control is the
// admin's own.
export {
  formatLocalDateTime,
  parseLocalDateTime,
  resolveDateValue,
  type DatePrecision,
  type DateTimePickerChange,
};

export interface DateTimePickerProps extends Omit<
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
    [resolvedValue, resolvedPrecision],
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
          className="mb-1 block text-body font-medium text-fg"
          htmlFor={rest.id}
        >
          {label}
        </label>
      ) : null}
      <Input
        {...rest}
        type="datetime-local"
        className={cn(className, inputClassName)}
        value={localValue}
        onChange={handleChange}
      />
      {helperText ? (
        <p className="mt-1 text-caption text-fg-muted">{helperText}</p>
      ) : null}
      {timezoneLabel ? (
        <p className="mt-1 text-caption text-fg-muted">{timezoneLabel}</p>
      ) : null}
    </div>
  );
};

export default DateTimePicker;

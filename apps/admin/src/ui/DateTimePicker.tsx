import {
  formatLocalDateTime,
  parseLocalDateTime,
  resolveDateValue,
  type DatePrecision,
  type DateTimePickerChange,
} from "@alliance/sharedweb/ui/DateTimePicker";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
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
  /**
   * An IANA zone, such as `LAUNCH_TIME_ZONE`: the control shows and edits the
   * instant as wall-clock time there. Omit for the viewer's own zone.
   */
  timeZone?: string;
  label?: string;
  helperText?: string;
  showTimezoneHint?: boolean;
  wrapperClassName?: string;
  inputClassName?: string;
  onLocalChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * The zone's name for a field label, in sentence case: "Pacific time" in
 * "Start date (Pacific time)".
 */
export function timeZoneLabel(timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longGeneric",
  })
    .formatToParts(new Date(0))
    .find((part) => part.type === "timeZoneName")?.value;
  return (name ?? timeZone).replace(/ (Standard |Daylight )?Time$/, " time");
}

const WALL_CLOCK: Record<DatePrecision, string> = {
  minute: "yyyy-MM-dd'T'HH:mm",
  second: "yyyy-MM-dd'T'HH:mm:ss",
};

/** The instant as a `datetime-local` value on the zone's wall clock. */
export function formatZonedDateTime(
  date: Date | null,
  { timeZone, precision }: { timeZone: string; precision: DatePrecision },
): string {
  return date ? format(new TZDate(date, timeZone), WALL_CLOCK[precision]) : "";
}

/**
 * The instant a `datetime-local` value names on the zone's wall clock. A time
 * skipped when clocks go forward resolves an hour later; a time repeated when
 * they go back resolves to its first occurrence.
 */
export function parseZonedDateTime(
  wallClock: string,
  timeZone: string,
): Date | null {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    wallClock,
  );
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const time = new TZDate(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    timeZone,
  ).getTime();
  return Number.isNaN(time) ? null : new Date(time);
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  precision = "minute",
  timeZone,
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
    () =>
      timeZone
        ? formatZonedDateTime(resolvedValue, {
            timeZone,
            precision: resolvedPrecision,
          })
        : formatLocalDateTime(resolvedValue, resolvedPrecision),
    [resolvedValue, resolvedPrecision, timeZone],
  );

  const timezoneLabel = useMemo(() => {
    if (!showTimezoneHint) {
      return "";
    }
    if (timeZone) {
      return `All times are shown in ${timeZoneLabel(timeZone)}.`;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz
      ? `All times are shown in your local timezone (${tz}).`
      : "All times are shown in your local timezone.";
  }, [showTimezoneHint, timeZone]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onLocalChange?.(event);
    const nextLocalValue = event.target.value;
    const nextDate = timeZone
      ? parseZonedDateTime(nextLocalValue, timeZone)
      : parseLocalDateTime(nextLocalValue);
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

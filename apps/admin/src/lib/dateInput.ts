import { R, type Result } from "@alliance/common/result";
import { addDays, isValid, subDays } from "date-fns";
import { formatDateAsLocal } from "./formatDateAsLocal";

/** A date input's value for an instant, as a calendar date in local time. */
export const toDateInput = (iso: string | null | undefined): string =>
  iso ? formatDateAsLocal(new Date(iso)) : "";

/** The server refuses a year past 9999, which a date input accepts. */
const isoInstant = (date: Date, value: string): Result<string, string> =>
  isValid(date) && date.getUTCFullYear() <= 9999
    ? R.success(date.toISOString())
    : R.failure(`${value} isn't a date`);

/** The instant a date input's local calendar date begins, or null when blank. */
export const fromDateInput = (value: string): Result<string | null, string> =>
  value ? isoInstant(new Date(`${value}T00:00`), value) : R.success(null);

/** An inclusive last day as the exclusive instant after it, and back. */
export const fromEndDateInput = (
  value: string,
): Result<string | null, string> =>
  R.flatMap(fromDateInput(value), (start) =>
    start ? isoInstant(addDays(new Date(start), 1), value) : R.success(null),
  );

export const toEndDateInput = (iso: string | null | undefined): string =>
  iso ? formatDateAsLocal(subDays(new Date(iso), 1)) : "";

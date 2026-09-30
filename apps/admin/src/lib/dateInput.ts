import { R, type Result } from "@alliance/common/result";
import { isValid } from "date-fns";
import { formatDateAsLocal } from "./formatDateAsLocal";

/** A date input's value for an instant, as a calendar date in local time. */
export const toDateInput = (iso: string | null | undefined): string =>
  iso ? formatDateAsLocal(new Date(iso)) : "";

/**
 * The instant a date input's local calendar date begins, or null when blank.
 * A date input accepts a year of five or more digits, which fails.
 */
export const fromDateInput = (value: string): Result<string | null, string> => {
  if (!value) return R.success(null);
  const start = new Date(`${value}T00:00`);
  return isValid(start)
    ? R.success(start.toISOString())
    : R.failure(`${value} isn't a date`);
};

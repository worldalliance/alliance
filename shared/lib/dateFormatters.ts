/**
 * Cached Intl.DateTimeFormat instances to avoid expensive re-creation.
 * Each formatter is created once and reused for all subsequent calls.
 */

/** "January 1, 2025" */
const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** "January 1, 2025" (en-US) */
const longDateFormatterEnUS = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** "Jan 1" */
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/** "Jan 1, 2025" (en-US) */
const mediumDateFormatterEnUS = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** "Jan 1, 2025, 3:00 PM" */
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "1/1/2025, 3:00:00 PM" (default toLocaleString equivalent) */
const fullDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function formatLongDate(date: Date): string {
  return longDateFormatter.format(date);
}

export function formatLongDateEnUS(date: Date): string {
  return longDateFormatterEnUS.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date);
}

export function formatMediumDateEnUS(date: Date): string {
  return mediumDateFormatterEnUS.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

export function formatFullDateTime(date: Date): string {
  return fullDateTimeFormatter.format(date);
}

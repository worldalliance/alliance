import { expect, test } from "bun:test";
import { formatDateTimeWithZone, formatMediumDate } from "./dateFormatters";

test("formatMediumDate shows the short month, day, and year in the device locale", () => {
  const date = new Date(2025, 0, 1, 12);
  expect(formatMediumDate(date)).toBe(
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  );
});

test("formatDateTimeWithZone shows the date, the time and the short zone name", () => {
  const date = new Date(2025, 0, 1, 15);
  expect(formatDateTimeWithZone(date)).toBe(
    date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }),
  );
});

test("formatDateTimeWithZone follows a change of the browser's zone", () => {
  // Deleting TZ once set leaves Bun in the last zone set, so an unset TZ is
  // restored as the zone Bun was running in.
  const original =
    process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = new Date("2026-01-01T05:30:00Z");
  try {
    process.env.TZ = "America/Los_Angeles";
    const losAngeles = formatDateTimeWithZone(date);
    process.env.TZ = "America/New_York";
    expect(formatDateTimeWithZone(date)).not.toBe(losAngeles);
  } finally {
    process.env.TZ = original;
  }
});

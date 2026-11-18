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

import { expect, test } from "bun:test";
import { formatMediumDate } from "./dateFormatters";

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

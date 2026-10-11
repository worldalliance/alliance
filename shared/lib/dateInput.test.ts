import { expect, test } from "bun:test";
import { dateToInputValue } from "./dateInput";

test("dateToInputValue formats the local calendar date", () => {
  expect(dateToInputValue(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
});

test("dateToInputValue pads a year still being typed to four digits", () => {
  expect(dateToInputValue(new Date("0002-09-01T00:00"))).toBe("0002-09-01");
});

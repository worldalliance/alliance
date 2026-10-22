import { describe, expect, test } from "bun:test";
import { formatTime } from "./utils";

describe("formatTime", () => {
  const hoursFromNow = (hours: number) =>
    new Date(Date.now() + hours * 60 * 60 * 1000);

  test("drops date-fns's 'about' from a past time", () => {
    expect(formatTime(hoursFromNow(-2), { addSuffix: true })).toBe(
      "2 hours ago",
    );
  });

  test("drops 'about' from a future time", () => {
    expect(formatTime(hoursFromNow(2), { addSuffix: true })).toBe("in 2 hours");
  });

  test("omits the suffix when asked", () => {
    expect(formatTime(hoursFromNow(-2), { addSuffix: false })).toBe("2 hours");
  });
});

import { describe, expect, it } from "bun:test";
import { add, type Duration } from "date-fns";
import { getTimeLeftString } from "./reminderKeywords";

const now = new Date("2026-03-10T12:00:00Z");
const deadlineIn = (duration: Duration) => ({ date: add(now, duration) });

describe("getTimeLeftString", () => {
  it.each([
    [{ days: 2, hours: 23, minutes: 59 }, "3 days", "3 days", "0 hours"],
    [{ days: 3, minutes: 2 }, "3 days", "3 days", "0 hours"],
    [{ days: 1, hours: 8 }, "1 day, 8 hours", "1 day", "8 hours"],
    [{ hours: 3 }, "3 hours", "0 days", "3 hours"],
    [{ hours: 2, minutes: 59 }, "3 hours", "0 days", "3 hours"],
    [{ minutes: 59 }, "1 hour", "0 days", "1 hour"],
    [{ minutes: -1 }, "0 hours", "0 days", "0 hours"],
  ])("states %o left as %s, %s, or %s", (duration, both, days, hours) => {
    const deadline = deadlineIn(duration);
    expect(getTimeLeftString(deadline, now)).toBe(both);
    expect(getTimeLeftString(deadline, now, "days")).toBe(days);
    expect(getTimeLeftString(deadline, now, "hours")).toBe(hours);
  });
});

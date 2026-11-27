import { describe, expect, it } from "bun:test";
import { formatDate, formatDateTime, formatTime } from "./formatDate";

const now = new Date("2026-11-24T12:00:00Z");
const timeZone = "America/Los_Angeles";

describe("formatDate", () => {
  it("leaves the year off a date in this year", () => {
    expect(formatDate("2026-11-30T20:00:00Z", { now, timeZone })).toBe(
      "Nov 30",
    );
  });

  it("shows the year of a date in another year", () => {
    expect(formatDate("2025-11-30T20:00:00Z", { now, timeZone })).toBe(
      "Nov 30, 2025",
    );
  });

  it("leads with the weekday when asked", () => {
    expect(
      formatDate("2026-11-24T20:00:00Z", { now, timeZone, weekday: true }),
    ).toBe("Tue, Nov 24");
  });

  it("reads the day in the named zone", () => {
    expect(formatDate("2026-11-25T03:00:00Z", { now, timeZone })).toBe(
      "Nov 24",
    );
  });
});

describe("formatTime", () => {
  it("names the zone it was asked to show", () => {
    expect(formatTime("2026-11-25T03:00:00Z", { timeZone })).toBe("7:00 PM PT");
  });

  it("calls UTC UTC", () => {
    expect(formatTime("2026-11-25T03:00:00Z", { timeZone: "UTC" })).toBe(
      "3:00 AM UTC",
    );
  });
});

describe("formatDateTime", () => {
  it("joins the date and the time", () => {
    expect(
      formatDateTime("2026-11-25T03:00:00Z", { now, timeZone, weekday: true }),
    ).toBe("Tue, Nov 24, 7:00 PM PT");
  });
});

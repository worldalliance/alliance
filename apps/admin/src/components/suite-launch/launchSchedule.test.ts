import { describe, expect, it } from "bun:test";
import {
  completionDays,
  completionTime,
  defaultLaunchSchedule,
} from "./launchSchedule";

const schedule = (now: string) => {
  const { memberActionAt, officeActionAt } = defaultLaunchSchedule(
    new Date(now),
  );
  return {
    memberActionAt: memberActionAt.toISOString(),
    officeActionAt: officeActionAt.toISOString(),
  };
};

describe("defaultLaunchSchedule", () => {
  it("starts at 7pm Pacific the same day when that is at least 30 minutes away", () => {
    expect(schedule("2026-01-15T18:00:00Z")).toEqual({
      memberActionAt: "2026-01-16T03:00:00.000Z",
      officeActionAt: "2026-01-23T07:59:00.000Z",
    });
  });

  it("keeps 7pm when it is exactly 30 minutes away", () => {
    expect(schedule("2026-01-16T02:30:00Z").memberActionAt).toBe(
      "2026-01-16T03:00:00.000Z",
    );
  });

  it("moves to the next whole hour at least 30 minutes away once 7pm is too close", () => {
    expect(schedule("2026-01-16T02:31:00Z").memberActionAt).toBe(
      "2026-01-16T04:00:00.000Z",
    );
    expect(schedule("2026-01-16T04:10:00Z").memberActionAt).toBe(
      "2026-01-16T05:00:00.000Z",
    );
    expect(schedule("2026-01-16T04:30:00Z").memberActionAt).toBe(
      "2026-01-16T05:00:00.000Z",
    );
  });

  it("follows daylight saving time", () => {
    expect(schedule("2026-07-15T18:00:00Z")).toEqual({
      memberActionAt: "2026-07-16T02:00:00.000Z",
      officeActionAt: "2026-07-23T06:59:00.000Z",
    });
  });

  it("puts the office deadline seven days after a start that rolled past midnight", () => {
    expect(schedule("2026-01-16T07:45:00Z")).toEqual({
      memberActionAt: "2026-01-16T09:00:00.000Z",
      officeActionAt: "2026-01-24T07:59:00.000Z",
    });
  });
});

describe("completionTime", () => {
  it("spells out the time between members starting and the office deadline", () => {
    expect(
      completionTime({
        memberActionAt: new Date("2026-01-16T03:00:00Z"),
        officeActionAt: new Date("2026-01-23T07:59:00Z"),
      }),
    ).toBe("7 days 4 hours 59 minutes");
  });

  it("drops units that are zero", () => {
    expect(
      completionTime({
        memberActionAt: new Date("2026-01-16T03:00:00Z"),
        officeActionAt: new Date("2026-01-19T03:00:00Z"),
      }),
    ).toBe("3 days");
  });

  it("counts days by Pacific wall-clock time across a daylight saving change", () => {
    expect(
      completionTime({
        memberActionAt: new Date("2027-03-14T07:00:00Z"),
        officeActionAt: new Date("2027-03-21T06:59:00Z"),
      }),
    ).toBe("7 days 59 minutes");
    expect(
      completionTime({
        memberActionAt: new Date("2027-11-05T17:00:00Z"),
        officeActionAt: new Date("2027-11-12T17:30:00Z"),
      }),
    ).toBe("6 days 23 hours 30 minutes");
  });

  it("counts the time past the last whole day in real hours", () => {
    expect(
      completionTime({
        memberActionAt: new Date("2026-10-25T08:45:00Z"),
        officeActionAt: new Date("2026-11-01T09:30:00Z"),
      }),
    ).toBe("7 days 45 minutes");
    expect(
      completionTime({
        memberActionAt: new Date("2027-03-08T09:00:00Z"),
        officeActionAt: new Date("2027-03-14T10:30:00Z"),
      }),
    ).toBe("6 days 1 hour 30 minutes");
  });

  it("reads a period ending in the repeated or skipped hour as the time it lasts", () => {
    expect(
      completionTime({
        memberActionAt: new Date("2026-11-01T08:30:00Z"),
        officeActionAt: new Date("2026-11-01T09:15:00Z"),
      }),
    ).toBe("45 minutes");
    expect(
      completionTime({
        memberActionAt: new Date("2027-03-13T10:30:00Z"),
        officeActionAt: new Date("2027-03-14T10:10:00Z"),
      }),
    ).toBe("23 hours 40 minutes");
  });

  it("can read 24 hours past the last whole day on the day clocks fall back", () => {
    expect(
      completionTime({
        memberActionAt: new Date("2026-10-26T06:30:00Z"),
        officeActionAt: new Date("2026-11-02T07:00:00Z"),
      }),
    ).toBe("6 days 24 hours 30 minutes");
  });
});

describe("completionDays", () => {
  it("counts a deadline centuries out without stepping through every day", () => {
    const started = performance.now();
    expect(
      completionDays({
        memberActionAt: new Date("2026-01-15T20:00:00Z"),
        officeActionAt: new Date("3026-01-15T20:00:00Z"),
      }),
    ).toBe(365_242);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

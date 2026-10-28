import { describe, expect, it } from "bun:test";
import { defaultLaunchSchedule } from "./launchSchedule";

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

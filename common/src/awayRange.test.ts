import {
  hasAwayRangeEnded,
  isAwayRangeActiveAt,
  isAwayRangeStartLocked,
} from "./awayRange";

describe("isAwayRangeActiveAt", () => {
  const range = {
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2026-03-07T23:59:00.000Z"),
  };
  const at = (date: Date, offsetMs: number) =>
    isAwayRangeActiveAt(range, new Date(date.getTime() + offsetMs));

  it("counts the start instant but not the end instant", () => {
    expect(at(range.startDate, -1)).toBe(false);
    expect(at(range.startDate, 0)).toBe(true);
    expect(at(range.endDate, -1)).toBe(true);
    expect(at(range.endDate, 0)).toBe(false);
  });
});

const now = new Date("2026-10-05T12:00:00Z");

describe("isAwayRangeStartLocked", () => {
  it("leaves a range that has not begun movable", () => {
    expect(
      isAwayRangeStartLocked(
        {
          startDate: "2026-10-05T12:00:01Z",
          createdAt: "2026-09-01T00:00:00Z",
        },
        now,
      ),
    ).toBe(false);
  });

  it("leaves a begun range movable for an hour after its creation", () => {
    expect(
      isAwayRangeStartLocked(
        {
          startDate: "2026-10-05T11:30:00Z",
          createdAt: "2026-10-05T11:00:01Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isAwayRangeStartLocked(
        {
          startDate: "2026-10-05T11:30:00Z",
          createdAt: "2026-10-05T11:00:00Z",
        },
        now,
      ),
    ).toBe(true);
  });
});

describe("isAwayRangeStartLocked for a backdated range", () => {
  it("locks a range that starts before its creation at once", () => {
    expect(
      isAwayRangeStartLocked(
        {
          startDate: "2026-09-20T00:00:00Z",
          createdAt: "2026-10-05T11:50:00Z",
        },
        now,
      ),
    ).toBe(true);
  });
});

describe("hasAwayRangeEnded", () => {
  it("counts a range as ended from its end instant on", () => {
    expect(hasAwayRangeEnded({ endDate: "2026-10-05T11:59:59Z" }, now)).toBe(
      true,
    );
    expect(hasAwayRangeEnded({ endDate: "2026-10-05T12:00:00Z" }, now)).toBe(
      true,
    );
    expect(hasAwayRangeEnded({ endDate: "2026-10-05T12:00:01Z" }, now)).toBe(
      false,
    );
  });
});

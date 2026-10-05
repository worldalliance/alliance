import {
  AWAY_REASON_OPTIONS,
  AwayRangeRemoval,
  awayRangeRemoval,
  AwayRangeStatus,
  awayRangeStatus,
  changedAwayRangeDays,
  formatAwayReason,
} from "./awayRangesFormatters";

describe("away reason labels", () => {
  it("labels each reason for display", () => {
    expect(formatAwayReason("vacation")).toBe("Vacation");
    expect(formatAwayReason("other")).toBe("Other");
  });

  it("offers every reason as an option with its label", () => {
    expect(AWAY_REASON_OPTIONS).toEqual([
      { value: "vacation", label: "Vacation" },
      { value: "emergency", label: "Emergency" },
      { value: "other", label: "Other" },
    ]);
  });
});

describe("awayRangeStatus", () => {
  const range = {
    startDate: "2026-03-01T00:00:00.000Z",
    endDate: "2026-03-07T23:59:00.000Z",
  };

  it.each([
    ["2026-02-28T23:59:59.999Z", AwayRangeStatus.Upcoming],
    ["2026-03-01T00:00:00.000Z", AwayRangeStatus.Current],
    ["2026-03-07T23:58:59.999Z", AwayRangeStatus.Current],
    ["2026-03-07T23:59:00.000Z", AwayRangeStatus.Past],
  ])("at %s is %s", (now, status) => {
    expect(awayRangeStatus(range, new Date(now))).toBe(status);
  });
});

describe("changedAwayRangeDays", () => {
  const opened = { start: "2030-01-10", end: "2030-01-12" };

  it("leaves untouched days out", () => {
    expect(changedAwayRangeDays({ edited: opened, opened })).toEqual({
      startDay: undefined,
      endDay: undefined,
    });
  });

  it("sends only the day that changed", () => {
    expect(
      changedAwayRangeDays({
        edited: { start: "2030-01-05", end: opened.end },
        opened,
      }),
    ).toEqual({ startDay: "2030-01-05", endDay: undefined });
    expect(
      changedAwayRangeDays({
        edited: { start: opened.start, end: "2030-01-20" },
        opened,
      }),
    ).toEqual({ startDay: undefined, endDay: "2030-01-20" });
  });
});

describe("awayRangeRemoval", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const createdAt = "2026-09-01T00:00:00Z";
  const later = "2026-10-06T00:00:00Z";
  const earlier = "2026-10-05T11:45:00Z";

  it("deletes a range whose start has not locked, even once it has ended", () => {
    expect(
      awayRangeRemoval(
        { startDate: "2026-10-05T12:00:01Z", endDate: later, createdAt },
        now,
      ),
    ).toBe(AwayRangeRemoval.Delete);
    expect(
      awayRangeRemoval(
        {
          startDate: "2026-10-05T11:30:00Z",
          endDate: earlier,
          createdAt: "2026-10-05T11:30:00Z",
        },
        now,
      ),
    ).toBe(AwayRangeRemoval.Delete);
  });

  it("ends a locked range in progress and refuses a locked one that has ended", () => {
    expect(
      awayRangeRemoval(
        { startDate: "2026-10-05T12:00:00Z", endDate: later, createdAt },
        now,
      ),
    ).toBe(AwayRangeRemoval.EndNow);
    expect(
      awayRangeRemoval(
        { startDate: "2026-10-01T00:00:00Z", endDate: earlier, createdAt },
        now,
      ),
    ).toBeNull();
  });
});

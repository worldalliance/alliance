import {
  AWAY_REASON_OPTIONS,
  AwayRangeStatus,
  awayRangeStatus,
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

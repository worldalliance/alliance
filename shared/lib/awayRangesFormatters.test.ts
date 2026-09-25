import { AWAY_REASON_OPTIONS, formatAwayReason } from "./awayRangesFormatters";

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

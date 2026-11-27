import {
  monthlyChurnRate,
  type ParsedContractStatusPoint,
} from "./contractStatusHistory";

const point = (
  date: string,
  activeCount: number,
  churnedCount: number,
): ParsedContractStatusPoint => ({
  date,
  activeCount,
  churnedCount,
  totalEverSigned: activeCount + churnedCount,
  parsedDate: new Date(`${date}T00:00:00Z`),
});

describe("monthlyChurnRate", () => {
  it("is null without history", () => {
    expect(monthlyChurnRate([])).toBeNull();
  });

  it("measures churn since the last point at least 30 days back", () => {
    expect(
      monthlyChurnRate([
        point("2026-01-01", 100, 0),
        point("2026-01-20", 80, 10),
        point("2026-02-15", 70, 30),
      ]),
    ).toBe(30);
  });

  it("is null when the history doesn't reach back 28 days", () => {
    expect(
      monthlyChurnRate([
        point("2026-01-20", 80, 10),
        point("2026-02-15", 70, 30),
      ]),
    ).toBeNull();
  });

  it("is null when no one was active a month back", () => {
    expect(
      monthlyChurnRate([point("2026-01-01", 0, 0), point("2026-02-15", 5, 1)]),
    ).toBeNull();
  });
});

import type { ContractStatusPointDto } from "@alliance/shared/client/types.gen";
import {
  monthlyChurnRate,
  parseContractStatusHistory,
} from "./contractStatusHistory";

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
afterEach(() => {
  process.env.TZ = hostZone;
});

const point = (
  date: string,
  activeCount: number,
  churnedCount: number,
): ContractStatusPointDto => ({
  date,
  activeCount,
  churnedCount,
  totalEverSigned: activeCount + churnedCount,
});

const churn = (points: ContractStatusPointDto[]) =>
  monthlyChurnRate(parseContractStatusHistory(points));

describe("monthlyChurnRate", () => {
  it("is null without history", () => {
    expect(churn([])).toBeNull();
  });

  it("measures churn since the last point at least 30 days back", () => {
    expect(
      churn([
        point("2026-01-01", 100, 0),
        point("2026-01-20", 80, 10),
        point("2026-02-15", 70, 30),
      ]),
    ).toBe(30);
  });

  it("is null when the history doesn't reach back 28 days", () => {
    expect(
      churn([point("2026-01-20", 80, 10), point("2026-02-15", 70, 30)]),
    ).toBeNull();
  });

  it("looks back exactly 30 days across a daylight saving change west of UTC", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(
      churn([
        point("2026-10-15", 100, 0),
        point("2026-10-16", 50, 0),
        point("2026-11-15", 40, 10),
      ]),
    ).toBe(20);
  });

  it("is null when no one was active a month back", () => {
    expect(
      churn([point("2026-01-01", 0, 0), point("2026-02-15", 5, 1)]),
    ).toBeNull();
  });
});

describe("parseContractStatusHistory", () => {
  it("puts each point on its own day west of UTC", () => {
    process.env.TZ = "America/Los_Angeles";
    const [parsed] = parseContractStatusHistory([point("2026-01-01", 1, 0)]);
    expect(parsed.parsedDate.toDateString()).toBe("Thu Jan 01 2026");
  });
});

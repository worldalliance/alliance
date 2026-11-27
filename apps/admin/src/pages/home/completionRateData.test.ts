import { actionStat } from "./actionStatFixture";
import {
  cumulativeCompletionPoints,
  paddedRateDomain,
  weeklyCompletionPoints,
} from "./completionRateData";

const endingOn = (month: number, day: number) =>
  new Date(2026, month - 1, day, 12).toISOString();

const now = new Date(2026, 2, 1);
const range = { start: "2026-01-10", end: "2026-02-28" };

describe.each([
  ["cumulativeCompletionPoints", cumulativeCompletionPoints],
  ["weeklyCompletionPoints", weeklyCompletionPoints],
])("%s", (_name, points) => {
  it("skips onboarding, optional, hidden, and undated actions", () => {
    expect(
      points(
        [
          actionStat({
            memberActionEndDate: endingOn(1, 20),
            onboarding: true,
          }),
          actionStat({ memberActionEndDate: endingOn(1, 20), optional: true }),
          actionStat({
            memberActionEndDate: endingOn(1, 20),
            showInChart: false,
          }),
          actionStat({ memberActionEndDate: null }),
        ],
        range,
        now,
      ),
    ).toEqual([]);
  });

  it("skips an action in range that hasn't ended yet", () => {
    expect(
      points(
        [actionStat({ memberActionEndDate: endingOn(2, 20) })],
        range,
        new Date(2026, 1, 15),
      ),
    ).toEqual([]);
  });

  it("is empty for a range that ends before it starts", () => {
    expect(
      points(
        [actionStat({ memberActionEndDate: endingOn(1, 20) })],
        { start: "2026-02-01", end: "2026-01-01" },
        now,
      ),
    ).toEqual([]);
  });

  it("skips an action that ended after the range", () => {
    expect(
      points(
        [actionStat({ memberActionEndDate: endingOn(2, 20) })],
        { start: "2026-01-10", end: "2026-02-10" },
        now,
      ),
    ).toEqual([]);
  });
});

describe("cumulativeCompletionPoints", () => {
  it("averages every ended action up to each day, starting before the range", () => {
    const points = cumulativeCompletionPoints(
      [
        actionStat({ memberActionEndDate: endingOn(1, 2), completionRate: 1 }),
        actionStat({
          memberActionEndDate: endingOn(1, 20),
          completionRate: 0.5,
        }),
        actionStat({ memberActionEndDate: endingOn(1, 20), completionRate: 0 }),
        actionStat({
          memberActionEndDate: endingOn(2, 3),
          completionRate: 0.5,
        }),
      ],
      range,
      now,
    );

    expect(
      points.map(({ avgRate, actionCount, actionNames }) => ({
        avgRate,
        actionCount,
        actionNames: actionNames.length,
      })),
    ).toEqual([
      { avgRate: 0.5, actionCount: 3, actionNames: 2 },
      { avgRate: 0.5, actionCount: 4, actionNames: 1 },
    ]);
  });
});

describe("weeklyCompletionPoints", () => {
  it("pools completions over joins for each Monday-start week in range", () => {
    const points = weeklyCompletionPoints(
      [
        actionStat({
          actionName: "B",
          memberActionEndDate: endingOn(1, 20),
          usersCompleted: 1,
          usersJoined: 4,
        }),
        actionStat({
          actionName: "A",
          memberActionEndDate: endingOn(1, 23),
          usersCompleted: 3,
          usersJoined: 4,
        }),
        actionStat({
          memberActionEndDate: endingOn(1, 2),
          usersCompleted: 4,
          usersJoined: 4,
        }),
      ],
      range,
      now,
    );

    expect(points).toEqual([
      {
        date: new Date(2026, 0, 19),
        weekRate: 0.5,
        actionCount: 2,
        completedCount: 4,
        joinedCount: 8,
        actionNames: ["A", "B"],
      },
    ]);
  });

  it("is 0 for a week no one joined", () => {
    expect(
      weeklyCompletionPoints(
        [
          actionStat({
            memberActionEndDate: endingOn(1, 20),
            usersCompleted: 0,
            usersJoined: 0,
          }),
        ],
        range,
        now,
      ).map((point) => point.weekRate),
    ).toEqual([0]);
  });
});

describe("paddedRateDomain", () => {
  it("pads the rates by a tenth of their spread, within [0, 1]", () => {
    const [low, high] = paddedRateDomain([0.4, 0.6, Number.NaN]) ?? [];
    expect(low).toBeCloseTo(0.38);
    expect(high).toBeCloseTo(0.62);
    expect(paddedRateDomain([0, 1])).toEqual([0, 1]);
  });

  it("is undefined without a finite rate", () => {
    expect(paddedRateDomain([Number.NaN])).toBeUndefined();
  });
});

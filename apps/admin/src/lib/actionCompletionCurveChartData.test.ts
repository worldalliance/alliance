import type { ActionCompletionCurveDto } from "@alliance/shared/client/types.gen";
import {
  buildActionCompletionCurveChartData,
  curveDurationDays,
} from "./actionCompletionCurveChartData";

const curve = (
  overrides: Partial<ActionCompletionCurveDto> & { actionId: number },
): ActionCompletionCurveDto => ({
  actionName: `Action ${overrides.actionId}`,
  usersJoined: 10,
  memberActionStartDate: "2026-01-01T00:00:00.000Z",
  memberActionEndDate: "2026-01-03T00:00:00.000Z",
  bucketDays: 1,
  dayOffsets: [0, 1],
  completedCounts: [1, 2],
  completionFractions: [0.1, 0.2],
  ...overrides,
});

const build = (
  curves: ActionCompletionCurveDto[],
  options: Partial<Parameters<typeof buildActionCompletionCurveChartData>[0]>,
) =>
  buildActionCompletionCurveChartData({
    curves,
    isHourly: false,
    selectedActionId: "all",
    minDays: null,
    maxDays: null,
    ...options,
  });

const seriesKeys = (data: ReturnType<typeof build>) =>
  data.multiLineData.map((series) => series.key);

describe("curveDurationDays", () => {
  it("rounds a partial day up", () => {
    expect(
      curveDurationDays(
        curve({
          actionId: 1,
          memberActionEndDate: "2026-01-03T01:00:00.000Z",
        }),
      ),
    ).toBe(3);
  });
});

describe("buildActionCompletionCurveChartData", () => {
  it("returns no series when no curve passes the duration filter", () => {
    expect(build([curve({ actionId: 1 })], { minDays: 5 })).toEqual({
      multiLineData: [],
      maxX: 0,
      yDomain: undefined,
    });
  });

  it("drops curves whose offsets and fractions differ in length", () => {
    const data = build(
      [curve({ actionId: 1 }), curve({ actionId: 2, dayOffsets: [0] })],
      {},
    );
    expect(seriesKeys(data)).toEqual(["action-1", "average"]);
  });

  it("averages daily fractions per day and accumulates the average", () => {
    const data = build(
      [
        curve({ actionId: 1, completionFractions: [0.1, 0.2] }),
        curve({ actionId: 2, completionFractions: [0.3, 0.4] }),
      ],
      {},
    );
    const average = data.multiLineData.at(-1)!;
    expect(average.key).toBe("average");
    expect(average.data.map((p) => p.x)).toEqual([0, 1]);
    expect(average.data[0].completionFraction).toBeCloseTo(0.2);
    expect(average.data[1].completionFraction).toBeCloseTo(0.3);
    expect(average.data[1].cumulativeCompletionFraction).toBeCloseTo(0.5);
    expect(average.data[1].actionCount).toBe(2);
  });

  it("starts hourly curves at zero and shifts each offset by one hour", () => {
    const data = build(
      [
        curve({
          actionId: 1,
          dayOffsets: [],
          hourOffsets: [0, 1],
          memberActionEndDate: "2026-01-01T03:00:00.000Z",
        }),
      ],
      { isHourly: true },
    );
    const [series] = data.multiLineData;
    expect(series.data.map((p) => p.x)).toEqual([0, 1, 2]);
    expect(series.data.map((p) => p.cumulativeCompletionFraction)).toEqual([
      0,
      0.1,
      expect.closeTo(0.3),
    ]);
    expect(data.maxX).toBe(3);
  });

  it("shows only the selected action alongside the average", () => {
    const data = build(
      [
        curve({ actionId: 1 }),
        curve({
          actionId: 2,
          dayOffsets: [0, 5],
          memberActionEndDate: "2026-01-06T00:00:00.000Z",
        }),
      ],
      { selectedActionId: "1" },
    );
    expect(seriesKeys(data)).toEqual(["action-1", "average"]);
    expect(data.maxX).toBe(2);
  });

  it("pads the y domain above the highest value across every series", () => {
    const data = build(
      [
        curve({ actionId: 1, completionFractions: [0.1, 0.2] }),
        curve({ actionId: 2, completionFractions: [0.1, 0.5] }),
      ],
      { selectedActionId: "1" },
    );
    expect(data.yDomain?.[1]).toBeCloseTo(0.55);
  });
});

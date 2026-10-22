import type { ActionCompletionCurveDto } from "@alliance/shared/client/types.gen";
import chroma from "chroma-js";
import { millisecondsInDay, millisecondsInHour } from "date-fns/constants";
import type { DataPoint, MultiLineSeries } from "../components/TimeSeriesChart";

export type ActionCompletionCurveChartData = {
  multiLineData: MultiLineSeries[];
  maxX: number;
  yDomain: [number, number] | undefined;
};

export function curveDurationDays(curve: ActionCompletionCurveDto): number {
  const start = new Date(curve.memberActionStartDate).getTime();
  const end = curve.memberActionEndDate
    ? new Date(curve.memberActionEndDate).getTime()
    : Date.now();
  return Math.ceil((end - start) / millisecondsInDay);
}

function computeMaxOffset(
  curves: ActionCompletionCurveDto[],
  isHourly: boolean,
): number {
  const msPerUnit = isHourly ? millisecondsInHour : millisecondsInDay;
  let max = 0;
  for (const curve of curves) {
    if (isHourly) {
      const lastOffset = curve.hourOffsets?.at(-1);
      if (lastOffset !== undefined && lastOffset + 1 > max)
        max = lastOffset + 1;
    } else {
      const lastOffset = curve.dayOffsets?.at(-1);
      if (lastOffset !== undefined && lastOffset > max) max = lastOffset;
    }
    // Also derive from dates if offsets are shorter than the full action duration
    if (curve.memberActionEndDate) {
      const start = new Date(curve.memberActionStartDate).getTime();
      const end = new Date(curve.memberActionEndDate).getTime();
      const duration = Math.ceil((end - start) / msPerUnit);
      if (duration > max) max = duration;
    }
  }
  return Math.max(1, max);
}

export function buildActionCompletionCurveChartData({
  curves,
  isHourly,
  selectedActionId,
  minDays,
  maxDays,
}: {
  curves: ActionCompletionCurveDto[];
  isHourly: boolean;
  selectedActionId: string;
  minDays: number | null;
  maxDays: number | null;
}): ActionCompletionCurveChartData {
  function passesDurationFilter(curve: ActionCompletionCurveDto): boolean {
    if (minDays === null && maxDays === null) return true;
    const days = curveDurationDays(curve);
    if (minDays !== null && days < minDays) return false;
    if (maxDays !== null && days > maxDays) return false;
    return true;
  }

  const eligibleCurves = curves.filter((curve) => {
    if (isHourly) {
      const offsets = curve.hourOffsets;
      return (
        (offsets?.length ?? 0) > 0 &&
        (curve.completionFractions?.length ?? 0) === (offsets?.length ?? 0)
      );
    }
    return (
      (curve.dayOffsets?.length ?? 0) > 0 &&
      (curve.completionFractions?.length ?? 0) ===
        (curve.dayOffsets?.length ?? 0)
    );
  });

  const durationFilteredCurves = eligibleCurves.filter(passesDurationFilter);

  if (durationFilteredCurves.length === 0) {
    return { multiLineData: [], maxX: 0, yDomain: undefined };
  }

  const maxX = computeMaxOffset(durationFilteredCurves, isHourly);

  const colorScale = chroma
    .scale(["#0ea5e9", "#6366f1", "#14b8a6"])
    .mode("lch")
    .domain([0, Math.max(1, durationFilteredCurves.length - 1)]);

  const sumByBucket = new Array<number>(maxX + 1).fill(0);
  const countByBucket = new Array<number>(maxX + 1).fill(0);

  const actionSeries: MultiLineSeries[] = durationFilteredCurves
    .slice()
    .sort((a, b) => a.actionName.localeCompare(b.actionName))
    .map((curve, index) => {
      const data: DataPoint[] = [];
      let cumulativeFraction = 0;
      let cumulativeCount = 0;
      const offsets = isHourly ? curve.hourOffsets! : curve.dayOffsets;

      if (isHourly) {
        // Start with a zero point at x=0 ("at the start of hour 0")
        data.push({
          x: 0,
          completionFraction: 0,
          completionCount: 0,
          cumulativeCompletionFraction: 0,
          cumulativeCompletionCount: 0,
          usersJoined: curve.usersJoined,
          actionId: curve.actionId,
          actionName: curve.actionName,
        });
        sumByBucket[0] += 0;
        countByBucket[0] += 1;

        offsets.forEach((offset, idx) => {
          if (!Number.isFinite(offset) || offset < 0 || offset >= maxX) {
            return;
          }
          const completionFraction = curve.completionFractions[idx] ?? 0;
          const completionCount = curve.completedCounts[idx] ?? 0;
          if (Number.isFinite(completionFraction)) {
            cumulativeFraction += completionFraction;
            cumulativeCount += completionCount;
          }
          // Shift by +1: value at x represents cumulative at the START of hour x
          const shiftedX = offset + 1;
          sumByBucket[shiftedX] += cumulativeFraction;
          countByBucket[shiftedX] += 1;
          data.push({
            x: shiftedX,
            completionFraction,
            completionCount,
            cumulativeCompletionFraction: cumulativeFraction,
            cumulativeCompletionCount: cumulativeCount,
            usersJoined: curve.usersJoined,
            actionId: curve.actionId,
            actionName: curve.actionName,
          });
        });
      } else {
        offsets.forEach((offset, idx) => {
          if (!Number.isFinite(offset) || offset < 0 || offset > maxX) {
            return;
          }
          const completionFraction = curve.completionFractions[idx] ?? 0;
          const completionCount = curve.completedCounts[idx] ?? 0;
          if (Number.isFinite(completionFraction)) {
            sumByBucket[offset] += completionFraction;
            countByBucket[offset] += 1;
            cumulativeFraction += completionFraction;
            cumulativeCount += completionCount;
          }
          data.push({
            x: offset,
            completionFraction,
            completionCount,
            cumulativeCompletionFraction: cumulativeFraction,
            cumulativeCompletionCount: cumulativeCount,
            usersJoined: curve.usersJoined,
            actionId: curve.actionId,
            actionName: curve.actionName,
          });
        });
      }

      return {
        key: `action-${curve.actionId}`,
        label: curve.actionName,
        color: chroma(colorScale(index)).alpha(0.45).css(),
        data,
      };
    });

  type AveragePoint = {
    x: number;
    completionFraction: number;
    cumulativeCompletionFraction: number;
    actionCount: number;
  };

  let avgCumulativeFraction = 0;
  const averageData = sumByBucket
    .map((sum, offset) => {
      const count = countByBucket[offset];
      if (!count) return null;
      const fraction = sum / count;
      if (isHourly) {
        // sumByBucket already holds cumulative values in hourly mode
        return {
          x: offset,
          completionFraction: fraction,
          cumulativeCompletionFraction: fraction,
          actionCount: count,
        };
      }
      avgCumulativeFraction += fraction;
      return {
        x: offset,
        completionFraction: fraction,
        cumulativeCompletionFraction: avgCumulativeFraction,
        actionCount: count,
      };
    })
    .filter((point): point is AveragePoint => point !== null);

  const averageSeries: MultiLineSeries = {
    key: "average",
    label: "Average trend",
    color: "#111827",
    data: averageData,
  };

  const filteredActionSeries =
    selectedActionId === "all"
      ? actionSeries
      : actionSeries.filter(
          (series) => series.key === `action-${selectedActionId}`,
        );

  // Compute display x-axis range from the selected curves only
  const selectedCurveIds = new Set(
    filteredActionSeries.map((s) => s.key.replace("action-", "")),
  );
  const displayedCurves =
    selectedCurveIds.size > 0
      ? durationFilteredCurves.filter((c) =>
          selectedCurveIds.has(String(c.actionId)),
        )
      : durationFilteredCurves;
  const displayedMaxX = computeMaxOffset(displayedCurves, isHourly);

  const displayedSeries = [...filteredActionSeries, averageSeries];
  const allSeries = [...actionSeries, averageSeries];

  const yValueKey = isHourly
    ? "cumulativeCompletionFraction"
    : "completionFraction";
  const allValues = allSeries.flatMap((series) =>
    series.data
      .map((point) => point[yValueKey] as number)
      .filter((value) => Number.isFinite(value)),
  );
  const maxValue = allValues.length ? Math.max(...allValues) : 0;
  const paddedMax =
    maxValue > 0 ? Math.min(1, Math.max(0.05, maxValue * 1.1)) : 0.1;

  return {
    multiLineData: displayedSeries,
    maxX: displayedMaxX,
    yDomain: [0, paddedMax],
  };
}

import chroma from "chroma-js";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { analyticsGetActionCompletionCurves } from "@alliance/shared/client";
import { ActionCompletionCurveDto } from "@alliance/shared/client/types.gen";
import {
  TimeSeriesChart,
  type DataPoint,
  type MultiLineSeries,
} from "./TimeSeriesChart";

type ActionCompletionCurveChartProps = {
  title?: string;
  actionId?: number;
  showSelector?: boolean;
  refreshKey?: number;
};

type GranularityMode = "daily" | "hourly";

function computeMaxOffset(
  curves: ActionCompletionCurveDto[],
  isHourly: boolean,
): number {
  const msPerUnit = isHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  let max = 0;
  for (const curve of curves) {
    if (isHourly) {
      const lastOffset = curve.hourOffsets?.at(-1);
      if (lastOffset !== undefined && lastOffset + 1 > max) max = lastOffset + 1;
    } else {
      const lastOffset = curve.dayOffsets?.at(-1);
      if (lastOffset !== undefined && lastOffset > max) max = lastOffset;
    }
    // Also derive from dates if offsets are shorter than the full action duration
    if (curve.memberActionStartDate && curve.memberActionEndDate) {
      const start = new Date(curve.memberActionStartDate).getTime();
      const end = new Date(curve.memberActionEndDate).getTime();
      const duration = Math.ceil((end - start) / msPerUnit);
      if (duration > max) max = duration;
    }
  }
  return Math.max(1, max);
}

const ActionCompletionCurveChart: React.FC<ActionCompletionCurveChartProps> = ({
  title = "Completions throughout week",
  actionId,
  showSelector = true,
  refreshKey,
}) => {
  const [actionCompletionCurves, setActionCompletionCurves] = useState<
    ActionCompletionCurveDto[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedActionId, setSelectedActionId] = useState<string>(
    actionId !== undefined ? String(actionId) : "all"
  );
  const [granularity, setGranularity] = useState<GranularityMode>("hourly");
  const [minDurationDays, setMinDurationDays] = useState<string>("");
  const [maxDurationDays, setMaxDurationDays] = useState<string>("");

  useEffect(() => {
    if (actionId === undefined) return;
    setSelectedActionId(String(actionId));
  }, [actionId]);

  const loadActionCompletionCurves = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch all curves - needed to compute the average line
      const response = await analyticsGetActionCompletionCurves({
        query: { granularity },
      });
      setActionCompletionCurves(response.data ?? []);
    } catch (err) {
      console.error("Failed to load action completion curves", err);
    } finally {
      setLoading(false);
    }
  }, [granularity]);

  useEffect(() => {
    void loadActionCompletionCurves();
  }, [loadActionCompletionCurves, refreshKey]);

  const completionCurveActionOptions = useMemo(() => {
    return actionCompletionCurves
      .slice()
      .sort((a, b) => {
        const dateA = a.memberActionStartDate
          ? new Date(a.memberActionStartDate).getTime()
          : Number.NEGATIVE_INFINITY;
        const dateB = b.memberActionStartDate
          ? new Date(b.memberActionStartDate).getTime()
          : Number.NEGATIVE_INFINITY;
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        return a.actionName.localeCompare(b.actionName);
      })
      .map((curve) => ({
        id: String(curve.actionId),
        name: curve.actionName,
      }));
  }, [actionCompletionCurves]);

  const completionCurveActionOrder = useMemo(
    () => ["all", ...completionCurveActionOptions.map((option) => option.id)],
    [completionCurveActionOptions]
  );

  const stepCompletionAction = useCallback(
    (direction: -1 | 1) => {
      if (completionCurveActionOrder.length === 0) return;
      const currentIndex = completionCurveActionOrder.indexOf(
        selectedActionId
      );
      const startIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (startIndex + direction + completionCurveActionOrder.length) %
        completionCurveActionOrder.length;
      setSelectedActionId(completionCurveActionOrder[nextIndex]);
    },
    [completionCurveActionOrder, selectedActionId]
  );

  useEffect(() => {
    if (actionId !== undefined) return;
    if (selectedActionId === "all") return;
    const exists = completionCurveActionOptions.some(
      (option) => option.id === selectedActionId
    );
    if (!exists) {
      setSelectedActionId("all");
    }
  }, [actionId, completionCurveActionOptions, selectedActionId]);

  // Default duration filter to ±3 days of the selected action's duration
  const effectiveActionId = actionId !== undefined ? String(actionId) : selectedActionId;
  useEffect(() => {
    if (effectiveActionId === "all") {
      setMinDurationDays("");
      setMaxDurationDays("");
      return;
    }
    const curve = actionCompletionCurves.find(
      (c) => String(c.actionId) === effectiveActionId
    );
    if (!curve?.memberActionStartDate) return;
    const msPerDay = 24 * 60 * 60 * 1000;
    const start = new Date(curve.memberActionStartDate).getTime();
    const end = curve.memberActionEndDate
      ? new Date(curve.memberActionEndDate).getTime()
      : Date.now();
    const durationDays = Math.ceil((end - start) / msPerDay);
    setMinDurationDays(String(Math.max(0, durationDays - 3)));
    setMaxDurationDays(String(durationDays + 3));
  }, [effectiveActionId, actionCompletionCurves]);

  const isHourly = granularity === "hourly";

  const actionCompletionCurveChartData = useMemo(() => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const minDays = minDurationDays !== "" ? Number(minDurationDays) : null;
    const maxDays = maxDurationDays !== "" ? Number(maxDurationDays) : null;

    function curveDurationDays(curve: ActionCompletionCurveDto): number | null {
      if (!curve.memberActionStartDate) return null;
      const start = new Date(curve.memberActionStartDate).getTime();
      const end = curve.memberActionEndDate
        ? new Date(curve.memberActionEndDate).getTime()
        : Date.now();
      return Math.ceil((end - start) / msPerDay);
    }

    function passesDurationFilter(curve: ActionCompletionCurveDto): boolean {
      if (minDays === null && maxDays === null) return true;
      const days = curveDurationDays(curve);
      if (days === null) return false;
      if (minDays !== null && days < minDays) return false;
      if (maxDays !== null && days > maxDays) return false;
      return true;
    }

    const eligibleCurves = actionCompletionCurves.filter((curve) => {
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
      return {
        multiLineData: [] as MultiLineSeries[],
        maxX: 0,
        yDomain: undefined as [number, number] | undefined,
      };
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
        const offsets = isHourly
          ? (curve.hourOffsets!)
          : curve.dayOffsets;

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

    const selectionId = actionId !== undefined ? String(actionId) : null;
    const filteredActionSeries = selectionId
      ? actionSeries.filter((series) => series.key === `action-${selectionId}`)
      : selectedActionId === "all"
        ? actionSeries
        : actionSeries.filter(
          (series) => series.key === `action-${selectedActionId}`
        );

    // Compute display x-axis range from the selected curves only
    const selectedCurveIds = new Set(
      filteredActionSeries.map((s) => s.key.replace("action-", ""))
    );
    const displayedCurves = selectedCurveIds.size > 0
      ? durationFilteredCurves.filter((c) => selectedCurveIds.has(String(c.actionId)))
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
        .filter((value) => Number.isFinite(value))
    );
    const maxValue = allValues.length ? Math.max(...allValues) : 0;
    const paddedMax =
      maxValue > 0 ? Math.min(1, Math.max(0.05, maxValue * 1.1)) : 0.1;

    return {
      multiLineData: displayedSeries,
      maxX: displayedMaxX,
      yDomain: [0, paddedMax] as [number, number],
    };
  }, [actionCompletionCurves, actionId, selectedActionId, isHourly, minDurationDays, maxDurationDays]);

  const showDropdown = showSelector && actionId === undefined;

  const formatHourLabel = (hours: number): string => {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    if (days === 0) return `${h}h`;
    if (h === 0) return `${days}d`;
    return `${days}d ${h}h`;
  };

  return (
    <TimeSeriesChart
      title={title}
      xType="number"
      loading={loading}
      emptyMessage="No action completion curves available."
      multiLineData={actionCompletionCurveChartData.multiLineData}
      getXValue={(d) => (d.x as number) ?? 0}
      getYValue={(d) =>
        isHourly
          ? ((d.cumulativeCompletionFraction as number) ?? 0)
          : ((d.completionFraction as number) ?? 0)
      }
      xAxisFormat={(v) =>
        isHourly ? formatHourLabel(Math.round(v)) : `${Math.round(v)}d`
      }
      xRange={{ min: 0, max: actionCompletionCurveChartData.maxX }}
      showDataPoints={!isHourly}
      getHoverXLabel={isHourly ? (d) => formatHourLabel((d.x as number) ?? 0) : undefined}
      yDomain={actionCompletionCurveChartData.yDomain}
      yAxisFormat={(v) => `${Math.round(v * 100)}%`}
      height={360}
      headerContent={
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 md:ml-auto">
          <div className="flex items-center rounded-md border border-gray-300 bg-white overflow-hidden">
            <button
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                granularity === "daily"
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setGranularity("daily")}
            >
              Daily
            </button>
            <button
              className={`px-2 py-1 text-xs font-medium transition-colors ${
                granularity === "hourly"
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setGranularity("hourly")}
            >
              Hourly CDF
            </button>
          </div>
          {showDropdown && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">
                Action
              </label>
              <select
                value={selectedActionId}
                onChange={(event) =>
                  setSelectedActionId(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    stepCompletionAction(-1);
                  }
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    stepCompletionAction(1);
                  }
                }}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs bg-white"
              >
                <option value="all">All actions</option>
                {completionCurveActionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-600">
              Duration (days)
            </label>
            <input
              type="number"
              min={0}
              placeholder="min"
              value={minDurationDays}
              onChange={(e) => setMinDurationDays(e.target.value)}
              className="w-14 rounded-md border border-gray-300 px-2 py-1 text-xs bg-white"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              min={0}
              placeholder="max"
              value={maxDurationDays}
              onChange={(e) => setMaxDurationDays(e.target.value)}
              className="w-14 rounded-md border border-gray-300 px-2 py-1 text-xs bg-white"
            />
            {(minDurationDays !== "" || maxDurationDays !== "") && (
              <button
                type="button"
                onClick={() => {
                  setMinDurationDays("");
                  setMaxDurationDays("");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-700 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      }
      getHoverContent={(point, series) => {
        const completionRate =
          typeof point.completionFraction === "number"
            ? point.completionFraction
            : 0;
        const cumulativeRate =
          typeof point.cumulativeCompletionFraction === "number"
            ? point.cumulativeCompletionFraction
            : 0;

        const xValue = point.x as number;
        const items: { label: string; value: string | number; color?: string }[] = isHourly
          ? [
              {
                label: "Cumulative completed",
                value: `${(cumulativeRate * 100).toFixed(2)}%`,
                color: series.color,
              },
            ]
          : [
              { label: "Day", value: xValue },
              {
                label: "Completions today",
                value: `${(completionRate * 100).toFixed(2)}%`,
                color: series.color,
              },
              {
                label: "Total completed",
                value: `${(cumulativeRate * 100).toFixed(2)}%`,
              },
            ];

        if (series.key === "average") {
          items.push({
            label: "Actions",
            value: point.actionCount as number,
          });
        } else if (!isHourly) {
          items.push(
            {
              label: "Completed",
              value: point.completionCount as number,
            },
            {
              label: "Joined",
              value: point.usersJoined as number,
            }
          );
        }

        return {
          title: series.label,
          items,
        };
      }}
    />
  );
};

export default ActionCompletionCurveChart;

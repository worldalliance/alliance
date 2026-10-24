import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import React, { useMemo, useState } from "react";
import {
  TimeSeriesChart,
  fullDateFormatter,
  type ChartSeries,
  type DataPoint,
} from "../TimeSeriesChart";
import {
  cumulativeCompletionPoints,
  paddedRateDomain,
  weeklyCompletionPoints,
} from "./completionRateData";

const actionNameItems = (point: DataPoint) =>
  ((point.actionNames as string[] | undefined) ?? []).map((name, index) => ({
    label: `Action ${index + 1}`,
    value: name.length > 40 ? `${name.slice(0, 40).trimEnd()}...` : name,
  }));

const fullRateDomain: [number, number] = [0, 1];

const CompletionRateCharts: React.FC<{
  actionStats: ActionStatsWithOnboardingDto[];
  actionStatsLoading: boolean;
}> = ({ actionStats, actionStatsLoading }) => {
  const [completionRateAbsolute, setCompletionRateAbsolute] =
    useState<boolean>(false);
  const [completionRateRange, setCompletionRateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    return {
      start: dateToInputValue(start),
      end: dateToInputValue(end),
    };
  });

  const cumulativeCompletionData = useMemo(
    () =>
      cumulativeCompletionPoints(actionStats, completionRateRange, new Date()),
    [actionStats, completionRateRange],
  );

  const cumulativeCompletionYDomain = useMemo(
    () =>
      completionRateAbsolute
        ? fullRateDomain
        : paddedRateDomain(cumulativeCompletionData.map((d) => d.avgRate)),
    [completionRateAbsolute, cumulativeCompletionData],
  );

  const cumulativeCompletionSeries: ChartSeries[] = useMemo(
    () => [
      {
        key: "avgRate",
        label: "Avg Rate",
        color: "#15803d",
        getValue: (d) => (d.avgRate as number) ?? 0,
      },
    ],
    [],
  );

  const weeklyCompletionData = useMemo(
    () => weeklyCompletionPoints(actionStats, completionRateRange, new Date()),
    [actionStats, completionRateRange],
  );

  const completionRateYDomain = useMemo(
    () =>
      completionRateAbsolute
        ? fullRateDomain
        : paddedRateDomain(weeklyCompletionData.map((d) => d.weekRate)),
    [completionRateAbsolute, weeklyCompletionData],
  );

  const completionRateSeries: ChartSeries[] = useMemo(
    () => [
      {
        key: "weekRate",
        label: "Weekly Rate",
        color: "#16a34a",
        getValue: (d) => (d.weekRate as number) ?? 0,
      },
    ],
    [],
  );

  const absoluteToggle = (
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 md:ml-auto">
      <input
        type="checkbox"
        checked={completionRateAbsolute}
        onChange={(event) => setCompletionRateAbsolute(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
      />
      Absolute
    </label>
  );

  return (
    <>
      <TimeSeriesChart
        title="Cumulative Completion Rate"
        data={cumulativeCompletionData}
        series={cumulativeCompletionSeries}
        loading={actionStatsLoading}
        emptyMessage="No completed actions in this date range."
        showArea
        areaSeriesKey="avgRate"
        areaColor="rgba(21, 128, 61, 0.14)"
        yDomain={cumulativeCompletionYDomain}
        yAxisFormat={(v) => `${Math.round(v * 100)}%`}
        showHoverOnlyOnHover
        yTickLabelDedup
        dateRange={completionRateRange}
        onDateRangeChange={setCompletionRateRange}
        headerContent={absoluteToggle}
        getHoverContent={(point) => ({
          title: fullDateFormatter.format(point.date),
          items: [
            {
              label: "Avg Rate",
              value: `${((point.avgRate as number) * 100).toFixed(2)}%`,
              color: "#15803d",
            },
            {
              label: "Total Actions",
              value: point.actionCount as number,
            },
            ...actionNameItems(point),
          ],
        })}
      />

      <TimeSeriesChart
        title="Non-Cumulative Completion Rate (Weekly)"
        data={weeklyCompletionData}
        series={completionRateSeries}
        loading={actionStatsLoading}
        emptyMessage="No completed actions in this date range."
        yDomain={completionRateYDomain}
        yAxisFormat={(v) => `${Math.round(v * 100)}%`}
        showHoverOnlyOnHover
        yTickLabelDedup
        dateRange={completionRateRange}
        onDateRangeChange={setCompletionRateRange}
        headerContent={absoluteToggle}
        getHoverContent={(point) => ({
          title: `Week of ${fullDateFormatter.format(point.date)}`,
          items: [
            {
              label: "Weekly Rate",
              value: `${((point.weekRate as number) * 100).toFixed(2)}%`,
              color: "#16a34a",
            },
            {
              label: "Actions",
              value: point.actionCount as number,
            },
            {
              label: "Completed / Joined",
              value: `${point.completedCount as number}/${
                point.joinedCount as number
              }`,
            },
            ...actionNameItems(point),
          ],
        })}
      />
    </>
  );
};

export default CompletionRateCharts;

import { hoursInDay } from "@alliance/common/duration";
import { analyticsGetActionCompletionCurvesAdmin } from "@alliance/shared/client";
import { ActionCompletionCurveDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildActionCompletionCurveChartData,
  curveDurationDays,
} from "../lib/actionCompletionCurveChartData";
import { TimeSeriesChart } from "./TimeSeriesChart";

type ActionCompletionCurveChartProps = {
  title?: string;
  actionId?: number;
  showSelector?: boolean;
};

type GranularityMode = "daily" | "hourly";

const noCurves: ActionCompletionCurveDto[] = [];

const ActionCompletionCurveChart: React.FC<ActionCompletionCurveChartProps> = ({
  title = "Completions throughout week",
  actionId,
  showSelector = true,
}) => {
  const [selectedActionId, setSelectedActionId] = useState<string>(
    actionId !== undefined ? String(actionId) : "all",
  );
  const [granularity, setGranularity] = useState<GranularityMode>("hourly");
  const [minDurationDays, setMinDurationDays] = useState<string>("");
  const [maxDurationDays, setMaxDurationDays] = useState<string>("");

  useEffect(() => {
    if (actionId === undefined) return;
    setSelectedActionId(String(actionId));
  }, [actionId]);

  const {
    data: actionCompletionCurves = noCurves,
    isPending,
    isPlaceholderData,
    isError,
  } = useQuery({
    queryKey: queryKeys.actionCompletionCurvesAdmin(granularity),
    // Always fetch all curves - needed to compute the average line
    queryFn: () =>
      analyticsGetActionCompletionCurvesAdmin({
        query: { granularity },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const loading = isPending || isPlaceholderData;

  const completionCurveActionOptions = useMemo(() => {
    return actionCompletionCurves
      .slice()
      .sort((a, b) => {
        const dateA = new Date(a.memberActionStartDate).getTime();
        const dateB = new Date(b.memberActionStartDate).getTime();
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
    [completionCurveActionOptions],
  );

  const stepCompletionAction = useCallback(
    (direction: -1 | 1) => {
      if (completionCurveActionOrder.length === 0) return;
      const currentIndex = completionCurveActionOrder.indexOf(selectedActionId);
      const startIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (startIndex + direction + completionCurveActionOrder.length) %
        completionCurveActionOrder.length;
      setSelectedActionId(completionCurveActionOrder[nextIndex]);
    },
    [completionCurveActionOrder, selectedActionId],
  );

  useEffect(() => {
    if (actionId !== undefined) return;
    if (selectedActionId === "all") return;
    const exists = completionCurveActionOptions.some(
      (option) => option.id === selectedActionId,
    );
    if (!exists) {
      setSelectedActionId("all");
    }
  }, [actionId, completionCurveActionOptions, selectedActionId]);

  // Default duration filter to ±3 days of the selected action's duration
  const effectiveActionId =
    actionId !== undefined ? String(actionId) : selectedActionId;
  useEffect(() => {
    if (effectiveActionId === "all") {
      setMinDurationDays("");
      setMaxDurationDays("");
      return;
    }
    const curve = actionCompletionCurves.find(
      (c) => String(c.actionId) === effectiveActionId,
    );
    if (!curve) return;
    const durationDays = curveDurationDays(curve);
    setMinDurationDays(String(Math.max(0, durationDays - 3)));
    setMaxDurationDays(String(durationDays + 3));
  }, [effectiveActionId, actionCompletionCurves]);

  const isHourly = granularity === "hourly";

  const actionCompletionCurveChartData = useMemo(
    () =>
      buildActionCompletionCurveChartData({
        curves: actionCompletionCurves,
        isHourly,
        selectedActionId: effectiveActionId,
        minDays: minDurationDays !== "" ? Number(minDurationDays) : null,
        maxDays: maxDurationDays !== "" ? Number(maxDurationDays) : null,
      }),
    [
      actionCompletionCurves,
      effectiveActionId,
      isHourly,
      minDurationDays,
      maxDurationDays,
    ],
  );

  const showDropdown = showSelector && actionId === undefined;

  const formatHourLabel = (hours: number): string => {
    const days = Math.floor(hours / hoursInDay);
    const h = hours % hoursInDay;
    if (days === 0) return `${h}h`;
    if (h === 0) return `${days}d`;
    return `${days}d ${h}h`;
  };

  return (
    <TimeSeriesChart
      title={title}
      xType="number"
      loading={loading}
      emptyMessage={
        isError
          ? "Unable to load action completion curves."
          : "No action completion curves available."
      }
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
      getHoverXLabel={
        isHourly ? (d) => formatHourLabel((d.x as number) ?? 0) : undefined
      }
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
                onChange={(event) => setSelectedActionId(event.target.value)}
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
        const items: {
          label: string;
          value: string | number;
          color?: string;
        }[] = isHourly
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
            },
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

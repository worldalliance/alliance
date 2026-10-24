// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import { analyticsGetMemberCompletionRetentionAdmin } from "@alliance/shared/client";
import { MemberCompletionRetentionCohortDto } from "@alliance/shared/client/types.gen";
import chroma from "chroma-js";
import { max, min } from "d3";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  TimeSeriesChart,
  fullDateFormatter,
  type MultiLineSeries,
} from "../TimeSeriesChart";
import CohortCompletionGrid from "./CohortCompletionGrid";

const CohortRetentionCharts: React.FC = () => {
  const [retentionCohorts, setRetentionCohorts] = useState<
    MemberCompletionRetentionCohortDto[]
  >([]);
  const [retentionLoading, setRetentionLoading] = useState<boolean>(false);
  const [weekRange, setWeekRange] = useState({ min: 0, max: 20 });

  const loadRetentionCohorts = useCallback(async () => {
    setRetentionLoading(true);
    try {
      const response = await analyticsGetMemberCompletionRetentionAdmin();
      setRetentionCohorts(response.data ?? []);
    } catch (err) {
      console.error("Failed to load retention cohorts", err);
    } finally {
      setRetentionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRetentionCohorts();
  }, [loadRetentionCohorts]);

  const sortedRetentionCohorts = useMemo(() => {
    return retentionCohorts
      .map((cohort) => ({
        ...cohort,
        points: [...cohort.points].sort((a, b) => a.weekIndex - b.weekIndex),
      }))
      .sort(
        (a, b) =>
          new Date(a.cohortStart).getTime() - new Date(b.cohortStart).getTime(),
      );
  }, [retentionCohorts]);

  const filteredRetentionCohorts = useMemo(() => {
    return sortedRetentionCohorts.filter((cohort) =>
      cohort.points.some((point) => point.completedCount > 0),
    );
  }, [sortedRetentionCohorts]);

  const retentionChartData = useMemo(() => {
    if (filteredRetentionCohorts.length === 0) {
      return { multiLineData: [], legendGradient: "", cohortMap: new Map() };
    }

    const cohortDates = filteredRetentionCohorts.map((cohort) =>
      new Date(cohort.cohortStart).getTime(),
    );
    const minDate = min(cohortDates) ?? Date.now();
    const maxDate = max(cohortDates) ?? Date.now();
    const colorScale = chroma
      .scale(chroma.brewer.Spectral)
      .domain([maxDate, minDate]);

    const legendStopCount = 9;
    const legendStops = Array.from({ length: legendStopCount }, (_, index) => {
      const t = index / (legendStopCount - 1);
      const value = minDate + (maxDate - minDate) * t;
      return colorScale(value).hex();
    });
    const legendGradient = `linear-gradient(90deg, ${legendStops.join(", ")})`;

    const cohortMap = new Map<string, MemberCompletionRetentionCohortDto>();
    const multiLineData: MultiLineSeries[] = filteredRetentionCohorts.map(
      (cohort) => {
        cohortMap.set(cohort.cohortStart, cohort);
        return {
          key: cohort.cohortStart,
          label: `Week of ${fullDateFormatter.format(
            new Date(cohort.cohortStart),
          )}`,
          color: colorScale(new Date(cohort.cohortStart).getTime()).hex(),
          data: cohort.points.map((point) => ({
            x: point.weekIndex,
            weekIndex: point.weekIndex,
            completionRate: point.completionRate,
            completedCount: point.completedCount,
            joinedCount: point.joinedCount,
            cohortStart: cohort.cohortStart,
            cohortSize: cohort.cohortSize,
          })),
        };
      },
    );

    return { multiLineData, legendGradient, cohortMap };
  }, [filteredRetentionCohorts]);

  return (
    <>
      <TimeSeriesChart
        title="Cohort Completion Reliability"
        xType="number"
        loading={retentionLoading}
        emptyMessage="No cohorts have completions yet."
        multiLineData={retentionChartData.multiLineData}
        getXValue={(d) => (d.weekIndex as number) ?? 0}
        getYValue={(d) => (d.completionRate as number) ?? 0}
        xAxisFormat={(v) => `${Math.round(v)}w`}
        xAxisLabel="Week"
        xRange={weekRange}
        onXRangeChange={setWeekRange}
        yDomain={[0, 1]}
        yAxisFormat={(v) => `${Math.round(v * 100)}%`}
        height={360}
        legendGradient={retentionChartData.legendGradient}
        legendLabels={{ left: "Older", right: "Newer" }}
        getHoverContent={(point) => ({
          title: `Week of ${fullDateFormatter.format(
            new Date(`${point.cohortStart}T00:00:00Z`),
          )}`,
          items: [
            { label: "Weeks since join", value: point.weekIndex as number },
            {
              label: "Completion rate",
              value: `${Math.round((point.completionRate as number) * 100)}%`,
            },
            {
              label: "Completed",
              value: point.completedCount as number,
              color: "#16a34a",
            },
            { label: "Joined", value: point.joinedCount as number },
            { label: "Cohort size", value: point.cohortSize as number },
          ],
        })}
      />

      <CohortCompletionGrid
        filteredRetentionCohorts={filteredRetentionCohorts}
        weekRange={weekRange}
        retentionLoading={retentionLoading}
      />
    </>
  );
};

export default CohortRetentionCharts;

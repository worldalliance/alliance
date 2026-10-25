import { MemberCompletionRetentionCohortDto } from "@alliance/shared/client/types.gen";
import chroma from "chroma-js";
import { max, range } from "d3";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { fullDateFormatter } from "../TimeSeriesChart";

type RetentionGridRow = {
  cohort: MemberCompletionRetentionCohortDto;
  pointsByWeek: Map<
    number,
    MemberCompletionRetentionCohortDto["points"][number]
  >;
};
type RetentionGridData = {
  weeks: number[];
  rows: RetentionGridRow[];
};
type HoveredRetentionCell = {
  x: number;
  y: number;
  week: number;
  actionIndex: number;
  actionStartDate: string;
  cohortStart: string;
  cohortSize: number;
  value: number;
  weekJoinedCount: number;
  weekCompletedCount: number;
  actions: Array<{
    actionId: number;
    actionName: string;
    memberCount: number;
  }>;
};

const CohortCompletionGrid: React.FC<{
  filteredRetentionCohorts: MemberCompletionRetentionCohortDto[];
  weekRange: { min: number; max: number };
  retentionLoading: boolean;
}> = ({ filteredRetentionCohorts, weekRange, retentionLoading }) => {
  const retentionGridRef = useRef<HTMLDivElement | null>(null);
  const [hoveredRetentionCell, setHoveredRetentionCell] =
    useState<HoveredRetentionCell | null>(null);

  const retentionHeatmapScale = useMemo(() => {
    return chroma.scale("RdYlGn").domain([0, 1]).mode("lab");
  }, []);

  const retentionGridData = useMemo<RetentionGridData>(() => {
    if (filteredRetentionCohorts.length === 0) {
      return { weeks: [], rows: [] };
    }

    const allWeekIndices = filteredRetentionCohorts.flatMap((cohort) =>
      cohort.points.map((point) => point.weekIndex),
    );
    const maxWeek = max(allWeekIndices) ?? 0;
    const rawMin = Math.max(0, Math.floor(weekRange.min));
    const rawMax = Math.max(rawMin, Math.ceil(weekRange.max));
    const rangeMin = Math.min(rawMin, maxWeek);
    const rangeMax = Math.min(rawMax, maxWeek);
    const weeks = rangeMin <= rangeMax ? range(rangeMin, rangeMax + 1) : [];

    const rows = [...filteredRetentionCohorts]
      .sort(
        (a, b) =>
          new Date(b.cohortStart).getTime() - new Date(a.cohortStart).getTime(),
      )
      .map((cohort) => ({
        cohort,
        pointsByWeek: new Map(
          cohort.points.map((point) => [point.weekIndex, point]),
        ),
      }));

    return { weeks, rows };
  }, [filteredRetentionCohorts, weekRange]);

  const handleRetentionCellHover = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
      row: RetentionGridRow,
      week: number,
      point: MemberCompletionRetentionCohortDto["points"][number] | undefined,
    ) => {
      if (!point || !Number.isFinite(point.weekCompletionRate)) {
        setHoveredRetentionCell(null);
        return;
      }
      if (!retentionGridRef.current) {
        return;
      }
      const containerRect = retentionGridRef.current.getBoundingClientRect();
      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top;
      setHoveredRetentionCell({
        x,
        y,
        week,
        actionIndex: point.actionIndex,
        actionStartDate: point.actionStartDate,
        cohortStart: row.cohort.cohortStart,
        cohortSize: row.cohort.cohortSize,
        value: point.weekCompletionRate,
        weekJoinedCount: point.weekJoinedCount,
        weekCompletedCount: point.weekCompletedCount,
        actions: point.actions ?? [],
      });
    },
    [],
  );

  const handleRetentionCellLeave = useCallback(() => {
    setHoveredRetentionCell(null);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Cohort Completion Grid
          </h3>
        </div>
      </div>
      <div className="p-4">
        {retentionLoading && retentionGridData.rows.length === 0 && (
          <p className="text-sm text-gray-600">Loading cohorts...</p>
        )}
        {!retentionLoading && retentionGridData.rows.length === 0 && (
          <p className="text-sm text-gray-600">
            No cohorts have completions yet.
          </p>
        )}
        {!retentionLoading &&
          retentionGridData.rows.length > 0 &&
          retentionGridData.weeks.length === 0 && (
            <p className="text-sm text-gray-600">
              No weeks in the selected range.
            </p>
          )}
        {!retentionLoading &&
          retentionGridData.rows.length > 0 &&
          retentionGridData.weeks.length > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-max relative" ref={retentionGridRef}>
                <div
                  className="grid items-center gap-0"
                  style={{
                    gridTemplateColumns: `200px repeat(${retentionGridData.weeks.length}, 40px)`,
                  }}
                >
                  <div
                    className="h-10 px-2 flex items-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
                    style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                  >
                    Cohort
                  </div>
                  {retentionGridData.weeks.map((week) => (
                    <div
                      key={`retention-grid-header-${week}`}
                      className="h-10 w-10 flex items-center justify-center text-[11px] text-gray-500"
                      style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                    >
                      W{week}
                    </div>
                  ))}
                  {retentionGridData.rows.map((row) => {
                    const cohortDate = new Date(
                      `${row.cohort.cohortStart}T00:00:00Z`,
                    );
                    return (
                      <React.Fragment
                        key={`retention-grid-row-${row.cohort.cohortStart}`}
                      >
                        <div
                          className="h-10 px-2 flex flex-col justify-center gap-0.5"
                          style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                        >
                          <div className="text-[11px] font-semibold text-gray-700 leading-tight">
                            Week of {fullDateFormatter.format(cohortDate)}
                          </div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {row.cohort.cohortSize} members
                          </div>
                        </div>
                        {retentionGridData.weeks.map((week) => {
                          const point = row.pointsByWeek.get(week);
                          const value = point?.weekCompletionRate;
                          const hasValue =
                            typeof value === "number" && Number.isFinite(value);
                          const displayValue = hasValue
                            ? `${Math.round(value * 100)}%`
                            : "";
                          const fill = hasValue
                            ? retentionHeatmapScale(value).hex()
                            : "#f8fafc";
                          const textColor =
                            hasValue &&
                            retentionHeatmapScale(value).luminance() < 0.45
                              ? "#f8fafc"
                              : "#0f172a";

                          return (
                            <div
                              key={`retention-grid-${row.cohort.cohortStart}-${week}`}
                              className="h-10 w-10 flex items-center justify-center text-[11px] font-semibold"
                              style={{
                                backgroundColor: fill,
                                color: textColor,
                                boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                              }}
                              onMouseEnter={(event) =>
                                handleRetentionCellHover(
                                  event,
                                  row,
                                  week,
                                  point,
                                )
                              }
                              onMouseMove={(event) =>
                                handleRetentionCellHover(
                                  event,
                                  row,
                                  week,
                                  point,
                                )
                              }
                              onMouseLeave={handleRetentionCellLeave}
                            >
                              {displayValue}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
                {hoveredRetentionCell && (
                  <div
                    className="absolute z-20 w-64 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg"
                    style={{
                      left: hoveredRetentionCell.x,
                      top: hoveredRetentionCell.y,
                      transform: "translate(-50%, -115%)",
                      pointerEvents: "none",
                    }}
                  >
                    <div className="flex items-center gap-2 justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-900">
                        Week {hoveredRetentionCell.week}
                      </div>
                      <p>
                        {fullDateFormatter.format(
                          new Date(
                            `${hoveredRetentionCell.actionStartDate}T00:00:00Z`,
                          ),
                        )}
                      </p>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Cohort: Week of{" "}
                      {fullDateFormatter.format(
                        new Date(
                          `${hoveredRetentionCell.cohortStart}T00:00:00Z`,
                        ),
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Completed</span>
                      <span>{hoveredRetentionCell.weekCompletedCount}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Joined</span>
                      <span>{hoveredRetentionCell.weekJoinedCount}</span>
                    </div>
                    {hoveredRetentionCell.actions.length > 0 && (
                      <>
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                          Actions
                        </div>
                        <div className="mt-1 space-y-1">
                          {hoveredRetentionCell.actions.map((action) => (
                            <div
                              key={`retention-action-${hoveredRetentionCell.cohortStart}-${hoveredRetentionCell.week}-${action.actionId}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="truncate">
                                {action.actionName}
                              </span>
                              <span className="text-gray-500">
                                {action.memberCount}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default CohortCompletionGrid;

import chroma from "chroma-js";
import { max, min } from "d3";
import { useMemo, useState } from "react";
import { NumericAxisChart } from "../../ui/charts/NumericAxisChart";
import type { MultiLineSeries } from "../../ui/charts/types";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useMemberCompletionRetentionAdmin } from "../../lib/useMemberCompletionRetentionAdmin";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import {
  chartColor,
  NumberField,
  PanelControls,
  PanelStack,
} from "./chartParts";
import { CohortCompletionGrid, cohortDate } from "./CohortCompletionGrid";

const HEIGHT = 360;
const LEGEND_STOPS = 9;
const number = (value: unknown) => (typeof value === "number" ? value : 0);

/**
 * Weekly signup cohorts with at least one completion: a line each, older to
 * newer, and the grid of their weeks. One week range drives both.
 */
export function CohortCompletionPanel({ className }: { className?: string }) {
  const retention = useMemberCompletionRetentionAdmin();
  const [weekRange, setWeekRange] = useState({ min: "0", max: "20" });
  const numericRange = useMemo(
    () => ({ min: Number(weekRange.min), max: Number(weekRange.max) }),
    [weekRange],
  );

  const cohorts = useMemo(
    () =>
      (retention.data ?? [])
        .map((cohort) => ({
          ...cohort,
          points: [...cohort.points].sort((a, b) => a.weekIndex - b.weekIndex),
        }))
        .filter((cohort) => cohort.points.some((p) => p.completedCount > 0))
        .sort(
          (a, b) =>
            new Date(a.cohortStart).getTime() -
            new Date(b.cohortStart).getTime(),
        ),
    [retention.data],
  );

  const lines = useMemo(() => {
    const starts = cohorts.map((c) => new Date(c.cohortStart).getTime());
    const oldest = min(starts) ?? 0;
    const newest = max(starts) ?? 0;
    // Lines are told apart by position on a ramp, which the legend names.
    const ramp = chroma.scale(chroma.brewer.Spectral).domain([newest, oldest]);
    const stops = Array.from({ length: LEGEND_STOPS }, (_, index) =>
      ramp(oldest + ((newest - oldest) * index) / (LEGEND_STOPS - 1)).hex(),
    );
    const series: MultiLineSeries[] = cohorts.map((cohort) => ({
      key: cohort.cohortStart,
      label: `Week of ${cohortDate(cohort.cohortStart)}`,
      color: ramp(new Date(cohort.cohortStart).getTime()).hex(),
      data: cohort.points.map((point) => ({
        x: point.weekIndex,
        weekIndex: point.weekIndex,
        completionRate: point.completionRate,
        completedCount: point.completedCount,
        joinedCount: point.joinedCount,
        cohortStart: cohort.cohortStart,
        cohortSize: cohort.cohortSize,
      })),
    }));
    return { series, gradient: `linear-gradient(90deg, ${stops.join(", ")})` };
  }, [cohorts]);

  return (
    <Panel title="Cohort completion reliability" className={className}>
      <PanelStack>
        <PanelControls>
          <NumberField
            label="From week"
            min={0}
            value={weekRange.min}
            onChange={(value) =>
              setWeekRange((prev) => ({ ...prev, min: value }))
            }
          />
          <NumberField
            label="To week"
            min={0}
            value={weekRange.max}
            onChange={(value) =>
              setWeekRange((prev) => ({ ...prev, max: value }))
            }
          />
        </PanelControls>
        <ContentState
          loading={retention.isPending}
          skeleton={<Skeleton className="h-80 w-full" />}
          error={
            retention.isLoadingError
              ? adminRefusalMessage(retention.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load cohort completion"
          onRetry={() => void retention.refetch()}
          empty={cohorts.length === 0}
          emptyTitle="No cohorts have completions yet"
        >
          <div className="relative">
            <NumericAxisChart
              title="Cohort completion reliability"
              height={HEIGHT}
              multiLineData={lines.series}
              getXValue={(d) => number(d.weekIndex)}
              getYValue={(d) => number(d.completionRate)}
              xAxisFormat={(v) => `${Math.round(v)}w`}
              xRange={numericRange}
              yDomain={[0, 1]}
              yAxisFormat={(v) => `${Math.round(v * 100)}%`}
              getHoverContent={(point) => ({
                title: `Week of ${cohortDate(String(point.cohortStart))}`,
                items: [
                  { label: "Weeks since join", value: number(point.weekIndex) },
                  {
                    label: "Completion rate",
                    value: `${Math.round(number(point.completionRate) * 100)}%`,
                  },
                  {
                    label: "Completed",
                    value: number(point.completedCount),
                    color: chartColor.completed,
                  },
                  { label: "Joined", value: number(point.joinedCount) },
                  { label: "Cohort size", value: number(point.cohortSize) },
                ],
              })}
            />
          </div>
          <div className="flex items-center gap-2 text-caption text-fg-muted">
            Older cohorts
            <span
              aria-hidden="true"
              className="h-2 w-40 rounded-full border border-line"
              style={{ background: lines.gradient }}
            />
            Newer cohorts
          </div>
          <section
            aria-label="Cohort completion grid"
            className="flex flex-col gap-2"
          >
            <h4 className="font-semibold">Cohort completion grid</h4>
            <CohortCompletionGrid cohorts={cohorts} weekRange={numericRange} />
          </section>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}

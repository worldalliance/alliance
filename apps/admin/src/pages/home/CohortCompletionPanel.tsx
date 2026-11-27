import { max, min } from "d3";
import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useMemberCompletionRetentionAdmin } from "../../lib/useMemberCompletionRetentionAdmin";
import { sequenceColor } from "../../ui/charts/chartColor";
import { SequenceLegend } from "../../ui/charts/ChartLegend";
import { NumericAxisChart } from "../../ui/charts/NumericAxisChart";
import type { MultiLineSeries } from "../../ui/charts/types";
import { Skeleton } from "../../ui/Skeleton";
import {
  NumberField,
  Panel,
  PanelControls,
  PanelStack,
} from "../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { CohortCompletionGrid, cohortDate } from "./CohortCompletionGrid";

const HEIGHT = 360;
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

  const series = useMemo<MultiLineSeries[]>(() => {
    const starts = cohorts.map((c) => new Date(c.cohortStart).getTime());
    const oldest = min(starts) ?? 0;
    const span = Math.max(1, (max(starts) ?? 0) - oldest);
    return cohorts.map((cohort) => ({
      key: cohort.cohortStart,
      label: `Week of ${cohortDate(cohort.cohortStart)}`,
      // Older cohorts are lighter, newer darker; the legend names the two ends.
      color: sequenceColor(
        (new Date(cohort.cohortStart).getTime() - oldest) / span,
      ),
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
        <RefreshFailedBanner
          inline
          things="cohort completion"
          query={retention}
        />
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
          retrying={retention.isFetching}
          empty={cohorts.length === 0}
          emptyTitle="No cohorts have completions yet"
        >
          <NumericAxisChart
            title="Cohort completion reliability"
            height={HEIGHT}
            multiLineData={series}
            getXValue={(d) => number(d.weekIndex)}
            getYValue={(d) => number(d.completionRate)}
            xAxisFormat={(v) => `${Math.round(v)}w`}
            xRange={numericRange}
            yDomain={[0, 1]}
            yAxisFormat={(v) => `${Math.round(v * 100)}%`}
            getHoverContent={(point) => ({
              title: `Week of ${cohortDate(String(point.cohortStart))}`,
              items: [
                {
                  label: "Weeks since joining",
                  value: number(point.weekIndex),
                },
                {
                  label: "Completion rate",
                  value: `${Math.round(number(point.completionRate) * 100)}%`,
                },
                {
                  label: "Completed",
                  value: formatCount(number(point.completedCount)),
                },
                {
                  label: "Joined",
                  value: formatCount(number(point.joinedCount)),
                },
                {
                  label: "Cohort size",
                  value: formatCount(number(point.cohortSize)),
                },
              ],
            })}
          />
          <SequenceLegend from="Older cohorts" to="Newer cohorts" />
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

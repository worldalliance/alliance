import { withCount } from "@alliance/common/plural";
import { bin, max, range, scaleLinear } from "d3";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useTimeToChurnSamplesAdmin } from "../../lib/useTimeToChurnSamplesAdmin";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { axisTextClass, chartColor } from "./chartParts";

const WIDTH = 1000;
const HEIGHT = 320;
const MARGIN = { top: 28, right: 24, bottom: 56, left: 64 };
const DAYS_PER_WEEK = 7;

function geometryOf(weeks: number[]) {
  const xScale = scaleLinear()
    .domain([0, Math.max(1, max(weeks) ?? 0)])
    .nice()
    .range([MARGIN.left, WIDTH - MARGIN.right]);
  const [, lastWeek] = xScale.domain();
  const bins = bin<number, number>()
    .domain([0, lastWeek])
    .thresholds(range(0, Math.ceil(lastWeek) + 1, 1))(weeks);
  while (bins.length > 1 && bins[bins.length - 1].length === 0) bins.pop();
  const yScale = scaleLinear()
    .domain([0, Math.max(1, max(bins, (b) => b.length) ?? 0)])
    .nice()
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  return { xScale, yScale, bins };
}

function Histogram({ weeks }: { weeks: number[] }) {
  const { xScale, yScale, bins } = useMemo(() => geometryOf(weeks), [weeks]);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Churned members by weeks since signing"
    >
      {yScale.ticks(5).map((tick) => (
        <g key={tick}>
          <line
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke={chartColor.grid}
            strokeDasharray="4 6"
          />
          <text
            x={MARGIN.left - 10}
            y={yScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className={axisTextClass}
          >
            {tick}
          </text>
        </g>
      ))}
      {bins.map((weekBin, index) => {
        const from = weekBin.x0 ?? 0;
        const to = weekBin.x1 ?? from;
        return (
          <g key={index}>
            <rect
              x={xScale(from) + 1}
              y={yScale(weekBin.length)}
              width={Math.max(0, xScale(to) - xScale(from) - 2)}
              height={yScale(0) - yScale(weekBin.length)}
              fill={chartColor.churned}
              rx={3}
            >
              <title>{`${Math.round(from)}-${Math.round(to)}w: ${weekBin.length} members`}</title>
            </rect>
            <text
              x={xScale((from + to) / 2)}
              y={HEIGHT - MARGIN.bottom + 24}
              textAnchor="middle"
              className={axisTextClass}
            >
              {Math.round(from)}
            </text>
          </g>
        );
      })}
      <text
        x={(WIDTH - MARGIN.left - MARGIN.right) / 2 + MARGIN.left}
        y={HEIGHT - 12}
        textAnchor="middle"
        className={axisTextClass}
      >
        Weeks since signing
      </text>
    </svg>
  );
}

/** Churned members by whole weeks from signing to their last completed task. */
export function TimeToChurnPanel({ className }: { className?: string }) {
  const samples = useTimeToChurnSamplesAdmin();
  // A failed refetch hides the histogram: its numbers may no longer hold.
  const data = samples.error ? undefined : samples.data;
  const weeks = useMemo(
    () =>
      (data ?? [])
        .map((sample) => sample.daysToChurn / DAYS_PER_WEEK)
        .filter((value) => Number.isFinite(value) && value >= 0),
    [data],
  );

  return (
    <Panel
      title="Time to churn"
      description={
        data && data.length > 0
          ? `${withCount(data.length, "churned member")}, from signing to last completed task`
          : "From signing to last completed task"
      }
      className={className}
    >
      <ContentState
        loading={samples.isPending}
        skeleton={<Skeleton className="h-72 w-full" />}
        error={
          samples.error
            ? adminRefusalMessage(samples.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load time to churn"
        onRetry={() => void samples.refetch()}
        empty={weeks.length === 0}
        emptyTitle="No churned members yet"
      >
        <Histogram weeks={weeks} />
      </ContentState>
    </Panel>
  );
}

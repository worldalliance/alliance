import { bin, max, range, scaleLinear } from "d3";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useTimeToChurnSamplesAdmin } from "../../lib/useTimeToChurnSamplesAdmin";
import { YGrid } from "../../ui/charts/axes";
import { axisTextClass, chartColor, SERIES } from "../../ui/charts/chartColor";
import { ChartFrame, useChartCursor } from "../../ui/charts/ChartFrame";
import { ChartTip, TipRow } from "../../ui/charts/ChartTip";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { countLabel } from "./homeRules";

const HEIGHT = 320;
const MARGIN = { top: 28, right: 24, bottom: 56, left: 56 };
const DAYS_PER_WEEK = 7;
const MIN_LABEL_GAP = 28;

function geometryOf(weeks: number[], width: number) {
  const xScale = scaleLinear()
    .domain([0, Math.max(1, max(weeks) ?? 0)])
    .nice()
    .range([MARGIN.left, width - MARGIN.right]);
  const [, lastWeek] = xScale.domain();
  const bins = bin<number, number>()
    .domain([0, lastWeek])
    .thresholds(range(0, Math.ceil(lastWeek) + 1, 1))(weeks);
  while (bins.length > 1 && bins[bins.length - 1].length === 0) bins.pop();
  const yScale = scaleLinear()
    .domain([0, Math.max(1, max(bins, (b) => b.length) ?? 0)])
    .nice()
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  const slot = xScale(1) - xScale(0);
  return {
    xScale,
    yScale,
    bins,
    labelEvery: Math.max(1, Math.ceil(MIN_LABEL_GAP / slot)),
  };
}

const weeksOf = (weekBin: { x0?: number; x1?: number }) => {
  const from = Math.round(weekBin.x0 ?? 0);
  return { from, to: Math.round(weekBin.x1 ?? from) };
};

function Histogram({ weeks }: { weeks: number[] }) {
  const binCount = useMemo(() => geometryOf(weeks, 1000).bins.length, [weeks]);
  const cursor = useChartCursor(binCount);

  return (
    <ChartFrame
      tip={(width) => {
        if (cursor.index === null) return null;
        const { xScale, yScale, bins } = geometryOf(weeks, width);
        const weekBin = bins[cursor.index];
        const { from, to } = weeksOf(weekBin);
        return (
          <ChartTip
            title={`${from} to ${to} weeks`}
            x={xScale((from + to) / 2)}
            y={yScale(weekBin.length)}
          >
            <TipRow label="Churned members">
              {formatCount(weekBin.length)}
            </TipRow>
          </ChartTip>
        );
      }}
    >
      {(width) => {
        const { xScale, yScale, bins, labelEvery } = geometryOf(weeks, width);
        return (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label="Churned members by weeks since signing. Arrow keys read each week."
            {...cursor.markProps}
            onMouseLeave={() => cursor.setIndex(null)}
          >
            <YGrid
              ticks={yScale.ticks(5).filter(Number.isInteger)}
              yScale={yScale}
              yAxisFormat={formatCount}
              width={width}
              margin={MARGIN}
            />
            {bins.map((weekBin, index) => {
              const { from, to } = weeksOf(weekBin);
              return (
                <g key={index} onMouseEnter={() => cursor.setIndex(index)}>
                  <rect
                    x={xScale(from)}
                    y={MARGIN.top}
                    width={Math.max(0, xScale(to) - xScale(from))}
                    height={HEIGHT - MARGIN.top - MARGIN.bottom}
                    fill="transparent"
                  />
                  <rect
                    x={xScale(from) + 1}
                    y={yScale(weekBin.length)}
                    width={Math.max(0, xScale(to) - xScale(from) - 2)}
                    height={yScale(0) - yScale(weekBin.length)}
                    fill={SERIES[0]}
                    stroke={cursor.index === index ? chartColor.cursor : "none"}
                    strokeWidth={2}
                    rx={3}
                  >
                    <title>{`${from} to ${to} weeks: ${countLabel(weekBin.length, "churned member")}`}</title>
                  </rect>
                  {index % labelEvery === 0 && (
                    <text
                      x={xScale((from + to) / 2)}
                      y={HEIGHT - MARGIN.bottom + 20}
                      textAnchor="middle"
                      className={axisTextClass}
                    >
                      {from}
                    </text>
                  )}
                </g>
              );
            })}
            <text
              x={(width - MARGIN.left - MARGIN.right) / 2 + MARGIN.left}
              y={HEIGHT - 12}
              textAnchor="middle"
              className={axisTextClass}
            >
              Weeks from signing to last completed task
            </text>
          </svg>
        );
      }}
    </ChartFrame>
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
          ? countLabel(data.length, "churned member")
          : undefined
      }
      className={className}
    >
      <ContentState
        loading={samples.isPending}
        skeleton={<Skeleton className="h-80 w-full" />}
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

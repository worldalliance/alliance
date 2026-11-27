import { area, curveMonotoneX, extent, max, scaleLinear, scaleTime } from "d3";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import {
  Cursor,
  CHART_MARGIN as MARGIN,
  xTickCount,
  XTicks,
  YGrid,
} from "../../ui/charts/axes";
import { SERIES } from "../../ui/charts/chartColor";
import { ChartFrame, useChartCursor } from "../../ui/charts/ChartFrame";
import { ChartLegend, LegendItem } from "../../ui/charts/ChartLegend";
import { ChartTip, TipRow, TipSide } from "../../ui/charts/ChartTip";
import { Skeleton } from "../../ui/Skeleton";
import {
  type DateRange,
  DateRangeFields,
  Panel,
  PanelControls,
  PanelStack,
} from "../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import type { ParsedContractStatusPoint } from "./contractStatusHistory";

const HEIGHT = 350;
const [ACTIVE, CHURNED] = SERIES;

const churnShare = (point: ParsedContractStatusPoint) =>
  point.totalEverSigned > 0
    ? Math.round((point.churnedCount / point.totalEverSigned) * 100)
    : 0;

function geometryOf(history: ParsedContractStatusPoint[], width: number) {
  const [first, last] = extent(history, (d) => d.parsedDate);
  if (!first || !last) return null;
  const xScale = scaleTime()
    .domain([first, last])
    .range([MARGIN.left, width - MARGIN.right]);
  const yScale = scaleLinear()
    .domain([0, (max(history, (d) => d.totalEverSigned) ?? 10) * 1.1])
    .nice()
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  const x = (d: ParsedContractStatusPoint) => xScale(d.parsedDate);
  return {
    xScale,
    yScale,
    x,
    activePath:
      area<ParsedContractStatusPoint>()
        .x(x)
        .y0(HEIGHT - MARGIN.bottom)
        .y1((d) => yScale(d.activeCount))
        .curve(curveMonotoneX)(history) ?? "",
    churnedPath:
      area<ParsedContractStatusPoint>()
        .x(x)
        .y0((d) => yScale(d.activeCount))
        .y1((d) => yScale(d.activeCount + d.churnedCount))
        .curve(curveMonotoneX)(history) ?? "",
  };
}

function Chart({
  history,
  updating,
}: {
  history: ParsedContractStatusPoint[];
  updating: boolean;
}) {
  const cursor = useChartCursor(history.length);
  const hovered = cursor.index === null ? undefined : history[cursor.index];

  return (
    <ChartFrame
      updating={updating}
      tip={(width) => {
        const geometry = geometryOf(history, width);
        if (!hovered || !geometry) return null;
        return (
          <ChartTip
            title={formatDate(hovered.parsedDate)}
            side={TipSide.Beside}
            x={geometry.x(hovered)}
            y={MARGIN.top}
          >
            <TipRow label="Active members" swatch={ACTIVE}>
              {formatCount(hovered.activeCount)}
            </TipRow>
            <TipRow label="Churned members" swatch={CHURNED}>
              {formatCount(hovered.churnedCount)}
            </TipRow>
            <TipRow label="Churn">{churnShare(hovered)}%</TipRow>
          </ChartTip>
        );
      }}
    >
      {(width) => (
        <Areas
          history={history}
          width={width}
          cursor={cursor}
          hovered={hovered}
        />
      )}
    </ChartFrame>
  );
}

function Areas({
  history,
  width,
  cursor,
  hovered,
}: {
  history: ParsedContractStatusPoint[];
  width: number;
  cursor: ReturnType<typeof useChartCursor>;
  hovered: ParsedContractStatusPoint | undefined;
}) {
  const geometry = useMemo(() => geometryOf(history, width), [history, width]);
  if (!geometry) return null;

  const hoverNearest = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const at = geometry.xScale
      .invert((event.clientX - rect.left) * (width / rect.width))
      .getTime();
    let nearest = 0;
    history.forEach((point, index) => {
      if (
        Math.abs(at - point.parsedDate.getTime()) <
        Math.abs(at - history[nearest].parsedDate.getTime())
      ) {
        nearest = index;
      }
    });
    cursor.setIndex(nearest);
  };

  return (
    <svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label="Active and churned members over time. Arrow keys read each date."
      {...cursor.markProps}
      onMouseMove={hoverNearest}
      onMouseLeave={() => cursor.setIndex(null)}
    >
      <YGrid
        ticks={geometry.yScale.ticks(6)}
        yScale={geometry.yScale}
        yAxisFormat={formatCount}
        width={width}
      />
      <XTicks
        ticks={geometry.xScale.ticks(xTickCount(width))}
        x={geometry.xScale}
        label={(tick) => formatDate(tick)}
        height={HEIGHT}
      />
      <path d={geometry.churnedPath} fill={CHURNED} />
      <path d={geometry.activePath} fill={ACTIVE} />
      {hovered && <Cursor x={geometry.x(hovered)} height={HEIGHT} />}
    </svg>
  );
}

/** Active members under churned ones, stacked, across the chosen dates. */
export function MembersOverTimePanel({
  history,
  loading,
  updating,
  query,
  range,
  onRangeChange,
  className,
}: {
  history: ParsedContractStatusPoint[];
  /** Nothing to show yet: the first load, or a range change from an empty range. */
  loading: boolean;
  /** A range change is loading over the chart on screen. */
  updating: boolean;
  /** The history's query, for its failures and its retry. */
  query: {
    isLoadingError: boolean;
    isRefetchError: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  className?: string;
}) {
  return (
    <Panel title="Members over time" className={className}>
      <PanelStack>
        <PanelControls>
          <DateRangeFields range={range} onChange={onRangeChange} />
        </PanelControls>
        <RefreshFailedBanner inline things="members over time" query={query} />
        <ContentState
          loading={loading}
          skeleton={<Skeleton className="h-95.5 w-full" />}
          error={
            query.isLoadingError
              ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load members over time"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          empty={history.length === 0}
          emptyTitle="No contract status data in this date range"
        >
          <Chart history={history} updating={updating} />
          <ChartLegend>
            <LegendItem swatch={ACTIVE}>Active members</LegendItem>
            <LegendItem swatch={CHURNED}>Churned members</LegendItem>
          </ChartLegend>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}

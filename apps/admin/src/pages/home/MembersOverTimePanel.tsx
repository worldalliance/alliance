import { area, curveMonotoneX, extent, max, scaleLinear, scaleTime } from "d3";
import { useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { Skeleton } from "../../ui/Skeleton";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import {
  axisTextClass,
  chartColor,
  ChartLegend,
  DateRangeFields,
  LegendItem,
  PanelControls,
  PanelStack,
} from "./chartParts";
import type { ParsedContractStatusPoint } from "./contractStatusHistory";
import type { DateRange } from "./homeRules";

const WIDTH = 1000;
const HEIGHT = 350;
const MARGIN = { top: 28, right: 32, bottom: 40, left: 72 };
const TIP = { width: 132, height: 48 };

function geometryOf(history: ParsedContractStatusPoint[]) {
  const [first, last] = extent(history, (d) => d.parsedDate);
  if (!first || !last) return null;
  const xScale = scaleTime()
    .domain([first, last])
    .range([MARGIN.left, WIDTH - MARGIN.right]);
  const yScale = scaleLinear()
    .domain([0, (max(history, (d) => d.totalEverSigned) ?? 10) * 1.1])
    .nice()
    .range([HEIGHT - MARGIN.bottom, MARGIN.top]);
  const active = area<ParsedContractStatusPoint>()
    .x((d) => xScale(d.parsedDate))
    .y0(HEIGHT - MARGIN.bottom)
    .y1((d) => yScale(d.activeCount))
    .curve(curveMonotoneX);
  const churned = area<ParsedContractStatusPoint>()
    .x((d) => xScale(d.parsedDate))
    .y0((d) => yScale(d.activeCount))
    .y1((d) => yScale(d.activeCount + d.churnedCount))
    .curve(curveMonotoneX);
  return {
    xScale,
    yScale,
    activePath: active(history) ?? "",
    churnedPath: churned(history) ?? "",
  };
}

function Chart({ history }: { history: ParsedContractStatusPoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<ParsedContractStatusPoint | null>(
    null,
  );
  const geometry = useMemo(() => geometryOf(history), [history]);
  if (!geometry) return null;
  const { xScale, yScale } = geometry;

  const hoverNearest = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    if (relativeX < 0) return;
    const at = xScale.invert(relativeX * (WIDTH / rect.width)).getTime();
    const distance = (point: ParsedContractStatusPoint) =>
      Math.abs(at - point.parsedDate.getTime());
    setHovered(
      history.reduce((nearest, point) =>
        distance(point) < distance(nearest) ? point : nearest,
      ),
    );
  };

  const hoveredX = hovered ? xScale(hovered.parsedDate) : 0;
  const tipX = Math.min(hoveredX + 12, WIDTH - TIP.width - 12);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Active and churned members over time"
      onMouseMove={hoverNearest}
      onMouseLeave={() => setHovered(null)}
    >
      {yScale.ticks(6).map((tick) => (
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
            x={MARGIN.left - 12}
            y={yScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className={axisTextClass}
          >
            {formatCount(tick)}
          </text>
        </g>
      ))}
      {xScale.ticks(8).map((tick) => (
        <text
          key={tick.toISOString()}
          x={xScale(tick)}
          y={HEIGHT - MARGIN.bottom + 24}
          textAnchor="middle"
          className={axisTextClass}
        >
          {formatDate(tick)}
        </text>
      ))}
      <path d={geometry.churnedPath} fill={chartColor.churned} />
      <path d={geometry.activePath} fill={chartColor.completed} />
      {hovered && (
        <>
          <line
            x1={hoveredX}
            x2={hoveredX}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
            stroke={chartColor.cursor}
            strokeDasharray="4 4"
          />
          <rect
            x={tipX}
            y={MARGIN.top + 12}
            width={TIP.width}
            height={TIP.height}
            rx={6}
            className="fill-surface stroke-line-strong"
          />
          <text
            x={tipX + 12}
            y={MARGIN.top + 31}
            className="fill-fg text-sm font-semibold"
          >
            {hovered.totalEverSigned > 0
              ? Math.round(
                  (hovered.churnedCount / hovered.totalEverSigned) * 100,
                )
              : 0}
            % churn
          </text>
          <text x={tipX + 12} y={MARGIN.top + 50} className={axisTextClass}>
            {formatCount(hovered.activeCount)} members
          </text>
        </>
      )}
    </svg>
  );
}

/** Active members under churned ones, stacked, across the chosen dates. */
export function MembersOverTimePanel({
  history,
  loading,
  error,
  onRetry,
  range,
  onRangeChange,
  className,
}: {
  history: ParsedContractStatusPoint[];
  /** A first load, or a range change still loading. */
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
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
        <ContentState
          loading={loading}
          skeleton={<Skeleton className="h-80 w-full" />}
          error={
            error ? adminRefusalMessage(error, LOAD_FAILED_FALLBACK) : null
          }
          errorTitle="Couldn't load members over time"
          onRetry={onRetry}
          empty={history.length === 0}
          emptyTitle="No contract status data in this date range"
        >
          <Chart history={history} />
          <ChartLegend>
            <LegendItem swatch={chartColor.completed}>
              Active members
            </LegendItem>
            <LegendItem swatch={chartColor.churned}>Churned members</LegendItem>
          </ChartLegend>
        </ContentState>
      </PanelStack>
    </Panel>
  );
}

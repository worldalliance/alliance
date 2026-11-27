import type { ScaleLinear } from "d3";
import { axisTextClass, chartColor } from "./chartColor";

export const CHART_MARGIN = { top: 28, right: 32, bottom: 40, left: 72 };

const MIN_TICK_GAP = 88;

/** About as many x ticks as fit `width` with room for their labels. */
export const xTickCount = (width: number, margin = CHART_MARGIN) =>
  Math.max(2, Math.floor((width - margin.left - margin.right) / MIN_TICK_GAP));

/** Half the widest series stroke, so a line along the x axis isn't clipped to half its width. */
const BASELINE_STROKE_ROOM = 2;

/** The plot area, for a `clipPath` that keeps lines from running past the axes. */
export function PlotClip({
  id,
  width,
  height,
  margin = CHART_MARGIN,
}: {
  id: string;
  width: number;
  height: number;
  margin?: typeof CHART_MARGIN;
}) {
  return (
    <clipPath id={id}>
      <rect
        x={margin.left}
        y={0}
        width={Math.max(0, width - margin.left - margin.right)}
        height={height - margin.bottom + BASELINE_STROKE_ROOM}
      />
    </clipPath>
  );
}

export function dedupeTickLabels(
  ticks: number[],
  format?: (value: number) => string,
): number[] {
  const seen = new Set<string>();
  return ticks.filter((tick) => {
    const label = format ? format(tick) : String(tick);
    if (!label) return true;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

/** Dashed rules across the chart at each y tick, labelled on the left. */
export function YGrid({
  ticks,
  yScale,
  yAxisFormat,
  width,
  margin = CHART_MARGIN,
}: {
  ticks: number[];
  yScale: ScaleLinear<number, number>;
  yAxisFormat?: (value: number) => string;
  width: number;
  margin?: typeof CHART_MARGIN;
}) {
  return ticks.map((tick) => (
    <g key={`y-${tick}`}>
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={yScale(tick)}
        y2={yScale(tick)}
        stroke={chartColor.grid}
        strokeDasharray="4 6"
      />
      <text
        x={margin.left - 12}
        y={yScale(tick)}
        textAnchor="end"
        dominantBaseline="middle"
        className={axisTextClass}
      >
        {yAxisFormat ? yAxisFormat(tick) : tick}
      </text>
    </g>
  ));
}

/** A label under the chart at each x tick. */
export function XTicks<T>({
  ticks,
  x,
  label,
  height,
  margin = CHART_MARGIN,
}: {
  ticks: T[];
  x: (tick: T) => number;
  label: (tick: T) => string;
  height: number;
  margin?: typeof CHART_MARGIN;
}) {
  return ticks.map((tick, index) => (
    <text
      key={index}
      x={x(tick)}
      y={height - margin.bottom + 24}
      textAnchor="middle"
      className={axisTextClass}
    >
      {label(tick)}
    </text>
  ));
}

/** The dashed line down the chart at the active point. */
export function Cursor({
  x,
  height,
  margin = CHART_MARGIN,
}: {
  x: number;
  height: number;
  margin?: typeof CHART_MARGIN;
}) {
  return (
    <line
      x1={x}
      x2={x}
      y1={margin.top}
      y2={height - margin.bottom}
      stroke={chartColor.cursor}
      strokeDasharray="4 4"
    />
  );
}

/** The ring on a line at the active point. */
export function PointMark({
  cx,
  cy,
  color,
  r = 4,
}: {
  cx: number;
  cy: number;
  color: string;
  r?: number;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={chartColor.surface}
      stroke={color}
      strokeWidth={2}
    />
  );
}

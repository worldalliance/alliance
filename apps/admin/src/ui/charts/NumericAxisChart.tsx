import { curveMonotoneX, extent, line, max, scaleLinear } from "d3";
import { type KeyboardEvent, type MouseEvent, useMemo, useState } from "react";
import { axisTextClass } from "./chartColor";
import {
  CHART_MARGIN as MARGIN,
  Cursor,
  dedupeTickLabels,
  PointMark,
  XTicks,
  YGrid,
} from "./axes";
import { ChartFrame } from "./ChartFrame";
import { ChartTip, TipRow } from "./ChartTip";
import type { MultiLineSeries, NumericAxisProps } from "./types";

type Active = { series: number; point: number };

function geometryOf(props: NumericAxisProps, width: number, height: number) {
  const { multiLineData, getXValue, getYValue, xRange, yDomain } = props;
  const all = multiLineData.flatMap((s) => s.data);
  if (all.length === 0) return null;
  const [low, high] = xRange
    ? [xRange.min, xRange.max]
    : extent(all, getXValue);
  if (low === undefined || high === undefined) return null;
  const xScale = scaleLinear()
    .domain([low, high])
    .range([MARGIN.left, width - MARGIN.right]);
  const yScale = scaleLinear()
    .domain([
      yDomain ? yDomain[0] : 0,
      yDomain ? yDomain[1] : Math.max((max(all, getYValue) ?? 0) * 1.1, 1),
    ])
    .nice()
    .range([height - MARGIN.bottom, MARGIN.top]);
  const path = line<MultiLineSeries["data"][number]>()
    .x((d) => xScale(getXValue(d)))
    .y((d) => yScale(getYValue(d)))
    .curve(curveMonotoneX);
  const rawYTicks = yScale.ticks(6);
  return {
    xScale,
    yScale,
    lines: multiLineData.map((s) => path(s.data) ?? ""),
    xTicks: xScale.ticks(Math.min(8, high - low + 1)),
    yTicks: props.yTickLabelDedup
      ? dedupeTickLabels(rawYTicks, props.yAxisFormat)
      : rawYTicks,
  };
}

/**
 * Left and right step along the active line, up and down move to the line
 * above or below at the nearest x.
 */
function step(
  key: string,
  active: Active | null,
  props: NumericAxisProps,
): Active | null | undefined {
  const lines = props.multiLineData;
  const first = lines.findIndex((s) => s.data.length > 0);
  if (first === -1) return undefined;
  if (!active) {
    return ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)
      ? { series: first, point: 0 }
      : undefined;
  }
  const points = lines[active.series].data;
  switch (key) {
    case "ArrowRight":
      return { ...active, point: Math.min(points.length - 1, active.point + 1) };
    case "ArrowLeft":
      return { ...active, point: Math.max(0, active.point - 1) };
    case "Home":
      return { ...active, point: 0 };
    case "End":
      return { ...active, point: points.length - 1 };
    case "ArrowUp":
    case "ArrowDown": {
      const direction = key === "ArrowDown" ? 1 : -1;
      const x = props.getXValue(points[active.point]);
      for (
        let series = active.series + direction;
        series >= 0 && series < lines.length;
        series += direction
      ) {
        const data = lines[series].data;
        if (data.length === 0) continue;
        let nearest = 0;
        data.forEach((d, index) => {
          const gap = Math.abs(props.getXValue(d) - x);
          if (gap < Math.abs(props.getXValue(data[nearest]) - x)) {
            nearest = index;
          }
        });
        return { series, point: nearest };
      }
      return active;
    }
    case "Escape":
      return null;
    default:
      return undefined;
  }
}

/** Lines over a numeric x, such as weeks or hours since a start, with the active point's detail in a tip. */
export function NumericAxisChart(props: NumericAxisProps) {
  const [active, setActive] = useState<Active | null>(null);
  const height = props.height ?? 350;
  const series = active ? props.multiLineData[active.series] : undefined;
  const point = active && series ? series.data[active.point] : undefined;
  const content = point && series && props.getHoverContent?.(point, series);

  const onKeyDown = (event: KeyboardEvent) => {
    const next = step(event.key, active, props);
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  };

  return (
    <ChartFrame
      updating={props.updating}
      tip={(width) => {
        const geometry = geometryOf(props, width, height);
        if (!content || !point || !geometry) return null;
        return (
          <ChartTip
            title={content.title}
            x={geometry.xScale(props.getXValue(point))}
            y={geometry.yScale(props.getYValue(point))}
          >
            {content.items.map((item) => (
              <TipRow key={item.label} label={item.label} swatch={item.color}>
                {item.value}
              </TipRow>
            ))}
          </ChartTip>
        );
      }}
    >
      {(width) => (
        <Lines
          width={width}
          height={height}
          chart={props}
          active={active}
          onActive={setActive}
          onKeyDown={onKeyDown}
        />
      )}
    </ChartFrame>
  );
}

function Lines({
  width,
  height,
  chart,
  active,
  onActive,
  onKeyDown,
}: {
  width: number;
  height: number;
  chart: NumericAxisProps;
  active: Active | null;
  onActive: (active: Active | null) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  const geometry = useMemo(
    () => geometryOf(chart, width, height),
    [chart, width, height],
  );
  if (!geometry) return null;
  const { multiLineData, getXValue, getYValue } = chart;
  const x = (d: MultiLineSeries["data"][number]) =>
    geometry.xScale(getXValue(d));
  const y = (d: MultiLineSeries["data"][number]) =>
    geometry.yScale(getYValue(d));

  const hoverNearest = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = (event.clientX - rect.left) * (width / rect.width);
    const py = (event.clientY - rect.top) * (height / rect.height);
    let best: Active | null = null;
    let bestDistance = Infinity;
    multiLineData.forEach((s, seriesIndex) =>
      s.data.forEach((d, pointIndex) => {
        const distance = (px - x(d)) ** 2 + (py - y(d)) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { series: seriesIndex, point: pointIndex };
        }
      }),
    );
    if (best) onActive(best);
  };

  const activeSeries = active ? multiLineData[active.series] : undefined;
  const activePoint =
    active && activeSeries ? activeSeries.data[active.point] : undefined;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${chart.title}. Arrow keys read each point; up and down change line.`}
      tabIndex={0}
      className="rounded-sm focus-ring"
      onKeyDown={onKeyDown}
      onBlur={() => onActive(null)}
      onMouseMove={hoverNearest}
      onMouseLeave={() => onActive(null)}
    >
      <YGrid
        ticks={geometry.yTicks}
        yScale={geometry.yScale}
        yAxisFormat={chart.yAxisFormat}
        width={width}
      />
      <XTicks
        ticks={geometry.xTicks}
        x={geometry.xScale}
        label={(tick) => (chart.xAxisFormat ? chart.xAxisFormat(tick) : String(tick))}
        height={height}
      />
      {multiLineData.map((s, index) => {
        const isActive = active?.series === index;
        return (
          <path
            key={s.key}
            d={geometry.lines[index]}
            fill="none"
            stroke={s.color}
            strokeWidth={isActive ? 3.2 : 2.2}
            opacity={active ? (isActive ? 1 : 0.25) : 1}
          />
        );
      })}
      {(chart.showDataPoints ?? true) &&
        multiLineData.flatMap((s) =>
          s.data.map((d, index) => (
            <PointMark
              key={`${s.key}-${index}`}
              cx={x(d)}
              cy={y(d)}
              color={s.color}
              r={3}
            />
          )),
        )}
      {activePoint && activeSeries && (
        <>
          <Cursor x={x(activePoint)} height={height} />
          {chart.getHoverXLabel && (
            <text
              x={x(activePoint)}
              y={MARGIN.top - 6}
              textAnchor="middle"
              className={axisTextClass}
            >
              {chart.getHoverXLabel(activePoint)}
            </text>
          )}
          <PointMark
            cx={x(activePoint)}
            cy={y(activePoint)}
            color={activeSeries.color}
            r={5}
          />
        </>
      )}
    </svg>
  );
}

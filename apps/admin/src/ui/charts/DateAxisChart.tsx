import {
  area,
  bisector,
  curveMonotoneX,
  extent,
  line,
  max,
  scaleLinear,
  scaleTime,
} from "d3";
import { type MouseEvent, useMemo } from "react";
import { formatDate } from "../../lib/formatDate";
import {
  CHART_MARGIN as MARGIN,
  Cursor,
  dedupeTickLabels,
  PointMark,
  XTicks,
  YGrid,
} from "./axes";
import { ChartFrame, useChartCursor } from "./ChartFrame";
import { ChartTip, TipRow, TipSide } from "./ChartTip";
import type { DataPoint, DateAxisProps } from "./types";

const AREA_OPACITY = 0.14;

function geometryOf(props: DateAxisProps, width: number, height: number) {
  const { data, series, yDomain, yAxisFormat } = props;
  const [first, last] = extent(data, (d) => d.date);
  if (!first || !last) return null;
  const xScale = scaleTime()
    .domain([first, last])
    .range([MARGIN.left, width - MARGIN.right]);
  const top = yDomain
    ? yDomain[1]
    : Math.max(
        (max(series, (s) => max(data, (d) => s.getValue(d))) ?? 0) * 1.1,
        10,
      );
  const yScale = scaleLinear()
    .domain([yDomain ? yDomain[0] : 0, top])
    .nice()
    .range([height - MARGIN.bottom, MARGIN.top]);
  const at = (d: DataPoint) => xScale(d.date ?? first);
  const lines = series.map((s) => ({
    series: s,
    path:
      line<DataPoint>()
        .x(at)
        .y((d) => yScale(s.getValue(d)))
        .curve(curveMonotoneX)(data) ?? "",
  }));
  const areaSeries = props.showArea
    ? (series.find((s) => s.key === props.areaSeriesKey) ?? series[0])
    : undefined;
  const areaPath = areaSeries
    ? (area<DataPoint>()
        .x(at)
        .y0(height - MARGIN.bottom)
        .y1((d) => yScale(areaSeries.getValue(d)))
        .curve(curveMonotoneX)(data) ?? "")
    : "";
  const rawYTicks = yScale.ticks(6);
  return {
    xScale,
    yScale,
    at,
    lines,
    areaSeries,
    areaPath,
    xTicks: xScale.ticks(Math.min(8, data.length)),
    yTicks: props.yTickLabelDedup
      ? dedupeTickLabels(rawYTicks, yAxisFormat)
      : rawYTicks,
  };
}

function activeIndex(props: DateAxisProps, index: number | null) {
  if (index !== null) return index;
  return props.showHoverOnlyOnHover || props.data.length === 0
    ? null
    : props.data.length - 1;
}

function Chart({
  width,
  height,
  chart,
  cursor,
}: {
  width: number;
  height: number;
  chart: DateAxisProps;
  cursor: ReturnType<typeof useChartCursor>;
}) {
  const geometry = useMemo(
    () => geometryOf(chart, width, height),
    [chart, width, height],
  );
  if (!geometry) return null;
  const { data } = chart;

  const hoverNearest = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    if (relativeX < 0 || rect.width === 0) return;
    const date = geometry.xScale.invert(relativeX * (width / rect.width));
    const index = bisector<DataPoint, Date>((d) => d.date ?? date).center(
      data,
      date,
    );
    cursor.setIndex(Math.max(0, Math.min(data.length - 1, index)));
  };

  const active = activeIndex(chart, cursor.index);
  const point = active === null ? undefined : data[active];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${chart.title}. Arrow keys read each point.`}
      {...cursor.markProps}
      onMouseMove={hoverNearest}
      onMouseLeave={() => cursor.setIndex(null)}
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
        label={(tick) => formatDate(tick)}
        height={height}
      />
      {geometry.areaSeries && (
        <path
          d={geometry.areaPath}
          fill={geometry.areaSeries.color}
          fillOpacity={AREA_OPACITY}
        />
      )}
      {geometry.lines.map(({ series, path }) => (
        <path
          key={series.key}
          d={path}
          fill="none"
          stroke={series.color}
          strokeWidth={2.4}
        />
      ))}
      {point && (
        <>
          <Cursor x={geometry.at(point)} height={height} />
          {chart.series.map((s) => (
            <PointMark
              key={s.key}
              cx={geometry.at(point)}
              cy={geometry.yScale(s.getValue(point))}
              color={s.color}
            />
          ))}
        </>
      )}
    </svg>
  );
}

/** Lines over dates, with the active date's detail in a tip. */
export function DateAxisChart(props: DateAxisProps) {
  const height = props.height ?? 350;
  const cursor = useChartCursor(props.data.length);
  const active = activeIndex(props, cursor.index);
  const point = active === null ? undefined : props.data[active];
  const content = point && props.getHoverContent?.(point);

  return (
    <ChartFrame
      updating={props.updating}
      tip={(width) => {
        const geometry = geometryOf(props, width, height);
        if (!content || !point || !geometry) return null;
        return (
          <ChartTip
            title={content.title}
            side={TipSide.Beside}
            x={geometry.at(point)}
            y={MARGIN.top}
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
        <Chart width={width} height={height} chart={props} cursor={cursor} />
      )}
    </ChartFrame>
  );
}

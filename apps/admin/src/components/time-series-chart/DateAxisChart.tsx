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
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  CHART_MARGIN,
  CHART_WIDTH,
  YGrid,
  dedupeTickLabels,
} from "./chartAxes";
import type { DataPoint, DateAxisProps } from "./types";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export const DateAxisChart: React.FC<DateAxisProps & { height: number }> = (
  props,
) => {
  const {
    showArea = false,
    areaSeriesKey,
    areaColor = "rgba(8,145,178,0.12)",
    yAxisFormat,
    yDomain,
    height,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  const dateGeometry = useMemo(() => {
    const { data, series } = props;
    if (data.length === 0) return null;

    const width = CHART_WIDTH;
    const margin = CHART_MARGIN;

    const dateExtent = extent(data, (d) => d.date);
    if (!dateExtent[0] || !dateExtent[1]) return null;

    const xScale = scaleTime()
      .domain(dateExtent)
      .range([margin.left, width - margin.right]);

    const maxValue = yDomain
      ? yDomain[1]
      : (max(series, (s) => max(data, (d) => s.getValue(d))) ?? 0);
    const minValue = yDomain ? yDomain[0] : 0;

    const yScale = scaleLinear()
      .domain([minValue, yDomain ? maxValue : Math.max(maxValue * 1.1, 10)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const lineFn = line<DataPoint>()
      .x((d) => xScale(d.date!))
      .curve(curveMonotoneX);

    const lines = series.map((s) => ({
      series: s,
      path: lineFn.y((d) => yScale(s.getValue(d)))(data) ?? "",
    }));

    let areaPath = "";
    if (showArea) {
      const areaSeries = areaSeriesKey
        ? series.find((s) => s.key === areaSeriesKey)
        : series[0];
      if (areaSeries) {
        const areaFn = area<DataPoint>()
          .x((d) => xScale(d.date!))
          .y0(height - margin.bottom)
          .y1((d) => yScale(areaSeries.getValue(d)))
          .curve(curveMonotoneX);
        areaPath = areaFn(data) ?? "";
      }
    }

    const xTicks = xScale.ticks(Math.min(8, data.length));
    const rawYTicks = yScale.ticks(6);
    const yTicks = props.yTickLabelDedup
      ? dedupeTickLabels(rawYTicks, yAxisFormat)
      : rawYTicks;

    const bisectDate = bisector<DataPoint, Date>((d) => d.date!).center;

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      xTicks,
      yTicks,
      lines,
      areaPath,
      bisectDate,
    };
  }, [props, height, yDomain, showArea, areaSeriesKey, yAxisFormat]);

  const handleDateHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (!dateGeometry || props.data.length === 0 || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      if (relativeX < 0) return;

      const scaleX = dateGeometry.width / rect.width;
      const pointerX = relativeX * scaleX;

      const hoveredDate = dateGeometry.xScale.invert(pointerX);
      const index = dateGeometry.bisectDate(props.data, hoveredDate);
      const clampedIndex = Math.max(0, Math.min(props.data.length - 1, index));

      setHoveredPoint(props.data[clampedIndex]);
    },
    [dateGeometry, props],
  );

  const activePoint = props.showHoverOnlyOnHover
    ? hoveredPoint
    : (hoveredPoint ??
      (props.data.length > 0 ? props.data[props.data.length - 1] : null));
  const hoverContent =
    activePoint && props.getHoverContent
      ? props.getHoverContent(activePoint)
      : null;

  if (!dateGeometry) return null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${dateGeometry.width} ${dateGeometry.height}`}
      className="w-full"
      onMouseMove={handleDateHover}
      onMouseLeave={() => setHoveredPoint(null)}
    >
      <g>
        <YGrid
          ticks={dateGeometry.yTicks}
          yScale={dateGeometry.yScale}
          yAxisFormat={yAxisFormat}
          width={dateGeometry.width}
          margin={dateGeometry.margin}
        />
        {dateGeometry.xTicks.map((tick) => (
          <g key={`x-${tick.toISOString()}`}>
            <line
              x1={dateGeometry.xScale(tick)}
              x2={dateGeometry.xScale(tick)}
              y1={dateGeometry.margin.top}
              y2={dateGeometry.height - dateGeometry.margin.bottom}
              stroke="#f3f4f6"
            />
            <text
              x={dateGeometry.xScale(tick)}
              y={dateGeometry.height - dateGeometry.margin.bottom + 24}
              textAnchor="middle"
              className="fill-gray-600 text-xs"
            >
              {dateFormatter.format(tick)}
            </text>
          </g>
        ))}
      </g>

      {showArea && dateGeometry.areaPath && (
        <path d={dateGeometry.areaPath} fill={areaColor} stroke="none" />
      )}

      {dateGeometry.lines.map(({ series: s, path }) => (
        <path
          key={s.key}
          d={path}
          fill="none"
          stroke={s.color}
          strokeWidth={2.4}
        />
      ))}

      {activePoint && (
        <>
          <line
            x1={dateGeometry.xScale(activePoint.date!)}
            x2={dateGeometry.xScale(activePoint.date!)}
            y1={dateGeometry.margin.top}
            y2={dateGeometry.height - dateGeometry.margin.bottom}
            stroke="#6b7280"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          {props.series.map((s) => (
            <circle
              key={`point-${s.key}`}
              cx={dateGeometry.xScale(activePoint.date!)}
              cy={dateGeometry.yScale(s.getValue(activePoint))}
              r={4}
              fill="white"
              stroke={s.color}
              strokeWidth={2}
            />
          ))}

          {hoverContent && (
            <>
              <rect
                x={Math.min(
                  dateGeometry.xScale(activePoint.date!) + 12,
                  dateGeometry.width - 334,
                )}
                y={dateGeometry.margin.top + 12}
                width={320}
                height={hoverContent.items.length * 24 + 42}
                rx={10}
                fill="white"
                stroke="#e5e7eb"
                className="shadow-lg"
              />
              <text
                x={Math.min(
                  dateGeometry.xScale(activePoint.date!) + 24,
                  dateGeometry.width - 320,
                )}
                y={dateGeometry.margin.top + 32}
                className="fill-gray-900 text-sm font-semibold"
              >
                {hoverContent.title}
              </text>
              {hoverContent.items.map((item, idx) => (
                <g
                  key={`label-${item.label}`}
                  transform={`translate(${Math.min(
                    dateGeometry.xScale(activePoint.date!) + 24,
                    dateGeometry.width - 320,
                  )}, ${dateGeometry.margin.top + 52 + idx * 24})`}
                >
                  {item.color && (
                    <rect
                      x={0}
                      y={-10}
                      width={12}
                      height={12}
                      rx={3}
                      fill={item.color}
                    />
                  )}
                  <text
                    x={item.color ? 16 : 0}
                    y={0}
                    className="fill-gray-700 text-xs"
                  >
                    {item.label}
                  </text>
                  <text
                    x={288}
                    y={0}
                    textAnchor="end"
                    className="fill-gray-900 text-xs font-semibold"
                  >
                    {item.value}
                  </text>
                </g>
              ))}
            </>
          )}
        </>
      )}
    </svg>
  );
};

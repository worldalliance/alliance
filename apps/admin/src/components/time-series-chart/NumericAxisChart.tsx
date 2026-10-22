import { curveMonotoneX, extent, line, max, scaleLinear } from "d3";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  CHART_MARGIN,
  CHART_WIDTH,
  YGrid,
  dedupeTickLabels,
} from "./chartAxes";
import type { DataPoint, MultiLineSeries, NumericAxisProps } from "./types";

export const NumericAxisChart: React.FC<
  NumericAxisProps & { height: number }
> = (props) => {
  const { yAxisFormat, yDomain, height } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<MultiLineSeries | null>(
    null,
  );

  const numericGeometry = useMemo(() => {
    const { multiLineData, getXValue, getYValue, xRange } = props;
    if (multiLineData.length === 0) return null;

    const allData = multiLineData.flatMap((s) => s.data);
    if (allData.length === 0) return null;

    const width = CHART_WIDTH;
    const margin = CHART_MARGIN;

    const xExtent = xRange
      ? [xRange.min, xRange.max]
      : extent(allData, getXValue);
    if (xExtent[0] === undefined || xExtent[1] === undefined) return null;

    const xScale = scaleLinear()
      .domain([xExtent[0], xExtent[1]])
      .range([margin.left, width - margin.right]);

    const maxValue = yDomain ? yDomain[1] : (max(allData, getYValue) ?? 0);
    const minValue = yDomain ? yDomain[0] : 0;

    const yScale = scaleLinear()
      .domain([minValue, yDomain ? maxValue : Math.max(maxValue * 1.1, 1)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const lineFn = line<DataPoint>()
      .x((d) => xScale(getXValue(d)))
      .y((d) => yScale(getYValue(d)))
      .curve(curveMonotoneX);

    const lines = multiLineData.map((s) => ({
      series: s,
      path: lineFn(s.data) ?? "",
    }));

    const xTicks = xScale.ticks(Math.min(8, xExtent[1] - xExtent[0] + 1));
    const rawYTicks = yScale.ticks(6);
    const yTicks = props.yTickLabelDedup
      ? dedupeTickLabels(rawYTicks, yAxisFormat)
      : rawYTicks;

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      xTicks,
      yTicks,
      lines,
    };
  }, [props, height, yDomain, yAxisFormat]);

  const handleNumericHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (!numericGeometry || !svgRef.current) return;
      const { multiLineData, getXValue, getYValue } = props;

      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = numericGeometry.width / rect.width;
      const scaleY = numericGeometry.height / rect.height;
      const pointerX = (event.clientX - rect.left) * scaleX;
      const pointerY = (event.clientY - rect.top) * scaleY;

      let bestDist = Infinity;
      let bestPoint: DataPoint | null = null;
      let bestSeries: MultiLineSeries | null = null;

      for (const s of multiLineData) {
        for (const point of s.data) {
          const px = numericGeometry.xScale(getXValue(point));
          const py = numericGeometry.yScale(getYValue(point));
          const dx = pointerX - px;
          const dy = pointerY - py;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            bestPoint = point;
            bestSeries = s;
          }
        }
      }

      if (bestPoint && bestSeries) {
        setHoveredPoint(bestPoint);
        setHoveredSeries(bestSeries);
      }
    },
    [numericGeometry, props],
  );

  const numericHoverContent =
    hoveredPoint && hoveredSeries && props.getHoverContent
      ? props.getHoverContent(hoveredPoint, hoveredSeries)
      : null;

  if (!numericGeometry) return null;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${numericGeometry.width} ${numericGeometry.height}`}
        className="w-full"
        onMouseMove={handleNumericHover}
        onMouseLeave={() => {
          setHoveredPoint(null);
          setHoveredSeries(null);
        }}
      >
        <g>
          <YGrid
            ticks={numericGeometry.yTicks}
            yScale={numericGeometry.yScale}
            yAxisFormat={yAxisFormat}
            width={numericGeometry.width}
            margin={numericGeometry.margin}
          />
          {numericGeometry.xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={numericGeometry.xScale(tick)}
                x2={numericGeometry.xScale(tick)}
                y1={numericGeometry.margin.top}
                y2={numericGeometry.height - numericGeometry.margin.bottom}
                stroke="#f3f4f6"
              />
              <text
                x={numericGeometry.xScale(tick)}
                y={numericGeometry.height - numericGeometry.margin.bottom + 24}
                textAnchor="middle"
                className="fill-gray-600 text-xs"
              >
                {props.xAxisFormat ? props.xAxisFormat(tick) : tick}
              </text>
            </g>
          ))}
        </g>

        {numericGeometry.lines.map(({ series: s, path }) => {
          const isHovered = hoveredSeries?.key === s.key;
          return (
            <path
              key={s.key}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={isHovered ? 3.2 : 2.2}
              opacity={hoveredSeries ? (isHovered ? 1 : 0.25) : 1}
            />
          );
        })}

        {props.showDataPoints === false && hoveredPoint && hoveredSeries && (
          <>
            {props.getHoverXLabel && (
              <text
                x={numericGeometry.xScale(props.getXValue(hoveredPoint))}
                y={numericGeometry.margin.top - 6}
                textAnchor="middle"
                className="fill-gray-600 text-xs font-medium"
              >
                {props.getHoverXLabel(hoveredPoint)}
              </text>
            )}
            <line
              x1={numericGeometry.xScale(props.getXValue(hoveredPoint))}
              x2={numericGeometry.xScale(props.getXValue(hoveredPoint))}
              y1={numericGeometry.margin.top}
              y2={numericGeometry.height - numericGeometry.margin.bottom}
              stroke="#6b7280"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle
              cx={numericGeometry.xScale(props.getXValue(hoveredPoint))}
              cy={numericGeometry.yScale(props.getYValue(hoveredPoint))}
              r={5}
              fill="white"
              stroke={hoveredSeries.color}
              strokeWidth={2}
            />
          </>
        )}

        {props.showDataPoints !== false &&
          props.multiLineData.flatMap((s) =>
            s.data.map((point, idx) => {
              const isHovered =
                hoveredSeries?.key === s.key &&
                hoveredPoint &&
                props.getXValue(hoveredPoint) === props.getXValue(point);
              return (
                <circle
                  key={`${s.key}-${idx}`}
                  cx={numericGeometry.xScale(props.getXValue(point))}
                  cy={numericGeometry.yScale(props.getYValue(point))}
                  r={isHovered ? 5 : 3}
                  fill="white"
                  stroke={s.color}
                  strokeWidth={2}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredSeries(s);
                    setHoveredPoint(point);
                  }}
                  onMouseLeave={() => {
                    setHoveredSeries(null);
                    setHoveredPoint(null);
                  }}
                />
              );
            }),
          )}
      </svg>

      {numericHoverContent && hoveredSeries && (
        <div className="absolute top-14 left-30 pointer-events-none">
          <p className="font-semibold text-gray-900 mb-1 text-sm">
            {numericHoverContent.title}
          </p>
          <div className="space-y-0.5 text-sm">
            {numericHoverContent.items.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="text-gray-500">{item.label}:</span>
                <span
                  className="font-medium"
                  style={{ color: item.color ?? "#111827" }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

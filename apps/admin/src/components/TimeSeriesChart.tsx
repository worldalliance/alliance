import * as d3 from "d3";
import React, { useCallback, useMemo, useRef, useState } from "react";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const formatDateAsLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  getValue: (d: DataPoint) => number;
};

export type MultiLineSeries = {
  key: string;
  label: string;
  color: string;
  data: DataPoint[];
};

export type DataPoint = {
  date?: Date;
  x?: number;
  [key: string]: unknown;
};

type DateRange = {
  start: string;
  end: string;
};

type NumericRange = {
  min: number;
  max: number;
};

type HoverContent = {
  title: string;
  items: { label: string; value: string | number; color?: string }[];
};

type BaseChartProps = {
  title: string;
  loading?: boolean;
  emptyMessage?: string;
  showArea?: boolean;
  areaSeriesKey?: string;
  areaColor?: string;
  yAxisFormat?: (value: number) => string;
  yDomain?: [number, number];
  height?: number;
  headerContent?: React.ReactNode;
};

type DateAxisProps = BaseChartProps & {
  xType?: "date";
  data: DataPoint[];
  series: ChartSeries[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  getHoverContent?: (point: DataPoint) => HoverContent;
};

type NumericAxisProps = BaseChartProps & {
  xType: "number";
  xAxisFormat?: (value: number) => string;
  xAxisLabel?: string;
  xRange?: NumericRange;
  onXRangeChange?: (range: NumericRange) => void;
  getXValue: (d: DataPoint) => number;
  getYValue: (d: DataPoint) => number;
  multiLineData: MultiLineSeries[];
  getHoverContent?: (point: DataPoint, series: MultiLineSeries) => HoverContent;
  legendGradient?: string;
  legendLabels?: { left: string; right: string };
};

type TimeSeriesChartProps = DateAxisProps | NumericAxisProps;

function isNumericAxis(props: TimeSeriesChartProps): props is NumericAxisProps {
  return props.xType === "number";
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = (props) => {
  const {
    title,
    loading = false,
    emptyMessage = "No data available.",
    showArea = false,
    areaSeriesKey,
    areaColor = "rgba(8,145,178,0.12)",
    yAxisFormat,
    yDomain,
    height = 350,
    headerContent,
  } = props;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<MultiLineSeries | null>(
    null
  );

  // Date-based chart geometry
  const dateGeometry = useMemo(() => {
    if (isNumericAxis(props)) return null;
    const { data, series } = props;
    if (data.length === 0) return null;

    const width = 1000;
    const margin = { top: 28, right: 32, bottom: 64, left: 72 };

    const dateExtent = d3.extent(data, (d) => d.date);
    if (!dateExtent[0] || !dateExtent[1]) return null;

    const xScale = d3
      .scaleTime()
      .domain(dateExtent)
      .range([margin.left, width - margin.right]);

    const maxValue = yDomain
      ? yDomain[1]
      : d3.max(series, (s) => d3.max(data, (d) => s.getValue(d))) ?? 0;
    const minValue = yDomain ? yDomain[0] : 0;

    const yScale = d3
      .scaleLinear()
      .domain([minValue, yDomain ? maxValue : Math.max(maxValue * 1.1, 10)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<DataPoint>()
      .x((d) => xScale(d.date!))
      .curve(d3.curveMonotoneX);

    const lines = series.map((s) => ({
      series: s,
      path: line.y((d) => yScale(s.getValue(d)))(data) ?? "",
    }));

    let areaPath = "";
    if (showArea) {
      const areaSeries = areaSeriesKey
        ? series.find((s) => s.key === areaSeriesKey)
        : series[0];
      if (areaSeries) {
        const area = d3
          .area<DataPoint>()
          .x((d) => xScale(d.date!))
          .y0(height - margin.bottom)
          .y1((d) => yScale(areaSeries.getValue(d)))
          .curve(d3.curveMonotoneX);
        areaPath = area(data) ?? "";
      }
    }

    const xTicks = xScale.ticks(Math.min(8, data.length));
    const yTicks = yScale.ticks(6);

    const bisectDate = d3.bisector<DataPoint, Date>((d) => d.date!).center;

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
  }, [props, height, yDomain, showArea, areaSeriesKey]);

  // Numeric x-axis chart geometry
  const numericGeometry = useMemo(() => {
    if (!isNumericAxis(props)) return null;
    const { multiLineData, getXValue, getYValue, xRange } = props;
    if (multiLineData.length === 0) return null;

    const allData = multiLineData.flatMap((s) => s.data);
    if (allData.length === 0) return null;

    const width = 1000;
    const margin = { top: 28, right: 32, bottom: 64, left: 72 };

    const xExtent = xRange
      ? [xRange.min, xRange.max]
      : d3.extent(allData, getXValue);
    if (xExtent[0] === undefined || xExtent[1] === undefined) return null;

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0], xExtent[1]])
      .range([margin.left, width - margin.right]);

    const maxValue = yDomain ? yDomain[1] : d3.max(allData, getYValue) ?? 0;
    const minValue = yDomain ? yDomain[0] : 0;

    const yScale = d3
      .scaleLinear()
      .domain([minValue, yDomain ? maxValue : Math.max(maxValue * 1.1, 1)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<DataPoint>()
      .x((d) => xScale(getXValue(d)))
      .y((d) => yScale(getYValue(d)))
      .curve(d3.curveMonotoneX);

    const lines = multiLineData.map((s) => ({
      series: s,
      path: line(s.data) ?? "",
    }));

    const xTicks = xScale.ticks(Math.min(8, xExtent[1] - xExtent[0] + 1));
    const yTicks = yScale.ticks(6);

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
  }, [props, height, yDomain]);

  const handleDateHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (isNumericAxis(props)) return;
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
    [dateGeometry, props]
  );

  const hasData = isNumericAxis(props)
    ? props.multiLineData.length > 0 &&
      props.multiLineData.some((s) => s.data.length > 0)
    : props.data.length > 0;

  // For date charts
  const activePoint = !isNumericAxis(props)
    ? hoveredPoint ??
      (props.data.length > 0 ? props.data[props.data.length - 1] : null)
    : null;
  const hoverContent =
    activePoint && !isNumericAxis(props) && props.getHoverContent
      ? props.getHoverContent(activePoint)
      : null;

  // For numeric charts
  const numericHoverContent =
    hoveredPoint &&
    hoveredSeries &&
    isNumericAxis(props) &&
    props.getHoverContent
      ? props.getHoverContent(hoveredPoint, hoveredSeries)
      : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {!isNumericAxis(props) &&
          props.dateRange &&
          props.onDateRangeChange && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-600">
                  From
                </label>
                <input
                  type="date"
                  value={props.dateRange.start}
                  onChange={(e) =>
                    props.onDateRangeChange!({
                      ...props.dateRange!,
                      start: e.target.value,
                    })
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-600">
                  To
                </label>
                <input
                  type="date"
                  value={props.dateRange.end}
                  onChange={(e) =>
                    props.onDateRangeChange!({
                      ...props.dateRange!,
                      end: e.target.value,
                    })
                  }
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                />
              </div>
            </div>
          )}
        {isNumericAxis(props) && props.xRange && props.onXRangeChange && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">
                {props.xAxisLabel ?? "Min"}
              </label>
              <input
                type="number"
                value={props.xRange.min}
                onChange={(e) =>
                  props.onXRangeChange!({
                    ...props.xRange!,
                    min: Number(e.target.value),
                  })
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">Max</label>
              <input
                type="number"
                value={props.xRange.max}
                onChange={(e) =>
                  props.onXRangeChange!({
                    ...props.xRange!,
                    max: Number(e.target.value),
                  })
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white w-20"
              />
            </div>
          </div>
        )}
        {headerContent}
      </div>
      <div className="relative p-4">
        {loading && !hasData && (
          <p className="text-sm text-gray-600">Loading...</p>
        )}
        {!loading && !hasData && (
          <p className="text-sm text-gray-600">{emptyMessage}</p>
        )}

        {/* Date-based chart */}
        {!isNumericAxis(props) && dateGeometry && hasData && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dateGeometry.width} ${dateGeometry.height}`}
            className="w-full"
            onMouseMove={handleDateHover}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Grid lines */}
            <g>
              {dateGeometry.yTicks.map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    x1={dateGeometry.margin.left}
                    x2={dateGeometry.width - dateGeometry.margin.right}
                    y1={dateGeometry.yScale(tick)}
                    y2={dateGeometry.yScale(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={dateGeometry.margin.left - 12}
                    y={dateGeometry.yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-500 text-xs"
                  >
                    {yAxisFormat ? yAxisFormat(tick) : tick}
                  </text>
                </g>
              ))}
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

            {/* Area fill */}
            {showArea && dateGeometry.areaPath && (
              <path d={dateGeometry.areaPath} fill={areaColor} stroke="none" />
            )}

            {/* Lines */}
            {dateGeometry.lines.map(({ series: s, path }) => (
              <path
                key={s.key}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2.4}
              />
            ))}

            {/* Hover indicator */}
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

                {/* Hover tooltip */}
                {hoverContent && (
                  <>
                    <rect
                      x={Math.min(
                        dateGeometry.xScale(activePoint.date!) + 12,
                        dateGeometry.width - 210
                      )}
                      y={dateGeometry.margin.top + 12}
                      width={196}
                      height={hoverContent.items.length * 24 + 42}
                      rx={10}
                      fill="white"
                      stroke="#e5e7eb"
                      className="shadow-lg"
                    />
                    <text
                      x={Math.min(
                        dateGeometry.xScale(activePoint.date!) + 24,
                        dateGeometry.width - 196
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
                          dateGeometry.width - 196
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
                          x={164}
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
        )}

        {/* Numeric x-axis chart */}
        {isNumericAxis(props) && numericGeometry && hasData && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${numericGeometry.width} ${numericGeometry.height}`}
            className="w-full"
          >
            {/* Grid lines */}
            <g>
              {numericGeometry.yTicks.map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    x1={numericGeometry.margin.left}
                    x2={numericGeometry.width - numericGeometry.margin.right}
                    y1={numericGeometry.yScale(tick)}
                    y2={numericGeometry.yScale(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={numericGeometry.margin.left - 12}
                    y={numericGeometry.yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-500 text-xs"
                  >
                    {yAxisFormat ? yAxisFormat(tick) : tick}
                  </text>
                </g>
              ))}
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
                    y={
                      numericGeometry.height -
                      numericGeometry.margin.bottom +
                      24
                    }
                    textAnchor="middle"
                    className="fill-gray-600 text-xs"
                  >
                    {props.xAxisFormat ? props.xAxisFormat(tick) : tick}
                  </text>
                </g>
              ))}
            </g>

            {/* Lines */}
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

            {/* Data points */}
            {props.multiLineData.flatMap((s) =>
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
              })
            )}
          </svg>
        )}

        {/* Hover tooltip for numeric chart */}
        {isNumericAxis(props) && numericHoverContent && hoveredSeries && (
          <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[220px] pointer-events-none">
            <p className="font-semibold text-gray-900 mb-2">
              {numericHoverContent.title}
            </p>
            <div className="space-y-1 text-sm">
              {numericHoverContent.items.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-gray-600">{item.label}:</span>
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
      </div>

      {/* Legend for numeric charts with gradient */}
      {isNumericAxis(props) && props.legendGradient && props.legendLabels && (
        <div className="flex items-center gap-2 px-4 pb-4 text-[11px] text-gray-500">
          <span>{props.legendLabels.left}</span>
          <div
            className="h-2 w-40 rounded-full border border-gray-200"
            style={{ background: props.legendGradient }}
          />
          <span>{props.legendLabels.right}</span>
        </div>
      )}
    </div>
  );
};

export { formatDateAsLocal, fullDateFormatter, dateFormatter };

import React from "react";
import { DateAxisChart } from "./time-series-chart/DateAxisChart";
import { NumericAxisChart } from "./time-series-chart/NumericAxisChart";
import type {
  NumericAxisProps,
  TimeSeriesChartProps,
} from "./time-series-chart/types";

export type {
  ChartSeries,
  DataPoint,
  MultiLineSeries,
} from "./time-series-chart/types";

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function isNumericAxis(props: TimeSeriesChartProps): props is NumericAxisProps {
  return props.xType === "number";
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = (props) => {
  const {
    title,
    loading = false,
    emptyMessage = "No data available.",
    height = 350,
    headerContent,
  } = props;

  const hasData = isNumericAxis(props)
    ? props.multiLineData.length > 0 &&
      props.multiLineData.some((s) => s.data.length > 0)
    : props.data.length > 0;

  return (
    <div className="relative overflow-hidden rounded border border-gray-200 bg-white">
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

        {hasData &&
          (isNumericAxis(props) ? (
            <NumericAxisChart {...props} height={height} />
          ) : (
            <DateAxisChart {...props} height={height} />
          ))}
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

export { fullDateFormatter };

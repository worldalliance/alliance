import { cn } from "@alliance/shared/styles/util";
import React from "react";
import { DateAxisChart } from "./time-series-chart/DateAxisChart";
import { NumericAxisChart } from "./time-series-chart/NumericAxisChart";
import type {
  NumericAxisProps,
  TimeSeriesChartProps,
} from "./time-series-chart/types";
import { inputClass } from "./ui/controlStyles";
import DateRangeInputs from "./ui/DateRangeInputs";
import Section from "./ui/Section";

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

  const xRangeInputs = isNumericAxis(props) &&
    props.xRange &&
    props.onXRangeChange && (
      <>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          {props.xAxisLabel ?? "Min"}
          <input
            type="number"
            value={props.xRange.min}
            onChange={(e) =>
              props.onXRangeChange!({
                ...props.xRange!,
                min: Number(e.target.value),
              })
            }
            className={cn(inputClass, "w-20")}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Max
          <input
            type="number"
            value={props.xRange.max}
            onChange={(e) =>
              props.onXRangeChange!({
                ...props.xRange!,
                max: Number(e.target.value),
              })
            }
            className={cn(inputClass, "w-20")}
          />
        </label>
      </>
    );

  return (
    <Section
      title={title}
      actions={
        <>
          {!isNumericAxis(props) &&
            props.dateRange &&
            props.onDateRangeChange && (
              <DateRangeInputs
                value={props.dateRange}
                onChange={props.onDateRangeChange}
              />
            )}
          {xRangeInputs}
          {headerContent}
        </>
      }
    >
      <div className="relative">
        {loading && !hasData && (
          <p className="text-sm text-zinc-600">Loading…</p>
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

      {isNumericAxis(props) && props.legendGradient && props.legendLabels && (
        <div className="flex items-center gap-2 pt-2 text-xs text-zinc-500">
          <span>{props.legendLabels.left}</span>
          <div
            className="h-2 w-40 rounded-full border border-gray-200"
            style={{ background: props.legendGradient }}
          />
          <span>{props.legendLabels.right}</span>
        </div>
      )}
    </Section>
  );
};

export { fullDateFormatter };

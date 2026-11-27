import type React from "react";
import type { DateRange } from "../ui/DateRangeInputs";

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
  /** Formats the data table's values; defaults to `yAxisFormat`. */
  valueFormat?: (value: number) => string;
  yDomain?: [number, number];
  height?: number;
  headerContent?: React.ReactNode;
  showHoverOnlyOnHover?: boolean;
  yTickLabelDedup?: boolean;
};

export type DateAxisProps = BaseChartProps & {
  xType?: "date";
  /** Heads the data table's date column; "Date" when unset. */
  xAxisLabel?: string;
  data: DataPoint[];
  series: ChartSeries[];
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  getHoverContent?: (point: DataPoint) => HoverContent;
};

export type NumericAxisProps = BaseChartProps & {
  xType: "number";
  xAxisFormat?: (value: number) => string;
  /** Names the x values: the data table's first column and the minimum range input. */
  xAxisLabel: string;
  xRange?: NumericRange;
  onXRangeChange?: (range: NumericRange) => void;
  getXValue: (d: DataPoint) => number;
  getYValue: (d: DataPoint) => number;
  multiLineData: MultiLineSeries[];
  getHoverContent?: (point: DataPoint, series: MultiLineSeries) => HoverContent;
  showDataPoints?: boolean;
  getHoverXLabel?: (point: DataPoint) => string;
  legendGradient?: string;
  legendLabels?: { left: string; right: string };
};

export type TimeSeriesChartProps = DateAxisProps | NumericAxisProps;

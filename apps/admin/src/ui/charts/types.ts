export type ChartSeries = {
  key: string;
  label: string;
  /** A colour value: `SERIES[n]` or another value from `chartColor.ts`. */
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

export type HoverContent = {
  title: string;
  items: { label: string; value: string | number; color?: string }[];
};

type BaseChartProps = {
  /** The chart's accessible name. */
  title: string;
  yAxisFormat?: (value: number) => string;
  yDomain?: [number, number];
  height?: number;
  yTickLabelDedup?: boolean;
  /** Dim the chart and say so while new data replaces what it shows. */
  updating?: boolean;
};

export type DateAxisProps = BaseChartProps & {
  data: DataPoint[];
  series: ChartSeries[];
  /** Fill under one series: the one `areaSeriesKey` names, else the first. */
  showArea?: boolean;
  areaSeriesKey?: string;
  getHoverContent?: (point: DataPoint) => HoverContent;
  /** No point is active until the pointer or keyboard picks one; otherwise the latest is. */
  showHoverOnlyOnHover?: boolean;
};

export type NumericAxisProps = BaseChartProps & {
  xAxisFormat?: (value: number) => string;
  xRange?: { min: number; max: number };
  getXValue: (d: DataPoint) => number;
  getYValue: (d: DataPoint) => number;
  multiLineData: MultiLineSeries[];
  getHoverContent?: (point: DataPoint, series: MultiLineSeries) => HoverContent;
  /** A ring on every point, not only the active one. On unless set false. */
  showDataPoints?: boolean;
  getHoverXLabel?: (point: DataPoint) => string;
};

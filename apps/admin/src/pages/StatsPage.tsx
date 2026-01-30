import {
  analyticsGetDailyStats,
  analyticsGetActionStats,
  analyticsRecalculateActionStats,
  analyticsGetMemberCompletionRetention,
  analyticsGetAggregateStats,
  analyticsGetContractStatusHistory,
  analyticsGetTimeToChurnSamples,
} from "@alliance/shared/client";
import {
  TimeSeriesChart,
  formatDateAsLocal,
  fullDateFormatter,
  type ChartSeries,
  type DataPoint,
  type MultiLineSeries,
} from "../components/TimeSeriesChart";
import {
  DailyStatsRecord,
  ActionStatsRecord,
  MemberCompletionRetentionCohortDto,
  AggregateStatsDto,
  ContractStatusPointDto,
  TimeToChurnSampleDto,
} from "@alliance/shared/client/types.gen";
import chroma from "chroma-js";
import * as d3 from "d3";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ParsedDailyStats = DailyStatsRecord & { parsedDate: Date };
type ActionStatsWithWithdrawals = ActionStatsRecord & {
  usersWithdrawn?: number;
};
type HoveredActionBar = {
  action: ActionStatsWithWithdrawals;
  index: number;
};

const buildRoundedLeftPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (width <= 0 || height <= 0) return "";
  return [
    `M ${x + r} ${y}`,
    `H ${x + width}`,
    `V ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ");
};

const buildRoundedRightPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (width <= 0 || height <= 0) return "";
  return [
    `M ${x} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x}`,
    "Z",
  ].join(" ");
};
type MetricKey =
  | "actionsCompleted"
  | "anonFormSubmissions"
  | "signedMembers"
  | "invitesAccepted"
  | "invitesCreated"
  | "suspendedMembers";

type MetricDefinition = {
  key: MetricKey;
  label: string;
  color: string;
};

const metricDefinitions: MetricDefinition[] = [
  {
    key: "actionsCompleted",
    label: "Actions completed",
    color: "#0891b2",
  },
  {
    key: "anonFormSubmissions",
    label: "Public responses",
    color: "#8b5cf6",
  },
  {
    key: "signedMembers",
    label: "Members signed",
    color: "#16a34a",
  },
  {
    key: "invitesAccepted",
    label: "Invites accepted",
    color: "#f97316",
  },
  {
    key: "invitesCreated",
    label: "Invites created",
    color: "#2563eb",
  },
  {
    key: "suspendedMembers",
    label: "Members suspended",
    color: "#111827",
  },
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    start: formatDateAsLocal(start),
    end: formatDateAsLocal(end),
  };
};

const StatsPage: React.FC = () => {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [startInput, setStartInput] = useState<string>(defaultRange.start);
  const [endInput, setEndInput] = useState<string>(defaultRange.end);
  const [queryRange, setQueryRange] = useState(defaultRange);
  const [stats, setStats] = useState<DailyStatsRecord[]>([]);
  const [actionStats, setActionStats] = useState<ActionStatsWithWithdrawals[]>(
    []
  );
  const [aggregateStats, setAggregateStats] =
    useState<AggregateStatsDto | null>(null);
  const [aggregateStatsLoading, setAggregateStatsLoading] =
    useState<boolean>(false);
  const [retentionCohorts, setRetentionCohorts] = useState<
    MemberCompletionRetentionCohortDto[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionStatsLoading, setActionStatsLoading] = useState<boolean>(false);
  const [retentionLoading, setRetentionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredActionBar, setHoveredActionBar] =
    useState<HoveredActionBar | null>(null);
  const [timeToChurnSamples, setTimeToChurnSamples] = useState<
    TimeToChurnSampleDto[]
  >([]);
  const [timeToChurnLoading, setTimeToChurnLoading] = useState<boolean>(false);
  const [dailyStatsTableOpen, setDailyStatsTableOpen] = useState(false);
  const [actionStatsTableOpen, setActionStatsTableOpen] = useState(false);
  const [weekRange, setWeekRange] = useState({ min: 0, max: 20 });
  const [hoveredContractPoint, setHoveredContractPoint] = useState<
    (ContractStatusPointDto & { parsedDate: Date }) | null
  >(null);
  const [completionRateAbsolute, setCompletionRateAbsolute] =
    useState<boolean>(false);
  const [completionRateRange, setCompletionRateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    return {
      start: formatDateAsLocal(start),
      end: formatDateAsLocal(end),
    };
  });
  const [assumedHourlyRate, setAssumedHourlyRate] = useState<number>(15);
  const [contractStatusHistory, setContractStatusHistory] = useState<
    ContractStatusPointDto[]
  >([]);
  const [contractStatusLoading, setContractStatusLoading] =
    useState<boolean>(false);
  const [contractStatusRange, setContractStatusRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    return {
      start: formatDateAsLocal(start),
      end: formatDateAsLocal(end),
    };
  });

  const contractStatusSvgRef = useRef<SVGSVGElement | null>(null);

  const loadStats = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true);
    setError(null);

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);

    if (
      Number.isNaN(parsedStart.getTime()) ||
      Number.isNaN(parsedEnd.getTime())
    ) {
      setError("Please provide valid start and end dates.");
      setLoading(false);
      return;
    }

    if (parsedStart > parsedEnd) {
      setError("Start date must be before the end date.");
      setLoading(false);
      return;
    }

    try {
      const response = await analyticsGetDailyStats({
        query: {
          date: parsedStart.toISOString(),
          endDate: parsedEnd.toISOString(),
        },
      });

      const orderedData = (response.data ?? []).slice().sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      setStats(orderedData);
    } catch (err) {
      console.error("Failed to load daily stats", err);
      setError("Unable to load analytics right now. Please try again soon.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats(queryRange.start, queryRange.end);
  }, [loadStats, queryRange.end, queryRange.start]);

  const loadActionStats = useCallback(async () => {
    setActionStatsLoading(true);
    try {
      const response = await analyticsGetActionStats();
      setActionStats(response.data ?? []);
    } catch (err) {
      console.error("Failed to load action stats", err);
    } finally {
      setActionStatsLoading(false);
    }
  }, []);

  const loadRetentionCohorts = useCallback(async () => {
    setRetentionLoading(true);
    try {
      const response = await analyticsGetMemberCompletionRetention();
      setRetentionCohorts(response.data ?? []);
    } catch (err) {
      console.error("Failed to load retention cohorts", err);
    } finally {
      setRetentionLoading(false);
    }
  }, []);

  const loadAggregateStats = useCallback(async () => {
    setAggregateStatsLoading(true);
    try {
      const response = await analyticsGetAggregateStats();
      setAggregateStats(response.data ?? null);
    } catch (err) {
      console.error("Failed to load aggregate stats", err);
    } finally {
      setAggregateStatsLoading(false);
    }
  }, []);

  const loadTimeToChurnSamples = useCallback(async () => {
    setTimeToChurnLoading(true);
    try {
      const response = await analyticsGetTimeToChurnSamples();
      setTimeToChurnSamples(response.data ?? []);
    } catch (err) {
      console.error("Failed to load time to churn samples", err);
    } finally {
      setTimeToChurnLoading(false);
    }
  }, []);

  const handleRecalculateActionStats = useCallback(async () => {
    setActionStatsLoading(true);
    try {
      const response = await analyticsRecalculateActionStats();
      setActionStats(response.data ?? []);
    } catch (err) {
      console.error("Failed to recalculate action stats", err);
    } finally {
      setActionStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActionStats();
  }, [loadActionStats]);

  useEffect(() => {
    void loadRetentionCohorts();
  }, [loadRetentionCohorts]);

  useEffect(() => {
    void loadAggregateStats();
  }, [loadAggregateStats]);

  useEffect(() => {
    void loadTimeToChurnSamples();
  }, [loadTimeToChurnSamples]);

  const loadContractStatusHistory = useCallback(async () => {
    setContractStatusLoading(true);
    try {
      const response = await analyticsGetContractStatusHistory({
        query: {
          startDate: contractStatusRange.start,
          endDate: contractStatusRange.end,
        },
      });
      setContractStatusHistory(response.data ?? []);
    } catch (err) {
      console.error("Failed to load contract status history", err);
    } finally {
      setContractStatusLoading(false);
    }
  }, [contractStatusRange]);

  useEffect(() => {
    void loadContractStatusHistory();
  }, [loadContractStatusHistory]);

  const parsedStats = useMemo<ParsedDailyStats[]>(() => {
    return stats
      .map((record) => ({
        ...record,
        parsedDate: new Date(record.date),
      }))
      .filter((record) => !Number.isNaN(record.parsedDate.getTime()));
  }, [stats]);

  // Convert parsedStats to DataPoint format for TimeSeriesChart
  const dailyStatsChartData: DataPoint[] = useMemo(() => {
    return parsedStats.map((d) => ({
      date: d.parsedDate,
      signedMembers: d.signedMembers,
      invitesAccepted: d.invitesAccepted,
      invitesCreated: d.invitesCreated,
      suspendedMembers: d.suspendedMembers,
      actionsCompleted: d.actionsCompleted,
      anonFormSubmissions: d.anonFormSubmissions,
    }));
  }, [parsedStats]);

  // Series definitions for main chart (members, invites)
  const mainChartSeries: ChartSeries[] = useMemo(
    () =>
      metricDefinitions
        .filter(
          (m) => m.key !== "actionsCompleted" && m.key !== "anonFormSubmissions"
        )
        .map((m) => ({
          key: m.key,
          label: m.label,
          color: m.color,
          getValue: (d: DataPoint) => (d[m.key] as number) ?? 0,
        })),
    []
  );

  // Series definitions for actions chart
  const actionsChartSeries: ChartSeries[] = useMemo(
    () =>
      metricDefinitions
        .filter(
          (m) => m.key === "actionsCompleted" || m.key === "anonFormSubmissions"
        )
        .map((m) => ({
          key: m.key,
          label: m.label,
          color: m.color,
          getValue: (d: DataPoint) => (d[m.key] as number) ?? 0,
        })),
    []
  );

  const chartActionStats = useMemo(
    () => actionStats.filter((a) => a.showInChart),
    [actionStats]
  );

  const actionBarsGeometry = useMemo(() => {
    if (chartActionStats.length === 0) {
      return null;
    }

    const width = 1000;
    const barHeight = 32;
    const gap = 8;
    const margin = { top: 28, right: 32, bottom: 32, left: 200 };
    const height =
      margin.top + margin.bottom + chartActionStats.length * (barHeight + gap);

    const maxCompleted = d3.max(chartActionStats, (d) => d.usersCompleted) ?? 0;
    const maxTotalExpected =
      d3.max(
        chartActionStats,
        (d) => d.usersJoined + (d.usersWithdrawn ?? 0)
      ) ?? 0;
    const maxValue = Math.max(maxCompleted, maxTotalExpected, 10);

    const xScale = d3
      .scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([margin.left, width - margin.right]);

    const xTicks = xScale.ticks(6);

    return {
      width,
      height,
      barHeight,
      gap,
      margin,
      xScale,
      xTicks,
      maxValue,
    };
  }, [chartActionStats]);

  const hoveredActionTooltipTop = useMemo(() => {
    if (!hoveredActionBar || !actionBarsGeometry) {
      return null;
    }
    const y =
      actionBarsGeometry.margin.top +
      hoveredActionBar.index *
      (actionBarsGeometry.barHeight + actionBarsGeometry.gap);
    const centerY = y + actionBarsGeometry.barHeight / 2;
    return (centerY / actionBarsGeometry.height) * 100;
  }, [hoveredActionBar, actionBarsGeometry]);

  // Cumulative average completion rate data
  const cumulativeCompletionData = useMemo(() => {
    // Filter actions that have ended (have memberActionEndDate)
    const completedActions = actionStats
      .filter((a) => a.memberActionEndDate && a.showInChart)
      .map((a) => ({
        ...a,
        endDate: new Date(a.memberActionEndDate!),
      }))
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

    if (completedActions.length === 0) return [];

    const rangeStart = new Date(completionRateRange.start);
    const rangeEnd = new Date(completionRateRange.end);

    // Generate data points for each day an action ended
    const dataPoints: { date: Date; avgRate: number; actionCount: number }[] =
      [];
    let runningSum = 0;
    let count = 0;

    for (const action of completedActions) {
      if (action.endDate < rangeStart) {
        // Include in running average but don't plot
        runningSum += action.completionRate;
        count++;
        continue;
      }
      if (action.endDate > rangeEnd) break;

      runningSum += action.completionRate;
      count++;
      dataPoints.push({
        date: action.endDate,
        avgRate: runningSum / count,
        actionCount: count,
      });
    }

    return dataPoints;
  }, [actionStats, completionRateRange]);

  const completionRateChartData: DataPoint[] = useMemo(() => {
    return cumulativeCompletionData.map((d) => ({
      date: d.date,
      avgRate: d.avgRate,
      actionCount: d.actionCount,
    }));
  }, [cumulativeCompletionData]);

  const completionRateYDomain = useMemo(() => {
    if (completionRateAbsolute) {
      return [0, 1] as [number, number];
    }
    const values = completionRateChartData
      .map((d) => d.avgRate)
      .filter((value): value is number => typeof value === "number")
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) {
      return undefined;
    }
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(0, maxValue - minValue);
    const padding = Math.max(0.01, range * 0.1);
    let paddedMin = Math.max(0, minValue - padding);
    let paddedMax = Math.min(1, maxValue + padding);
    if (paddedMax === paddedMin) {
      const bump = Math.min(0.05, Math.max(0.01, paddedMax * 0.1));
      paddedMin = Math.max(0, paddedMin - bump);
      paddedMax = Math.min(1, paddedMax + bump);
    }
    return [paddedMin, paddedMax] as [number, number];
  }, [completionRateAbsolute, completionRateChartData]);

  const completionRateSeries: ChartSeries[] = useMemo(
    () => [
      {
        key: "avgRate",
        label: "Avg Rate",
        color: "#16a34a",
        getValue: (d) => (d.avgRate as number) ?? 0,
      },
    ],
    []
  );

  const sortedRetentionCohorts = useMemo(() => {
    return retentionCohorts
      .map((cohort) => ({
        ...cohort,
        points: [...cohort.points].sort((a, b) => a.weekIndex - b.weekIndex),
      }))
      .sort(
        (a, b) =>
          new Date(a.cohortStart).getTime() - new Date(b.cohortStart).getTime()
      );
  }, [retentionCohorts]);

  const filteredRetentionCohorts = useMemo(() => {
    return sortedRetentionCohorts.filter((cohort) =>
      cohort.points.some((point) => point.completedCount > 0)
    );
  }, [sortedRetentionCohorts]);

  const retentionChartData = useMemo(() => {
    if (filteredRetentionCohorts.length === 0) {
      return { multiLineData: [], legendGradient: "", cohortMap: new Map() };
    }

    const cohortDates = filteredRetentionCohorts.map((cohort) =>
      new Date(cohort.cohortStart).getTime()
    );
    const minDate = d3.min(cohortDates) ?? Date.now();
    const maxDate = d3.max(cohortDates) ?? Date.now();
    const colorScale = chroma
      .scale(chroma.brewer.Spectral)
      .domain([maxDate, minDate]);

    const legendStopCount = 9;
    const legendStops = Array.from({ length: legendStopCount }, (_, index) => {
      const t = index / (legendStopCount - 1);
      const value = minDate + (maxDate - minDate) * t;
      return colorScale(value).hex();
    });
    const legendGradient = `linear-gradient(90deg, ${legendStops.join(", ")})`;

    const cohortMap = new Map<string, MemberCompletionRetentionCohortDto>();
    const multiLineData: MultiLineSeries[] = filteredRetentionCohorts.map(
      (cohort) => {
        cohortMap.set(cohort.cohortStart, cohort);
        return {
          key: cohort.cohortStart,
          label: `Week of ${fullDateFormatter.format(
            new Date(cohort.cohortStart)
          )}`,
          color: colorScale(new Date(cohort.cohortStart).getTime()).hex(),
          data: cohort.points.map((point) => ({
            x: point.weekIndex,
            weekIndex: point.weekIndex,
            completionRate: point.completionRate,
            completedCount: point.completedCount,
            joinedCount: point.joinedCount,
            cohortStart: cohort.cohortStart,
            cohortSize: cohort.cohortSize,
          })),
        };
      }
    );

    return { multiLineData, legendGradient, cohortMap };
  }, [filteredRetentionCohorts]);

  const churnDurationsWeeks = useMemo(() => {
    return timeToChurnSamples
      .map((sample) => sample.daysToChurn / 7)
      .filter((value) => Number.isFinite(value) && value >= 0);
  }, [timeToChurnSamples]);

  const churnHistogramGeometry = useMemo(() => {
    if (churnDurationsWeeks.length === 0) return null;

    const width = 1000;
    const height = 320;
    const margin = { top: 28, right: 24, bottom: 56, left: 64 };
    const maxWeeks = d3.max(churnDurationsWeeks) ?? 0;
    const xMax = Math.max(1, maxWeeks);

    const xScale = d3
      .scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([margin.left, width - margin.right]);

    const maxWeekLabel = Math.max(1, Math.ceil(xMax));
    const weeklyThresholds = d3.range(0, maxWeekLabel + 1, 1);

    const bins = d3
      .bin<number, number>()
      .domain(xScale.domain() as [number, number])
      .thresholds(weeklyThresholds)(churnDurationsWeeks);

    const trimmedBins = [...bins];
    while (
      trimmedBins.length > 1 &&
      trimmedBins[trimmedBins.length - 1].length === 0
    ) {
      trimmedBins.pop();
    }

    const maxCount = d3.max(trimmedBins, (bin) => bin.length) ?? 0;
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, maxCount)])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const xTicks = trimmedBins.map((bin) => {
      const x0 = bin.x0 ?? 0;
      const x1 = bin.x1 ?? x0 + 1;
      return {
        value: (x0 + x1) / 2,
        label: Math.round(x0),
      };
    });
    const yTicks = yScale.ticks(5);

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      xTicks,
      yTicks,
      bins: trimmedBins,
    };
  }, [churnDurationsWeeks]);

  const parsedContractStatusHistory = useMemo(() => {
    return contractStatusHistory.map((point) => ({
      ...point,
      parsedDate: new Date(point.date),
    }));
  }, [contractStatusHistory]);

  const contractStatusChartGeometry = useMemo(() => {
    if (parsedContractStatusHistory.length === 0) return null;

    const width = 1000;
    const height = 350;
    const margin = { top: 28, right: 32, bottom: 64, left: 72 };

    const dateExtent = d3.extent(
      parsedContractStatusHistory,
      (d) => d.parsedDate
    );
    if (!dateExtent[0] || !dateExtent[1]) return null;

    const xScale = d3
      .scaleTime()
      .domain(dateExtent)
      .range([margin.left, width - margin.right]);

    const maxTotal =
      d3.max(parsedContractStatusHistory, (d) => d.totalEverSigned) ?? 10;

    const yScale = d3
      .scaleLinear()
      .domain([0, maxTotal * 1.1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Area for active users (green, bottom)
    const activeArea = d3
      .area<(typeof parsedContractStatusHistory)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.activeCount))
      .curve(d3.curveMonotoneX);

    // Area for churned users (red, stacked on top of active)
    const churnedArea = d3
      .area<(typeof parsedContractStatusHistory)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0((d) => yScale(d.activeCount))
      .y1((d) => yScale(d.activeCount + d.churnedCount))
      .curve(d3.curveMonotoneX);

    const activeAreaPath = activeArea(parsedContractStatusHistory) ?? "";
    const churnedAreaPath = churnedArea(parsedContractStatusHistory) ?? "";

    const xTicks = xScale.ticks(8);
    const yTicks = yScale.ticks(6);

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      activeAreaPath,
      churnedAreaPath,
      xTicks,
      yTicks,
      maxTotal,
    };
  }, [parsedContractStatusHistory]);

  const handleApplyRange = useCallback(() => {
    setQueryRange({ start: startInput, end: endInput });
  }, [endInput, startInput]);

  const handleQuickRange = useCallback((days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const startValue = formatDateAsLocal(start);
    const endValue = formatDateAsLocal(end);
    setStartInput(startValue);
    setEndInput(endValue);
    setQueryRange({ start: startValue, end: endValue });
  }, []);

  const handleContractStatusHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (
        !contractStatusChartGeometry ||
        parsedContractStatusHistory.length === 0 ||
        !contractStatusSvgRef.current
      ) {
        return;
      }

      const rect = contractStatusSvgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      if (relativeX < 0) return;

      const scaleX = contractStatusChartGeometry.width / rect.width;
      const pointerX = relativeX * scaleX;

      const hoveredDate = contractStatusChartGeometry.xScale.invert(pointerX);

      // Find closest data point
      let closestPoint = parsedContractStatusHistory[0];
      let closestDistance = Math.abs(
        hoveredDate.getTime() - closestPoint.parsedDate.getTime()
      );

      for (const point of parsedContractStatusHistory) {
        const distance = Math.abs(
          hoveredDate.getTime() - point.parsedDate.getTime()
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = point;
        }
      }

      setHoveredContractPoint(closestPoint);
    },
    [contractStatusChartGeometry, parsedContractStatusHistory]
  );

  return (
    <div className="p-6 md:p-8 space-y-6 text-gray-900 mx-auto">
      {aggregateStatsLoading ? (
        <div className="text-sm text-gray-600">Loading aggregate stats…</div>
      ) : aggregateStats ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-6">
              <div className="flex flex-col">
                <div className="text-sm text-gray-600">Total members</div>
                <div className="text-3xl font-bold text-gray-900">
                  {aggregateStats.signedUsers}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-sm text-gray-600">
                  Completion reliability
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {cumulativeCompletionData.length > 0
                    ? (
                      cumulativeCompletionData[
                        cumulativeCompletionData.length - 1
                      ].avgRate * 100
                    ).toFixed(2)
                    : "[No data]"}
                  %
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-sm text-gray-600">Churn rate</div>
                <div className="text-3xl font-bold text-gray-900">
                  {parsedContractStatusHistory.length > 0
                    ? (() => {
                      const latest =
                        parsedContractStatusHistory[
                        parsedContractStatusHistory.length - 1
                        ];
                      return latest.totalEverSigned > 0
                        ? (
                          (latest.churnedCount / latest.totalEverSigned) *
                          100
                        ).toFixed(1)
                        : "0";
                    })()
                    : "[No data]"}
                  %
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">
                Total expected weekly member time
              </div>
              <div className="text-base font-semibold text-gray-900">
                {((aggregateStats.signedUsers * 15) / 60).toFixed(2)} hours /
                week
              </div>
            </div>
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">
                Annual expected value of member time (assuming{" "}
                <input
                  type="number"
                  value={assumedHourlyRate}
                  onChange={(e) => setAssumedHourlyRate(Number(e.target.value))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm bg-white w-16"
                />{" "}
                / hour)
              </div>
              <div className="text-base font-semibold text-gray-900">
                $
                {(
                  ((aggregateStats.signedUsers * 15) / 60) *
                  assumedHourlyRate *
                  52
                ).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">
              Start date
            </label>
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">
              End date
            </label>
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 opacity-0">
              Update
            </label>
            <button
              onClick={handleApplyRange}
              className="px-4 py-2 rounded-md text-sm bg-green text-white shadow hover:bg-green-500"
            >
              Update
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleQuickRange(7)}
            className="px-4 py-2 rounded-md text-sm border border-gray-300 bg-white hover:border-gray-400"
          >
            Last 7 days
          </button>
          <button
            onClick={() => handleQuickRange(30)}
            className="px-4 py-2 rounded-md text-sm border border-gray-300 bg-white hover:border-gray-400"
          >
            Last 30 days
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-gray-600">Loading daily stats…</p>}
      {!loading && parsedStats.length === 0 && (
        <p className="text-sm text-gray-600">No daily stats for this range.</p>
      )}

      {/* Members & Invites Chart */}
      <TimeSeriesChart
        title="Members & Invites"
        data={dailyStatsChartData}
        series={mainChartSeries}
        loading={loading}
        emptyMessage="No daily stats for this range."
        height={420}
        getHoverContent={(point) => ({
          title: fullDateFormatter.format(point.date!),
          items: mainChartSeries.map((s) => ({
            label: s.label,
            value: s.getValue(point),
            color: s.color,
          })),
        })}
      />

      {/* Actions & Public Responses Chart */}
      <TimeSeriesChart
        title="Actions & Public Responses"
        data={dailyStatsChartData}
        series={actionsChartSeries}
        loading={loading}
        emptyMessage="No daily stats for this range."
        height={420}
        showArea
        areaSeriesKey="actionsCompleted"
        getHoverContent={(point) => ({
          title: fullDateFormatter.format(point.date!),
          items: actionsChartSeries.map((s) => ({
            label: s.label,
            value: s.getValue(point),
            color: s.color,
          })),
        })}
      />

      {/* Action Stats Bar Chart */}
      <div className="relative overflow-visible rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Action Completion Stats
          </h3>
          <button
            onClick={handleRecalculateActionStats}
            disabled={actionStatsLoading}
            className="px-4 py-2 rounded-md text-sm bg-green text-white shadow hover:bg-green-500 disabled:opacity-50"
          >
            {actionStatsLoading ? "Calculating..." : "Recalculate"}
          </button>
        </div>
        <div className="relative p-4">
          {actionStatsLoading && actionStats.length === 0 && (
            <p className="text-sm text-gray-600">Loading action stats...</p>
          )}
          {!actionStatsLoading && actionStats.length === 0 && (
            <p className="text-sm text-gray-600">
              No action stats available. Click Recalculate to generate.
            </p>
          )}
          {actionBarsGeometry && chartActionStats.length > 0 && (
            <svg
              viewBox={`0 0 ${actionBarsGeometry.width} ${actionBarsGeometry.height}`}
              className="w-full"
            >
              {/* X axis grid lines */}
              <g>
                {actionBarsGeometry.xTicks.map((tick) => (
                  <g key={`x-${tick}`}>
                    <line
                      x1={actionBarsGeometry.xScale(tick)}
                      x2={actionBarsGeometry.xScale(tick)}
                      y1={actionBarsGeometry.margin.top}
                      y2={
                        actionBarsGeometry.height -
                        actionBarsGeometry.margin.bottom
                      }
                      stroke="#f3f4f6"
                    />
                    <text
                      x={actionBarsGeometry.xScale(tick)}
                      y={
                        actionBarsGeometry.height -
                        actionBarsGeometry.margin.bottom +
                        20
                      }
                      textAnchor="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {tick}
                    </text>
                  </g>
                ))}
              </g>

              {/* Bars */}
              {chartActionStats.map((action, idx) => {
                const y =
                  actionBarsGeometry.margin.top +
                  idx * (actionBarsGeometry.barHeight + actionBarsGeometry.gap);
                const usersWithdrawn = action.usersWithdrawn ?? 0;
                const totalExpected = action.usersJoined + usersWithdrawn;
                const expectedWidth =
                  actionBarsGeometry.xScale(totalExpected) -
                  actionBarsGeometry.margin.left;
                const completedWidth =
                  actionBarsGeometry.xScale(action.usersCompleted) -
                  actionBarsGeometry.margin.left;
                const withdrawnWidth =
                  actionBarsGeometry.xScale(usersWithdrawn) -
                  actionBarsGeometry.margin.left;
                const isHovered =
                  hoveredActionBar?.action.actionId === action.actionId;
                const displayRate =
                  totalExpected > 0
                    ? Math.round((action.usersCompleted / totalExpected) * 100)
                    : 0;

                return (
                  <g
                    key={action.actionId}
                    onMouseEnter={() =>
                      setHoveredActionBar({ action, index: idx })
                    }
                    onMouseLeave={() => setHoveredActionBar(null)}
                    className="cursor-pointer"
                  >
                    {/* Invisible hover target for the full row */}
                    <rect
                      x={0}
                      y={y - actionBarsGeometry.gap / 2}
                      width={actionBarsGeometry.width}
                      height={
                        actionBarsGeometry.barHeight + actionBarsGeometry.gap
                      }
                      fill="transparent"
                    />

                    {/* Action name */}
                    <text
                      x={actionBarsGeometry.margin.left - 8}
                      y={y + actionBarsGeometry.barHeight / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className={`text-xs ${isHovered
                          ? "fill-gray-900 font-semibold"
                          : "fill-gray-700"
                        }`}
                    >
                      {action.actionName.length > 25
                        ? action.actionName.substring(0, 22) + "..."
                        : action.actionName}
                    </text>

                    {/* Joined bar (background) */}
                    <rect
                      x={actionBarsGeometry.margin.left}
                      y={y}
                      width={Math.max(expectedWidth, 0)}
                      height={actionBarsGeometry.barHeight}
                      rx={4}
                      fill={isHovered ? "#d1d5db" : "#e5e7eb"}
                    />

                    {/* Completed bar (foreground) */}
                    {usersWithdrawn > 0 ? (
                      Math.max(completedWidth, 0) > 0 ? (
                        <path
                          d={buildRoundedLeftPath(
                            actionBarsGeometry.margin.left,
                            y,
                            Math.max(completedWidth, 0),
                            actionBarsGeometry.barHeight,
                            4
                          )}
                          fill={isHovered ? "#15803d" : "#16a34a"}
                        />
                      ) : null
                    ) : (
                      <rect
                        x={actionBarsGeometry.margin.left}
                        y={y}
                        width={Math.max(completedWidth, 0)}
                        height={actionBarsGeometry.barHeight}
                        rx={4}
                        fill={isHovered ? "#15803d" : "#16a34a"}
                      />
                    )}

                    {/* Withdrawn segment */}
                    {usersWithdrawn > 0 && withdrawnWidth > 0 && (
                      <path
                        d={buildRoundedRightPath(
                          actionBarsGeometry.margin.left + completedWidth,
                          y,
                          Math.max(withdrawnWidth, 0),
                          actionBarsGeometry.barHeight,
                          4
                        )}
                        fill={isHovered ? "#ea580c" : "#f97316"}
                      />
                    )}

                    {/* Completion rate label */}
                    <text
                      x={
                        actionBarsGeometry.margin.left +
                        Math.max(expectedWidth, completedWidth + withdrawnWidth) +
                        8
                      }
                      y={y + actionBarsGeometry.barHeight / 2}
                      dominantBaseline="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {action.usersCompleted}/{totalExpected}{" "}
                      {totalExpected > 0
                        ? `(${displayRate}%)`
                        : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Hover tooltip */}
          {hoveredActionBar && hoveredActionTooltipTop !== null && (
            <div
              className="absolute right-4 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[200px] pointer-events-none"
              style={{
                top: `calc(${hoveredActionTooltipTop}% - 8px)`,
                transform: "translateY(-100%)",
              }}
            >
              <p className="font-semibold text-gray-900 mb-2 max-w-[350px]">
                {hoveredActionBar.action.actionName}
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-medium text-green-600">
                    {hoveredActionBar.action.usersCompleted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Withdrawn:</span>
                  <span className="font-medium text-orange-600">
                    {hoveredActionBar.action.usersWithdrawn ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Joined:</span>
                  <span className="font-medium text-gray-700">
                    {hoveredActionBar.action.usersJoined}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-gray-600">Rate:</span>
                  <span className="font-semibold text-gray-900">
                    {hoveredActionBar.action.usersJoined +
                      (hoveredActionBar.action.usersWithdrawn ?? 0) >
                      0
                      ? `${Math.round(
                        (hoveredActionBar.action.usersCompleted /
                          (hoveredActionBar.action.usersJoined +
                            (hoveredActionBar.action.usersWithdrawn ?? 0))) *
                        100
                      )}%`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-600" />
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span className="text-sm text-gray-600">Withdrawn</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-300" />
            <span className="text-sm text-gray-600">Expected total</span>
          </div>
        </div>
      </div>

      {/* Cumulative Average Completion Rate Chart */}
      <TimeSeriesChart
        title="Cumulative Completion Rate"
        data={completionRateChartData}
        series={completionRateSeries}
        loading={actionStatsLoading}
        emptyMessage="No completed actions in this date range."
        showArea
        areaSeriesKey="avgRate"
        areaColor="rgba(22, 163, 74, 0.12)"
        yDomain={completionRateYDomain}
        yAxisFormat={(v) => `${Math.round(v * 100)}%`}
        showHoverOnlyOnHover
        yTickLabelDedup
        dateRange={completionRateRange}
        onDateRangeChange={setCompletionRateRange}
        headerContent={
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 md:ml-auto">
            <input
              type="checkbox"
              checked={completionRateAbsolute}
              onChange={(event) =>
                setCompletionRateAbsolute(event.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
            />
            Absolute
          </label>
        }
        getHoverContent={(point) => ({
          title: fullDateFormatter.format(point.date),
          items: [
            {
              label: "Avg Rate",
              value: `${((point.avgRate as number) * 100).toFixed(2)}%`,
              color: "#16a34a",
            },
            {
              label: "Actions",
              value: point.actionCount as number,
            },
          ],
        })}
      />

      {/* Cohort Completion Retention Chart */}
      <TimeSeriesChart
        title="Cohort Completion Reliability"
        xType="number"
        loading={retentionLoading}
        emptyMessage="No cohorts have completions yet."
        multiLineData={retentionChartData.multiLineData}
        getXValue={(d) => (d.weekIndex as number) ?? 0}
        getYValue={(d) => (d.completionRate as number) ?? 0}
        xAxisFormat={(v) => `${Math.round(v)}w`}
        xAxisLabel="Week"
        xRange={weekRange}
        onXRangeChange={setWeekRange}
        yDomain={[0, 1]}
        yAxisFormat={(v) => `${Math.round(v * 100)}%`}
        height={360}
        legendGradient={retentionChartData.legendGradient}
        legendLabels={{ left: "Older", right: "Newer" }}
        getHoverContent={(point) => ({
          title: `Week of ${fullDateFormatter.format(
            new Date(`${point.cohortStart}T00:00:00Z`)
          )}`,
          items: [
            { label: "Weeks since join", value: point.weekIndex as number },
            {
              label: "Completion rate",
              value: `${Math.round((point.completionRate as number) * 100)}%`,
            },
            {
              label: "Completed",
              value: point.completedCount as number,
              color: "#16a34a",
            },
            { label: "Joined", value: point.joinedCount as number },
            { label: "Cohort size", value: point.cohortSize as number },
          ],
        })}
      />

      {/* Contract Status History Chart */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 p-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Signed member retention
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">
                From
              </label>
              <input
                type="date"
                value={contractStatusRange.start}
                onChange={(e) =>
                  setContractStatusRange((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">To</label>
              <input
                type="date"
                value={contractStatusRange.end}
                onChange={(e) =>
                  setContractStatusRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
          </div>
        </div>
        <div className="relative p-4 pb-0">
          {contractStatusLoading &&
            parsedContractStatusHistory.length === 0 && (
              <p className="text-sm text-gray-600">Loading...</p>
            )}
          {!contractStatusLoading &&
            parsedContractStatusHistory.length === 0 && (
              <p className="text-sm text-gray-600">
                No contract status data in this date range.
              </p>
            )}
          {contractStatusChartGeometry &&
            parsedContractStatusHistory.length > 0 && (
              <svg
                ref={contractStatusSvgRef}
                viewBox={`0 0 ${contractStatusChartGeometry.width} ${contractStatusChartGeometry.height}`}
                className="w-full"
                onMouseMove={handleContractStatusHover}
                onMouseLeave={() => setHoveredContractPoint(null)}
              >
                {/* Grid lines */}
                <g>
                  {contractStatusChartGeometry.yTicks.map((tick) => (
                    <g key={`contract-y-${tick}`}>
                      <line
                        x1={contractStatusChartGeometry.margin.left}
                        x2={
                          contractStatusChartGeometry.width -
                          contractStatusChartGeometry.margin.right
                        }
                        y1={contractStatusChartGeometry.yScale(tick)}
                        y2={contractStatusChartGeometry.yScale(tick)}
                        stroke="#e5e7eb"
                        strokeDasharray="4 6"
                      />
                      <text
                        x={contractStatusChartGeometry.margin.left - 12}
                        y={contractStatusChartGeometry.yScale(tick)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="fill-gray-500 text-xs"
                      >
                        {tick}
                      </text>
                    </g>
                  ))}
                  {contractStatusChartGeometry.xTicks.map((tick) => (
                    <g key={`contract-x-${tick.toISOString()}`}>
                      <line
                        x1={contractStatusChartGeometry.xScale(tick)}
                        x2={contractStatusChartGeometry.xScale(tick)}
                        y1={contractStatusChartGeometry.margin.top}
                        y2={
                          contractStatusChartGeometry.height -
                          contractStatusChartGeometry.margin.bottom
                        }
                        stroke="#f3f4f6"
                      />
                      <text
                        x={contractStatusChartGeometry.xScale(tick)}
                        y={
                          contractStatusChartGeometry.height -
                          contractStatusChartGeometry.margin.bottom +
                          24
                        }
                        textAnchor="middle"
                        className="fill-gray-600 text-xs"
                      >
                        {dateFormatter.format(tick)}
                      </text>
                    </g>
                  ))}
                </g>

                {/* Churned area (red, on top) */}
                <path
                  d={contractStatusChartGeometry.churnedAreaPath}
                  fill="rgba(239, 68, 68, 0.9)"
                  stroke="none"
                />

                {/* Active area (green, bottom) */}
                <path
                  d={contractStatusChartGeometry.activeAreaPath}
                  fill="rgba(22, 163, 74, 0.8)"
                  stroke="none"
                />

                {/* Hover indicator */}
                {hoveredContractPoint && (
                  <>
                    <line
                      x1={contractStatusChartGeometry.xScale(
                        hoveredContractPoint.parsedDate
                      )}
                      x2={contractStatusChartGeometry.xScale(
                        hoveredContractPoint.parsedDate
                      )}
                      y1={contractStatusChartGeometry.margin.top}
                      y2={
                        contractStatusChartGeometry.height -
                        contractStatusChartGeometry.margin.bottom
                      }
                      stroke="#6b7280"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />

                    {/* Small hover box */}
                    <rect
                      x={Math.min(
                        contractStatusChartGeometry.xScale(
                          hoveredContractPoint.parsedDate
                        ) + 12,
                        contractStatusChartGeometry.width - 100
                      )}
                      y={contractStatusChartGeometry.margin.top + 12}
                      width={88}
                      height={32}
                      rx={6}
                      fill="white"
                      stroke="#e5e7eb"
                    />
                    <text
                      x={Math.min(
                        contractStatusChartGeometry.xScale(
                          hoveredContractPoint.parsedDate
                        ) + 24,
                        contractStatusChartGeometry.width - 88
                      )}
                      y={contractStatusChartGeometry.margin.top + 33}
                      className="fill-black text-sm font-semibold"
                    >
                      {hoveredContractPoint.totalEverSigned > 0
                        ? `${Math.round(
                          (hoveredContractPoint.churnedCount /
                            hoveredContractPoint.totalEverSigned) *
                          100
                        )}% churn`
                        : "0% churn"}
                    </text>
                  </>
                )}
              </svg>
            )}
        </div>
        <div className="flex items-center gap-6 px-4 pb-4 -mt-4">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: "rgba(22, 163, 74, 0.8)" }}
            />
            <span className="text-sm text-gray-600">Active Members</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.9)" }}
            />
            <span className="text-sm text-gray-600">Churned Members</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900">
              Time to churn
            </h3>
            <span className="text-xs text-gray-500">
              From signing to last completed action
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {timeToChurnSamples.length > 0
              ? `${timeToChurnSamples.length} churned members`
              : "No churned members yet"}
          </div>
        </div>
        <div className="relative p-4 pb-2">
          {timeToChurnLoading && churnDurationsWeeks.length === 0 && (
            <p className="text-sm text-gray-600">Loading time to churn...</p>
          )}
          {!timeToChurnLoading && churnDurationsWeeks.length === 0 && (
            <p className="text-sm text-gray-600">No churned members yet.</p>
          )}
          {churnHistogramGeometry && churnDurationsWeeks.length > 0 && (
            <svg
              viewBox={`0 0 ${churnHistogramGeometry.width} ${churnHistogramGeometry.height}`}
              className="w-full"
            >
              {/* Grid lines */}
              <g>
                {churnHistogramGeometry.yTicks.map((tick) => (
                  <g key={`churn-y-${tick}`}>
                    <line
                      x1={churnHistogramGeometry.margin.left}
                      x2={
                        churnHistogramGeometry.width -
                        churnHistogramGeometry.margin.right
                      }
                      y1={churnHistogramGeometry.yScale(tick)}
                      y2={churnHistogramGeometry.yScale(tick)}
                      stroke="#e5e7eb"
                      strokeDasharray="4 6"
                    />
                    <text
                      x={churnHistogramGeometry.margin.left - 10}
                      y={churnHistogramGeometry.yScale(tick)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-gray-500 text-xs"
                    >
                      {tick}
                    </text>
                  </g>
                ))}
                {churnHistogramGeometry.xTicks.map((tick) => (
                  <g key={`churn-x-${tick.label}`}>
                    <line
                      x1={churnHistogramGeometry.xScale(tick.value)}
                      x2={churnHistogramGeometry.xScale(tick.value)}
                      y1={churnHistogramGeometry.margin.top}
                      y2={
                        churnHistogramGeometry.height -
                        churnHistogramGeometry.margin.bottom
                      }
                      stroke="#f3f4f6"
                    />
                    <text
                      x={churnHistogramGeometry.xScale(tick.value)}
                      y={
                        churnHistogramGeometry.height -
                        churnHistogramGeometry.margin.bottom +
                        24
                      }
                      textAnchor="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Bars */}
              {churnHistogramGeometry.bins.map((bin, index) => {
                const x0 = bin.x0 ?? 0;
                const x1 = bin.x1 ?? x0;
                const barWidth = Math.max(
                  0,
                  churnHistogramGeometry.xScale(x1) -
                  churnHistogramGeometry.xScale(x0) -
                  2
                );
                const barHeight =
                  churnHistogramGeometry.yScale(0) -
                  churnHistogramGeometry.yScale(bin.length);
                const x = churnHistogramGeometry.xScale(x0) + 1;
                const y = churnHistogramGeometry.yScale(bin.length);
                const labelStart = Math.round(x0);
                const labelEnd = Math.round(x1);

                return (
                  <g key={`churn-bin-${index}`}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill="rgba(239, 68, 68, 0.75)"
                      rx={4}
                    >
                      <title>{`${labelStart}-${labelEnd}w: ${bin.length} members`}</title>
                    </rect>
                  </g>
                );
              })}

              <text
                x={
                  (churnHistogramGeometry.width -
                    churnHistogramGeometry.margin.left -
                    churnHistogramGeometry.margin.right) /
                  2 +
                  churnHistogramGeometry.margin.left
                }
                y={churnHistogramGeometry.height - 12}
                textAnchor="middle"
                className="fill-gray-500 text-xs"
              >
                Weeks since signing
              </text>
            </svg>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden min-w-[1000px]">
        <button
          onClick={() => setDailyStatsTableOpen(!dailyStatsTableOpen)}
          className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <span className="font-semibold text-gray-900">
            Daily Stats ({parsedStats.length} days)
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${dailyStatsTableOpen ? "rotate-180" : ""
              }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {dailyStatsTableOpen && (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-600">
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Actions completed
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Anon forms
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Members signed
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Invites created
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Invites accepted
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Suspended
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {[...parsedStats].reverse().map((day) => (
                  <tr
                    key={day.dayId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {fullDateFormatter.format(day.parsedDate)}
                    </td>
                    <td className="px-4 py-3">{day.actionsCompleted}</td>
                    <td className="px-4 py-3">{day.anonFormSubmissions}</td>
                    <td className="px-4 py-3">{day.signedMembers}</td>
                    <td className="px-4 py-3">{day.invitesCreated}</td>
                    <td className="px-4 py-3">{day.invitesAccepted}</td>
                    <td className="px-4 py-3">{day.suspendedMembers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionStats.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden min-w-[800px]">
          <button
            onClick={() => setActionStatsTableOpen(!actionStatsTableOpen)}
            className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <span className="font-semibold text-gray-900">
              Action Stats ({actionStats.length} actions)
            </span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${actionStatsTableOpen ? "rotate-180" : ""
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {actionStatsTableOpen && (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-gray-600">
                    <th className="px-4 py-3 text-left font-semibold">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Completed
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Completion Rate
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Action Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {actionStats.map((action) => (
                    <tr
                      key={action.actionId}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {action.actionName}
                      </td>
                      <td className="px-4 py-3 text-green-600 font-medium">
                        {action.usersCompleted}
                      </td>
                      <td className="px-4 py-3">{action.usersJoined}</td>
                      <td className="px-4 py-3">
                        {action.usersJoined > 0 ? (
                          <span
                            className={
                              action.completionRate >= 0.9
                                ? "text-green-600 font-medium"
                                : action.completionRate >= 0.7
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }
                          >
                            {Math.round(action.completionRate * 100)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {action.memberActionStartDate
                          ? new Date(
                            action.memberActionStartDate
                          ).toLocaleDateString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsPage;

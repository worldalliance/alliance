import {
  analyticsGetDailyStats,
  analyticsGetActionStats,
  analyticsRecalculateActionStats,
  analyticsGetMemberCompletionRetention,
  analyticsGetAggregateStats,
} from "@alliance/shared/client";
import {
  DailyStatsRecord,
  ActionStatsRecord,
  MemberCompletionRetentionCohortDto,
  MemberCompletionRetentionPointDto,
  AggregateStatsDto,
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
  const [actionStats, setActionStats] = useState<ActionStatsRecord[]>([]);
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
  const [hoveredDay, setHoveredDay] = useState<ParsedDailyStats | null>(null);
  const [hoveredActionsDay, setHoveredActionsDay] =
    useState<ParsedDailyStats | null>(null);
  const [hoveredActionBar, setHoveredActionBar] =
    useState<ActionStatsRecord | null>(null);
  const [dailyStatsTableOpen, setDailyStatsTableOpen] = useState(false);
  const [actionStatsTableOpen, setActionStatsTableOpen] = useState(false);
  const [hoveredCompletionPoint, setHoveredCompletionPoint] = useState<{
    date: Date;
    avgRate: number;
    actionCount: number;
  } | null>(null);
  const [hoveredRetentionPoint, setHoveredRetentionPoint] = useState<{
    cohort: MemberCompletionRetentionCohortDto;
    point: MemberCompletionRetentionPointDto;
    color: string;
  } | null>(null);
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

  const svgRef = useRef<SVGSVGElement | null>(null);
  const completionRateSvgRef = useRef<SVGSVGElement | null>(null);
  const actionsSvgRef = useRef<SVGSVGElement | null>(null);

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
      console.log("response", response);
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

  const parsedStats = useMemo<ParsedDailyStats[]>(() => {
    return stats
      .map((record) => ({
        ...record,
        parsedDate: new Date(record.date),
      }))
      .filter((record) => !Number.isNaN(record.parsedDate.getTime()));
  }, [stats]);

  useEffect(() => {
    if (parsedStats.length === 0) {
      setHoveredDay(null);
      setHoveredActionsDay(null);
      return;
    }
    setHoveredDay(parsedStats[parsedStats.length - 1]);
    setHoveredActionsDay(parsedStats[parsedStats.length - 1]);
  }, [parsedStats]);

  const createChartGeometry = useCallback(
    (metrics: MetricDefinition[], includeArea: boolean = false) => {
      if (parsedStats.length === 0) {
        return null;
      }

      const width = 1000;
      const height = 420;
      const margin = { top: 28, right: 32, bottom: 64, left: 72 };

      const dateExtent = d3.extent(parsedStats, (d) => d.parsedDate);
      if (!dateExtent[0] || !dateExtent[1]) {
        return null;
      }

      const xScale = d3
        .scaleTime()
        .domain(dateExtent)
        .range([margin.left, width - margin.right]);

      const maxMetricValue =
        d3.max(metrics, (metric) =>
          d3.max(parsedStats, (d) => d[metric.key] ?? 0)
        ) ?? 0;

      const yScale = d3
        .scaleLinear()
        .domain([0, Math.max(maxMetricValue * 1.1, 10)])
        .nice()
        .range([height - margin.bottom, margin.top]);

      const line = d3
        .line<{ parsedDate: Date; value: number }>()
        .x((d) => xScale(d.parsedDate))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      const lines = metrics.map((metric) => {
        const values = parsedStats.map((record) => ({
          parsedDate: record.parsedDate,
          value: record[metric.key] ?? 0,
        }));

        return {
          metric,
          path: line(values) ?? "",
        };
      });

      const xTicks = xScale.ticks(Math.min(8, parsedStats.length));
      const yTicks = yScale.ticks(6);

      const bisectDate = d3.bisector<ParsedDailyStats, Date>(
        (d) => d.parsedDate
      ).center;

      let areaPath = "";
      if (includeArea && metrics.length > 0) {
        const area = d3
          .area<ParsedDailyStats>()
          .x((d) => xScale(d.parsedDate))
          .y0(height - margin.bottom)
          .y1((d) => yScale(d[metrics[0].key] ?? 0))
          .curve(d3.curveMonotoneX);
        areaPath = area(parsedStats) ?? "";
      }

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
        metrics,
      };
    },
    [parsedStats]
  );

  const mainMetrics = useMemo(
    () =>
      metricDefinitions.filter(
        (m) => m.key !== "actionsCompleted" && m.key !== "anonFormSubmissions"
      ),
    []
  );
  const actionsMetric = useMemo(
    () =>
      metricDefinitions.filter(
        (m) => m.key === "actionsCompleted" || m.key === "anonFormSubmissions"
      ),
    []
  );

  const mainChartGeometry = useMemo(
    () => createChartGeometry(mainMetrics, false),
    [createChartGeometry, mainMetrics]
  );

  const actionsChartGeometry = useMemo(
    () => createChartGeometry(actionsMetric, true),
    [createChartGeometry, actionsMetric]
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
    const maxJoined = d3.max(chartActionStats, (d) => d.usersJoined) ?? 0;
    const maxValue = Math.max(maxCompleted, maxJoined, 10);

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

  const completionRateChartGeometry = useMemo(() => {
    if (cumulativeCompletionData.length === 0) return null;

    const width = 1000;
    const height = 350;
    const margin = { top: 28, right: 32, bottom: 64, left: 72 };

    const rangeStart = new Date(completionRateRange.start);
    const rangeEnd = new Date(completionRateRange.end);

    const xScale = d3
      .scaleTime()
      .domain([rangeStart, rangeEnd])
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<{ date: Date; avgRate: number }>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.avgRate))
      .curve(d3.curveMonotoneX);

    const linePath = line(cumulativeCompletionData) ?? "";

    const area = d3
      .area<{ date: Date; avgRate: number }>()
      .x((d) => xScale(d.date))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.avgRate))
      .curve(d3.curveMonotoneX);

    const areaPath = area(cumulativeCompletionData) ?? "";

    const xTicks = xScale.ticks(8);
    const yTicks = [0, 0.25, 0.5, 0.75, 1];

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      linePath,
      areaPath,
      xTicks,
      yTicks,
    };
  }, [cumulativeCompletionData, completionRateRange]);

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

  const retentionChartGeometry = useMemo(() => {
    if (filteredRetentionCohorts.length === 0) return null;

    const width = 1000;
    const height = 360;
    const margin = { top: 28, right: 32, bottom: 64, left: 72 };

    const maxWeekIndex =
      d3.max(filteredRetentionCohorts, (cohort) =>
        d3.max(cohort.points, (point) => point.weekIndex)
      ) ?? 0;
    const maxWeek = Math.max(maxWeekIndex, 1);

    const xScale = d3
      .scaleLinear()
      .domain([0, maxWeek])
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<MemberCompletionRetentionPointDto>()
      .x((d) => xScale(d.weekIndex))
      .y((d) => yScale(d.completionRate))
      .curve(d3.curveMonotoneX);

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

    const lines = filteredRetentionCohorts.map((cohort) => ({
      cohort,
      color: colorScale(new Date(cohort.cohortStart).getTime()).hex(),
      path: line(cohort.points) ?? "",
    }));

    const xTicks = xScale.ticks(Math.min(8, maxWeek + 1));
    const yTicks = [0, 0.25, 0.5, 0.75, 1];

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      xTicks,
      yTicks,
      lines,
      legendGradient,
    };
  }, [filteredRetentionCohorts]);

  const activeDay = hoveredDay ?? parsedStats[parsedStats.length - 1];
  const activeActionsDay =
    hoveredActionsDay ?? parsedStats[parsedStats.length - 1];

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

  const handleHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (!mainChartGeometry || parsedStats.length === 0 || !svgRef.current) {
        return;
      }

      const rect = svgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const relativeY = event.clientY - rect.top;
      if (relativeX < 0 || relativeY < 0) {
        return;
      }

      const scaleX = mainChartGeometry.width / rect.width;
      const pointerX = relativeX * scaleX;

      const hoveredDate = mainChartGeometry.xScale.invert(pointerX);
      const index = mainChartGeometry.bisectDate(parsedStats, hoveredDate);
      const clampedIndex = Math.max(0, Math.min(parsedStats.length - 1, index));

      setHoveredDay(parsedStats[clampedIndex]);
    },
    [mainChartGeometry, parsedStats]
  );

  const handleActionsHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (
        !actionsChartGeometry ||
        parsedStats.length === 0 ||
        !actionsSvgRef.current
      ) {
        return;
      }

      const rect = actionsSvgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const relativeY = event.clientY - rect.top;
      if (relativeX < 0 || relativeY < 0) {
        return;
      }

      const scaleX = actionsChartGeometry.width / rect.width;
      const pointerX = relativeX * scaleX;

      const hoveredDate = actionsChartGeometry.xScale.invert(pointerX);
      const index = actionsChartGeometry.bisectDate(parsedStats, hoveredDate);
      const clampedIndex = Math.max(0, Math.min(parsedStats.length - 1, index));

      setHoveredActionsDay(parsedStats[clampedIndex]);
    },
    [actionsChartGeometry, parsedStats]
  );

  const handleCompletionRateHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (
        !completionRateChartGeometry ||
        cumulativeCompletionData.length === 0 ||
        !completionRateSvgRef.current
      ) {
        return;
      }

      const rect = completionRateSvgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      if (relativeX < 0) return;

      const scaleX = completionRateChartGeometry.width / rect.width;
      const pointerX = relativeX * scaleX;

      const hoveredDate = completionRateChartGeometry.xScale.invert(pointerX);

      // Find closest data point
      let closestPoint = cumulativeCompletionData[0];
      let closestDistance = Math.abs(
        hoveredDate.getTime() - closestPoint.date.getTime()
      );

      for (const point of cumulativeCompletionData) {
        const distance = Math.abs(hoveredDate.getTime() - point.date.getTime());
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = point;
        }
      }

      setHoveredCompletionPoint(closestPoint);
    },
    [completionRateChartGeometry, cumulativeCompletionData]
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
      {!loading && parsedStats.length > 0 && mainChartGeometry && (
        <>
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="relative p-4">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${mainChartGeometry.width} ${mainChartGeometry.height}`}
                onMouseMove={handleHover}
                onMouseLeave={() =>
                  setHoveredDay(parsedStats[parsedStats.length - 1])
                }
              >
                <g>
                  {mainChartGeometry.yTicks.map((tick) => (
                    <g key={`y-${tick}`}>
                      <line
                        x1={mainChartGeometry.margin.left}
                        x2={
                          mainChartGeometry.width -
                          mainChartGeometry.margin.right
                        }
                        y1={mainChartGeometry.yScale(tick)}
                        y2={mainChartGeometry.yScale(tick)}
                        stroke="#e5e7eb"
                        strokeDasharray="4 6"
                      />
                      <text
                        x={mainChartGeometry.margin.left - 12}
                        y={mainChartGeometry.yScale(tick)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="fill-gray-500 text-xs"
                      >
                        {tick}
                      </text>
                    </g>
                  ))}
                  {mainChartGeometry.xTicks.map((tick) => (
                    <g key={`x-${tick.toISOString()}`}>
                      <line
                        x1={mainChartGeometry.xScale(tick)}
                        x2={mainChartGeometry.xScale(tick)}
                        y1={mainChartGeometry.margin.top}
                        y2={
                          mainChartGeometry.height -
                          mainChartGeometry.margin.bottom
                        }
                        stroke="#f3f4f6"
                      />
                      <text
                        x={mainChartGeometry.xScale(tick)}
                        y={
                          mainChartGeometry.height -
                          mainChartGeometry.margin.bottom +
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
                {mainChartGeometry.lines.map(({ metric, path }) => (
                  <path
                    key={metric.key}
                    d={path}
                    fill="none"
                    stroke={metric.color}
                    strokeWidth={2.4}
                  />
                ))}
                {activeDay && (
                  <>
                    <line
                      x1={mainChartGeometry.xScale(activeDay.parsedDate)}
                      x2={mainChartGeometry.xScale(activeDay.parsedDate)}
                      y1={mainChartGeometry.margin.top}
                      y2={
                        mainChartGeometry.height -
                        mainChartGeometry.margin.bottom
                      }
                      stroke="#6b7280"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    {mainChartGeometry.metrics.map((metric) => (
                      <circle
                        key={`point-${metric.key}`}
                        cx={mainChartGeometry.xScale(activeDay.parsedDate)}
                        cy={mainChartGeometry.yScale(
                          activeDay[metric.key] ?? 0
                        )}
                        r={4}
                        fill="white"
                        stroke={metric.color}
                        strokeWidth={2}
                      />
                    ))}
                    <rect
                      x={Math.min(
                        mainChartGeometry.xScale(activeDay.parsedDate) + 12,
                        mainChartGeometry.width - 210
                      )}
                      y={mainChartGeometry.margin.top + 12}
                      width={196}
                      height={mainChartGeometry.metrics.length * 24 + 42}
                      rx={10}
                      fill="white"
                      stroke="#e5e7eb"
                      className="shadow-lg"
                    />
                    <text
                      x={Math.min(
                        mainChartGeometry.xScale(activeDay.parsedDate) + 24,
                        mainChartGeometry.width - 196
                      )}
                      y={mainChartGeometry.margin.top + 32}
                      className="fill-gray-900 text-sm font-semibold"
                    >
                      {fullDateFormatter.format(activeDay.parsedDate)}
                    </text>
                    {mainChartGeometry.metrics.map((metric, idx) => (
                      <g
                        key={`label-${metric.key}`}
                        transform={`translate(${Math.min(
                          mainChartGeometry.xScale(activeDay.parsedDate) + 24,
                          mainChartGeometry.width - 196
                        )}, ${mainChartGeometry.margin.top + 52 + idx * 24})`}
                      >
                        <rect
                          x={0}
                          y={-10}
                          width={12}
                          height={12}
                          rx={3}
                          fill={metric.color}
                        />
                        <text x={16} y={0} className="fill-gray-700 text-xs">
                          {metric.label}
                        </text>
                        <text
                          x={164}
                          y={0}
                          textAnchor="end"
                          className="fill-gray-900 text-xs font-semibold"
                        >
                          {activeDay[metric.key] ?? 0}
                        </text>
                      </g>
                    ))}
                  </>
                )}
              </svg>
            </div>
          </div>
          {actionsChartGeometry && (
            <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative p-4">
                <svg
                  ref={actionsSvgRef}
                  viewBox={`0 0 ${actionsChartGeometry.width} ${actionsChartGeometry.height}`}
                  className="w-full"
                  onMouseMove={handleActionsHover}
                  onMouseLeave={() =>
                    setHoveredActionsDay(parsedStats[parsedStats.length - 1])
                  }
                >
                  <g>
                    {actionsChartGeometry.yTicks.map((tick) => (
                      <g key={`y-${tick}`}>
                        <line
                          x1={actionsChartGeometry.margin.left}
                          x2={
                            actionsChartGeometry.width -
                            actionsChartGeometry.margin.right
                          }
                          y1={actionsChartGeometry.yScale(tick)}
                          y2={actionsChartGeometry.yScale(tick)}
                          stroke="#e5e7eb"
                          strokeDasharray="4 6"
                        />
                        <text
                          x={actionsChartGeometry.margin.left - 12}
                          y={actionsChartGeometry.yScale(tick)}
                          textAnchor="end"
                          dominantBaseline="middle"
                          className="fill-gray-500 text-xs"
                        >
                          {tick}
                        </text>
                      </g>
                    ))}
                    {actionsChartGeometry.xTicks.map((tick) => (
                      <g key={`x-${tick.toISOString()}`}>
                        <line
                          x1={actionsChartGeometry.xScale(tick)}
                          x2={actionsChartGeometry.xScale(tick)}
                          y1={actionsChartGeometry.margin.top}
                          y2={
                            actionsChartGeometry.height -
                            actionsChartGeometry.margin.bottom
                          }
                          stroke="#f3f4f6"
                        />
                        <text
                          x={actionsChartGeometry.xScale(tick)}
                          y={
                            actionsChartGeometry.height -
                            actionsChartGeometry.margin.bottom +
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
                  <path
                    d={actionsChartGeometry.areaPath}
                    fill="rgba(8,145,178,0.12)"
                    stroke="none"
                  />
                  {actionsChartGeometry.lines.map(({ metric, path }) => (
                    <path
                      key={metric.key}
                      d={path}
                      fill="none"
                      stroke={metric.color}
                      strokeWidth={2.4}
                    />
                  ))}
                  {activeActionsDay && (
                    <>
                      <line
                        x1={actionsChartGeometry.xScale(
                          activeActionsDay.parsedDate
                        )}
                        x2={actionsChartGeometry.xScale(
                          activeActionsDay.parsedDate
                        )}
                        y1={actionsChartGeometry.margin.top}
                        y2={
                          actionsChartGeometry.height -
                          actionsChartGeometry.margin.bottom
                        }
                        stroke="#6b7280"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      {actionsChartGeometry.metrics.map((metric) => (
                        <circle
                          key={`point-actions-${metric.key}`}
                          cx={actionsChartGeometry.xScale(
                            activeActionsDay.parsedDate
                          )}
                          cy={actionsChartGeometry.yScale(
                            activeActionsDay[metric.key] ?? 0
                          )}
                          r={4}
                          fill="white"
                          stroke={metric.color}
                          strokeWidth={2}
                        />
                      ))}
                      <rect
                        x={Math.min(
                          actionsChartGeometry.xScale(
                            activeActionsDay.parsedDate
                          ) + 12,
                          actionsChartGeometry.width - 210
                        )}
                        y={actionsChartGeometry.margin.top + 12}
                        width={196}
                        height={actionsChartGeometry.metrics.length * 24 + 42}
                        rx={10}
                        fill="white"
                        stroke="#e5e7eb"
                        className="shadow-lg"
                      />
                      <text
                        x={Math.min(
                          actionsChartGeometry.xScale(
                            activeActionsDay.parsedDate
                          ) + 24,
                          actionsChartGeometry.width - 196
                        )}
                        y={actionsChartGeometry.margin.top + 32}
                        className="fill-gray-900 text-sm font-semibold"
                      >
                        {fullDateFormatter.format(activeActionsDay.parsedDate)}
                      </text>
                      {actionsChartGeometry.metrics.map((metric, idx) => (
                        <g
                          key={`label-actions-${metric.key}`}
                          transform={`translate(${Math.min(
                            actionsChartGeometry.xScale(
                              activeActionsDay.parsedDate
                            ) + 24,
                            actionsChartGeometry.width - 196
                          )}, ${
                            actionsChartGeometry.margin.top + 52 + idx * 24
                          })`}
                        >
                          <rect
                            x={0}
                            y={-10}
                            width={12}
                            height={12}
                            rx={3}
                            fill={metric.color}
                          />
                          <text x={16} y={0} className="fill-gray-700 text-xs">
                            {metric.label}
                          </text>
                          <text
                            x={164}
                            y={0}
                            textAnchor="end"
                            className="fill-gray-900 text-xs font-semibold"
                          >
                            {activeActionsDay[metric.key] ?? 0}
                          </text>
                        </g>
                      ))}
                    </>
                  )}
                </svg>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Stats Bar Chart */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
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
                const joinedWidth =
                  actionBarsGeometry.xScale(action.usersJoined) -
                  actionBarsGeometry.margin.left;
                const completedWidth =
                  actionBarsGeometry.xScale(action.usersCompleted) -
                  actionBarsGeometry.margin.left;
                const isHovered =
                  hoveredActionBar?.actionId === action.actionId;

                return (
                  <g
                    key={action.actionId}
                    onMouseEnter={() => setHoveredActionBar(action)}
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
                      className={`text-xs ${
                        isHovered
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
                      width={Math.max(joinedWidth, 0)}
                      height={actionBarsGeometry.barHeight}
                      rx={4}
                      fill={isHovered ? "#d1d5db" : "#e5e7eb"}
                    />

                    {/* Completed bar (foreground) */}
                    <rect
                      x={actionBarsGeometry.margin.left}
                      y={y}
                      width={Math.max(completedWidth, 0)}
                      height={actionBarsGeometry.barHeight}
                      rx={4}
                      fill={isHovered ? "#15803d" : "#16a34a"}
                    />

                    {/* Completion rate label */}
                    <text
                      x={
                        actionBarsGeometry.margin.left +
                        Math.max(joinedWidth, completedWidth) +
                        8
                      }
                      y={y + actionBarsGeometry.barHeight / 2}
                      dominantBaseline="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {action.usersCompleted}/{action.usersJoined}{" "}
                      {action.usersJoined > 0
                        ? `(${Math.round(action.completionRate * 100)}%)`
                        : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Hover tooltip */}
          {hoveredActionBar && (
            <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[200px] pointer-events-none">
              <p className="font-semibold text-gray-900 mb-2 max-w-[350px]">
                {hoveredActionBar.actionName}
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-medium text-green-600">
                    {hoveredActionBar.usersCompleted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Joined:</span>
                  <span className="font-medium text-gray-700">
                    {hoveredActionBar.usersJoined}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-gray-600">Rate:</span>
                  <span className="font-semibold text-gray-900">
                    {hoveredActionBar.usersJoined > 0
                      ? `${Math.round(hoveredActionBar.completionRate * 100)}%`
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
            <div className="w-4 h-4 rounded bg-gray-300" />
            <span className="text-sm text-gray-600">Joined (Expected)</span>
          </div>
        </div>
      </div>

      {/* Cumulative Average Completion Rate Chart */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Cumulative Completion Rate
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">
                From
              </label>
              <input
                type="date"
                value={completionRateRange.start}
                onChange={(e) =>
                  setCompletionRateRange((prev) => ({
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
                value={completionRateRange.end}
                onChange={(e) =>
                  setCompletionRateRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
          </div>
        </div>
        <div className="relative p-4">
          {actionStatsLoading && cumulativeCompletionData.length === 0 && (
            <p className="text-sm text-gray-600">Loading...</p>
          )}
          {!actionStatsLoading && cumulativeCompletionData.length === 0 && (
            <p className="text-sm text-gray-600">
              No completed actions in this date range.
            </p>
          )}
          {completionRateChartGeometry &&
            cumulativeCompletionData.length > 0 && (
              <svg
                ref={completionRateSvgRef}
                viewBox={`0 0 ${completionRateChartGeometry.width} ${completionRateChartGeometry.height}`}
                className="w-full"
                onMouseMove={handleCompletionRateHover}
                onMouseLeave={() => setHoveredCompletionPoint(null)}
              >
                {/* Grid lines */}
                <g>
                  {completionRateChartGeometry.yTicks.map((tick) => (
                    <g key={`y-${tick}`}>
                      <line
                        x1={completionRateChartGeometry.margin.left}
                        x2={
                          completionRateChartGeometry.width -
                          completionRateChartGeometry.margin.right
                        }
                        y1={completionRateChartGeometry.yScale(tick)}
                        y2={completionRateChartGeometry.yScale(tick)}
                        stroke="#e5e7eb"
                        strokeDasharray="4 6"
                      />
                      <text
                        x={completionRateChartGeometry.margin.left - 12}
                        y={completionRateChartGeometry.yScale(tick)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="fill-gray-500 text-xs"
                      >
                        {Math.round(tick * 100)}%
                      </text>
                    </g>
                  ))}
                  {completionRateChartGeometry.xTicks.map((tick) => (
                    <g key={`x-${tick.toISOString()}`}>
                      <line
                        x1={completionRateChartGeometry.xScale(tick)}
                        x2={completionRateChartGeometry.xScale(tick)}
                        y1={completionRateChartGeometry.margin.top}
                        y2={
                          completionRateChartGeometry.height -
                          completionRateChartGeometry.margin.bottom
                        }
                        stroke="#f3f4f6"
                      />
                      <text
                        x={completionRateChartGeometry.xScale(tick)}
                        y={
                          completionRateChartGeometry.height -
                          completionRateChartGeometry.margin.bottom +
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

                {/* Area fill */}
                <path
                  d={completionRateChartGeometry.areaPath}
                  fill="rgba(22, 163, 74, 0.12)"
                  stroke="none"
                />

                {/* Line */}
                <path
                  d={completionRateChartGeometry.linePath}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                />

                {/* Data points */}
                {cumulativeCompletionData.map((point, idx) => (
                  <circle
                    key={idx}
                    cx={completionRateChartGeometry.xScale(point.date)}
                    cy={completionRateChartGeometry.yScale(point.avgRate)}
                    r={4}
                    fill="white"
                    stroke="#16a34a"
                    strokeWidth={2}
                  />
                ))}

                {/* Hover indicator */}
                {hoveredCompletionPoint && (
                  <>
                    <line
                      x1={completionRateChartGeometry.xScale(
                        hoveredCompletionPoint.date
                      )}
                      x2={completionRateChartGeometry.xScale(
                        hoveredCompletionPoint.date
                      )}
                      y1={completionRateChartGeometry.margin.top}
                      y2={
                        completionRateChartGeometry.height -
                        completionRateChartGeometry.margin.bottom
                      }
                      stroke="#6b7280"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <circle
                      cx={completionRateChartGeometry.xScale(
                        hoveredCompletionPoint.date
                      )}
                      cy={completionRateChartGeometry.yScale(
                        hoveredCompletionPoint.avgRate
                      )}
                      r={6}
                      fill="white"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                    />

                    {/* Hover box */}
                    <rect
                      x={Math.min(
                        completionRateChartGeometry.xScale(
                          hoveredCompletionPoint.date
                        ) + 12,
                        completionRateChartGeometry.width - 180
                      )}
                      y={completionRateChartGeometry.margin.top + 12}
                      width={164}
                      height={90}
                      rx={10}
                      fill="white"
                      stroke="#e5e7eb"
                      className="shadow-lg"
                    />
                    <text
                      x={Math.min(
                        completionRateChartGeometry.xScale(
                          hoveredCompletionPoint.date
                        ) + 24,
                        completionRateChartGeometry.width - 166
                      )}
                      y={completionRateChartGeometry.margin.top + 34}
                      className="fill-gray-900 text-sm font-semibold"
                    >
                      {fullDateFormatter.format(hoveredCompletionPoint.date)}
                    </text>
                    <text
                      x={Math.min(
                        completionRateChartGeometry.xScale(
                          hoveredCompletionPoint.date
                        ) + 24,
                        completionRateChartGeometry.width - 166
                      )}
                      y={completionRateChartGeometry.margin.top + 58}
                      className="fill-gray-600 text-xs"
                    >
                      Avg Rate:
                    </text>
                    <text
                      x={Math.min(
                        completionRateChartGeometry.xScale(
                          hoveredCompletionPoint.date
                        ) + 156,
                        completionRateChartGeometry.width - 34
                      )}
                      y={completionRateChartGeometry.margin.top + 58}
                      textAnchor="end"
                      className="fill-green-600 text-xs font-semibold"
                    >
                      {Math.round(hoveredCompletionPoint.avgRate * 100)}%
                    </text>
                    <text
                      x={Math.min(
                        completionRateChartGeometry.xScale(
                          hoveredCompletionPoint.date
                        ) + 24,
                        completionRateChartGeometry.width - 166
                      )}
                      y={completionRateChartGeometry.margin.top + 78}
                      className="fill-gray-600 text-xs"
                    >
                      Actions:
                    </text>
                    <text
                      x={Math.min(
                        completionRateChartGeometry.xScale(
                          hoveredCompletionPoint.date
                        ) + 156,
                        completionRateChartGeometry.width - 34
                      )}
                      y={completionRateChartGeometry.margin.top + 78}
                      textAnchor="end"
                      className="fill-gray-900 text-xs font-semibold"
                    >
                      {hoveredCompletionPoint.actionCount}
                    </text>
                  </>
                )}
              </svg>
            )}
        </div>
      </div>

      {/* Cohort Completion Retention Chart */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Cohort Completion Reliability
          </h3>
        </div>
        <div className="relative p-4">
          {retentionLoading && filteredRetentionCohorts.length === 0 && (
            <p className="text-sm text-gray-600">Loading retention data...</p>
          )}
          {!retentionLoading && filteredRetentionCohorts.length === 0 && (
            <p className="text-sm text-gray-600">
              No cohorts have completions yet.
            </p>
          )}
          {retentionChartGeometry && filteredRetentionCohorts.length > 0 && (
            <div className="relative min-w-[600px]">
              <svg
                viewBox={`0 0 ${retentionChartGeometry.width} ${retentionChartGeometry.height}`}
                className="w-full -mb-6"
              >
                <g>
                  {retentionChartGeometry.yTicks.map((tick) => (
                    <g key={`retention-y-${tick}`}>
                      <line
                        x1={retentionChartGeometry.margin.left}
                        x2={
                          retentionChartGeometry.width -
                          retentionChartGeometry.margin.right
                        }
                        y1={retentionChartGeometry.yScale(tick)}
                        y2={retentionChartGeometry.yScale(tick)}
                        stroke="#e5e7eb"
                        strokeDasharray="4 6"
                      />
                      <text
                        x={retentionChartGeometry.margin.left - 12}
                        y={retentionChartGeometry.yScale(tick)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="fill-gray-500 text-xs"
                      >
                        {Math.round(tick * 100)}%
                      </text>
                    </g>
                  ))}
                  {retentionChartGeometry.xTicks.map((tick) => (
                    <g key={`retention-x-${tick}`}>
                      <line
                        x1={retentionChartGeometry.xScale(tick)}
                        x2={retentionChartGeometry.xScale(tick)}
                        y1={retentionChartGeometry.margin.top}
                        y2={
                          retentionChartGeometry.height -
                          retentionChartGeometry.margin.bottom
                        }
                        stroke="#f3f4f6"
                      />
                      <text
                        x={retentionChartGeometry.xScale(tick)}
                        y={
                          retentionChartGeometry.height -
                          retentionChartGeometry.margin.bottom +
                          24
                        }
                        textAnchor="middle"
                        className="fill-gray-600 text-xs"
                      >
                        {Math.round(tick)}w
                      </text>
                    </g>
                  ))}
                </g>

                {retentionChartGeometry.lines.map(({ cohort, color, path }) => {
                  const isHovered =
                    hoveredRetentionPoint?.cohort.cohortStart ===
                    cohort.cohortStart;
                  return (
                    <path
                      key={cohort.cohortStart}
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? 3.2 : 2.2}
                      opacity={
                        hoveredRetentionPoint ? (isHovered ? 1 : 0.25) : 1
                      }
                    />
                  );
                })}

                {retentionChartGeometry.lines.flatMap(({ cohort, color }) =>
                  cohort.points.map((point) => {
                    const isHovered =
                      hoveredRetentionPoint?.cohort.cohortStart ===
                        cohort.cohortStart &&
                      hoveredRetentionPoint?.point.weekIndex ===
                        point.weekIndex;
                    return (
                      <circle
                        key={`${cohort.cohortStart}-${point.weekIndex}`}
                        cx={retentionChartGeometry.xScale(point.weekIndex)}
                        cy={retentionChartGeometry.yScale(point.completionRate)}
                        r={isHovered ? 5 : 3}
                        fill="white"
                        stroke={color}
                        strokeWidth={2}
                        className="cursor-pointer"
                        onMouseEnter={() =>
                          setHoveredRetentionPoint({
                            cohort,
                            point,
                            color,
                          })
                        }
                        onMouseLeave={() => setHoveredRetentionPoint(null)}
                      />
                    );
                  })
                )}
              </svg>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>Older</span>
                <div
                  className="h-2 w-40 rounded-full border border-gray-200"
                  style={{ background: retentionChartGeometry.legendGradient }}
                />
                <span>Newer</span>
              </div>

              {hoveredRetentionPoint && (
                <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[220px] pointer-events-none">
                  <p className="font-semibold text-gray-900 mb-2">
                    Week of{" "}
                    {fullDateFormatter.format(
                      new Date(
                        `${hoveredRetentionPoint.cohort.cohortStart}T00:00:00Z`
                      )
                    )}
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Weeks since join:</span>
                      <span className="font-medium text-gray-900">
                        {hoveredRetentionPoint.point.weekIndex}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completion rate:</span>
                      <span className="font-semibold text-gray-900">
                        {Math.round(
                          hoveredRetentionPoint.point.completionRate * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-green-600">
                        {hoveredRetentionPoint.point.completedCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Joined:</span>
                      <span className="font-medium text-gray-700">
                        {hoveredRetentionPoint.point.joinedCount}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="text-gray-600">Cohort size:</span>
                      <span className="font-medium text-gray-900">
                        {hoveredRetentionPoint.cohort.cohortSize}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
            className={`w-5 h-5 text-gray-500 transition-transform ${
              dailyStatsTableOpen ? "rotate-180" : ""
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
              className={`w-5 h-5 text-gray-500 transition-transform ${
                actionStatsTableOpen ? "rotate-180" : ""
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

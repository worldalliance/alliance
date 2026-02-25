import {
  analyticsGetDailyStats,
  analyticsGetActionStats,
  analyticsGetActionCompletionCurves,
  analyticsRecalculateActionStats,
  analyticsGetMemberCompletionRetention,
  analyticsGetAggregateStats,
  analyticsGetContractStatusHistory,
  analyticsGetTimeToChurnSamples,
  analyticsGetInviteFunnel,
  actionsFindAllWithDrafts,
  tasksListForms,
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
  Action,
  ActionStatsWithOnboardingDto,
  FormDto,
  MemberCompletionRetentionCohortDto,
  AggregateStatsDto,
  ContractStatusPointDto,
  TimeToChurnSampleDto,
  InviteFunnelDto,
} from "@alliance/shared/client/types.gen";
import chroma from "chroma-js";
import {
  max,
  min,
  scaleLinear,
  scaleTime,
  area,
  curveMonotoneX,
  range,
  bin,
  extent,
} from "d3";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ActionCompletionCurveChart from "../components/ActionCompletionCurveChart";

type ParsedDailyStats = DailyStatsRecord & { parsedDate: Date };
type ActionStatsWithWithdrawals = ActionStatsWithOnboardingDto & {
  usersWithdrawn?: number;
};
type HoveredActionBar = {
  action: ActionStatsWithWithdrawals;
  index: number;
};
type RetentionGridRow = {
  cohort: MemberCompletionRetentionCohortDto;
  pointsByWeek: Map<
    number,
    MemberCompletionRetentionCohortDto["points"][number]
  >;
};
type RetentionGridData = {
  weeks: number[];
  rows: RetentionGridRow[];
};
type HoveredRetentionCell = {
  x: number;
  y: number;
  week: number;
  actionIndex: number;
  actionStartDate: string;
  cohortStart: string;
  cohortSize: number;
  value: number;
  weekJoinedCount: number;
  weekCompletedCount: number;
  actions: Array<{
    actionId: number;
    actionName: string;
    memberCount: number;
  }>;
};
type TaskFormWordsCompletionPoint = {
  actionId: number;
  actionName: string;
  taskFormWords: number;
  firstDayCompletionRate: number;
  usersJoined: number;
};

const countWords = (text: string | null | undefined): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const countTaskFormSchemaWords = (schema: unknown): number => {
  const schemaRecord = getRecord(schema);
  if (!schemaRecord) return 0;

  let formWords = 0;
  formWords += countWords(getString(schemaRecord.title));
  formWords += countWords(getString(schemaRecord.description));

  const pages = Array.isArray(schemaRecord.pages) ? schemaRecord.pages : [];
  for (const pageValue of pages) {
    const page = getRecord(pageValue);
    if (!page) continue;

    formWords += countWords(getString(page.title));
    formWords += countWords(getString(page.description));

    const fields = Array.isArray(page.fields) ? page.fields : [];
    for (const fieldValue of fields) {
      const field = getRecord(fieldValue);
      if (!field) continue;

      formWords += countWords(getString(field.label));
      formWords += countWords(getString(field.description));
      formWords += countWords(getString(field.text));
      formWords += countWords(getString(field.caption));
      formWords += countWords(getString(field.startLabel));
      formWords += countWords(getString(field.endLabel));

      const options = Array.isArray(field.options) ? field.options : [];
      for (const optionValue of options) {
        const option = getRecord(optionValue);
        if (!option) continue;
        formWords += countWords(getString(option.label));
      }
    }
  }

  return formWords;
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
  const [completionCurveRefreshKey, setCompletionCurveRefreshKey] =
    useState<number>(0);
  const [taskFormWordsCompletionPoints, setTaskFormWordsCompletionPoints] =
    useState<TaskFormWordsCompletionPoint[]>([]);
  const [taskFormWordsCompletionLoading, setTaskFormWordsCompletionLoading] =
    useState<boolean>(false);
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
    start.setMonth(start.getMonth() - 5);
    return {
      start: formatDateAsLocal(start),
      end: formatDateAsLocal(end),
    };
  });
  const [inviteFunnel, setInviteFunnel] = useState<InviteFunnelDto | null>(
    null
  );
  const [inviteFunnelLoading, setInviteFunnelLoading] =
    useState<boolean>(false);
  const [inviteFunnelRange, setInviteFunnelRange] = useState(() => {
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const start = new Date();
    start.setDate(end.getDate() - 14);
    return { start: formatDateAsLocal(start), end: formatDateAsLocal(end) };
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
  const retentionGridRef = useRef<HTMLDivElement | null>(null);
  const [hoveredRetentionCell, setHoveredRetentionCell] =
    useState<HoveredRetentionCell | null>(null);

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

  const loadTaskFormWordsCompletionPoints = useCallback(async () => {
    setTaskFormWordsCompletionLoading(true);
    try {
      const [actionsResponse, formsResponse, curvesResponse] = await Promise.all([
        actionsFindAllWithDrafts(),
        tasksListForms(),
        analyticsGetActionCompletionCurves(),
      ]);

      const actions = actionsResponse.data ?? [];
      const forms = formsResponse.data ?? [];
      const curves = curvesResponse.data ?? [];

      const actionsById = new Map<number, Action>(
        actions.map((action) => [action.id, action])
      );
      const formsById = new Map<number, FormDto>(
        forms.map((form) => [form.id, form])
      );

      const computedPoints: TaskFormWordsCompletionPoint[] = curves
        .filter(
          (curve) =>
            (curve.dayOffsets?.length ?? 0) > 0 &&
            (curve.completionFractions?.length ?? 0) ===
              (curve.dayOffsets?.length ?? 0) &&
            curve.usersJoined > 0
        )
        .map((curve) => {
          const action = actionsById.get(curve.actionId);
          const form = action?.taskFormId
            ? formsById.get(action.taskFormId)
            : undefined;
          const dayZeroIndex = curve.dayOffsets.findIndex((offset) => offset === 0);
          const firstDayCompletionRate =
            dayZeroIndex >= 0
              ? (curve.completionFractions[dayZeroIndex] ?? 0)
              : 0;

          return {
            actionId: curve.actionId,
            actionName: action?.name ?? curve.actionName,
            taskFormWords: countTaskFormSchemaWords(form?.schema),
            firstDayCompletionRate: Number.isFinite(firstDayCompletionRate)
              ? firstDayCompletionRate
              : 0,
            usersJoined: curve.usersJoined,
          };
        })
        .filter((point) => Number.isFinite(point.firstDayCompletionRate))
        .sort((a, b) => {
          if (a.taskFormWords !== b.taskFormWords) {
            return a.taskFormWords - b.taskFormWords;
          }
          return a.actionName.localeCompare(b.actionName);
        });

      setTaskFormWordsCompletionPoints(computedPoints);
    } catch (err) {
      console.error("Failed to load task form words completion data", err);
      setTaskFormWordsCompletionPoints([]);
    } finally {
      setTaskFormWordsCompletionLoading(false);
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
      const actionStatsResponse = await analyticsRecalculateActionStats();
      setActionStats(actionStatsResponse.data ?? []);
      setCompletionCurveRefreshKey((prev) => prev + 1);
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
    void loadTaskFormWordsCompletionPoints();
  }, [loadTaskFormWordsCompletionPoints, completionCurveRefreshKey]);

  useEffect(() => {
    void loadRetentionCohorts();
  }, [loadRetentionCohorts]);

  useEffect(() => {
    void loadAggregateStats();
  }, [loadAggregateStats]);

  useEffect(() => {
    void loadTimeToChurnSamples();
  }, [loadTimeToChurnSamples]);

  const loadInviteFunnel = useCallback(async () => {
    setInviteFunnelLoading(true);
    try {
      const response = await analyticsGetInviteFunnel({
        query: {
          startDate: inviteFunnelRange.start,
          endDate: inviteFunnelRange.end,
        },
      });
      setInviteFunnel(response.data ?? null);
    } catch (err) {
      console.error("Failed to load invite funnel", err);
    } finally {
      setInviteFunnelLoading(false);
    }
  }, [inviteFunnelRange]);

  useEffect(() => {
    void loadInviteFunnel();
  }, [loadInviteFunnel]);

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

    const maxCompleted = max(chartActionStats, (d) => d.usersCompleted) ?? 0;
    const maxTotalExpected =
      max(chartActionStats, (d) => d.usersJoined + (d.usersWithdrawn ?? 0)) ??
      0;
    const maxValue = Math.max(maxCompleted, maxTotalExpected, 10);

    const xScale = scaleLinear()
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
      .filter((a) => a.memberActionEndDate && a.showInChart && !a.onboarding)
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

  const taskFormWordsCompletionTrendline = useMemo(() => {
    if (taskFormWordsCompletionPoints.length < 2) {
      return null;
    }

    const points = taskFormWordsCompletionPoints.map((point) => ({
      x: point.taskFormWords,
      y: point.firstDayCompletionRate,
    }));
    const n = points.length;
    const sumX = points.reduce((total, point) => total + point.x, 0);
    const sumY = points.reduce((total, point) => total + point.y, 0);
    const sumXY = points.reduce((total, point) => total + point.x * point.y, 0);
    const sumXX = points.reduce((total, point) => total + point.x * point.x, 0);
    const denominator = n * sumXX - sumX * sumX;

    if (!Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    const xMin = min(points, (point) => point.x) ?? 0;
    const xMax = max(points, (point) => point.x) ?? xMin;

    if (!Number.isFinite(slope) || !Number.isFinite(intercept)) {
      return null;
    }

    return { slope, intercept, xMin, xMax };
  }, [taskFormWordsCompletionPoints]);

  const taskFormWordsCompletionSeries = useMemo<MultiLineSeries[]>(() => {
    const actionPointSeries: MultiLineSeries[] = taskFormWordsCompletionPoints.map(
      (point) => ({
        key: `task-form-words-action-${point.actionId}`,
        label: point.actionName,
        color: "#2563eb",
        data: [
          {
            x: point.taskFormWords,
            firstDayCompletionRate: point.firstDayCompletionRate,
            actionId: point.actionId,
            actionName: point.actionName,
            usersJoined: point.usersJoined,
          },
        ],
      })
    );

    if (!taskFormWordsCompletionTrendline) {
      return actionPointSeries;
    }

    const trendlinePoints: DataPoint[] = [
      {
        x: taskFormWordsCompletionTrendline.xMin,
        firstDayCompletionRate:
          taskFormWordsCompletionTrendline.slope *
            taskFormWordsCompletionTrendline.xMin +
          taskFormWordsCompletionTrendline.intercept,
      },
      {
        x: taskFormWordsCompletionTrendline.xMax,
        firstDayCompletionRate:
          taskFormWordsCompletionTrendline.slope *
            taskFormWordsCompletionTrendline.xMax +
          taskFormWordsCompletionTrendline.intercept,
      },
    ];

    return [
      ...actionPointSeries,
      {
        key: "task-form-words-trendline",
        label: "Trendline",
        color: "#111827",
        data: trendlinePoints,
      },
    ];
  }, [taskFormWordsCompletionPoints, taskFormWordsCompletionTrendline]);

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
    const minDate = min(cohortDates) ?? Date.now();
    const maxDate = max(cohortDates) ?? Date.now();
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

  const retentionHeatmapScale = useMemo(() => {
    return chroma.scale("RdYlGn").domain([0, 1]).mode("lab");
  }, []);

  const retentionGridData = useMemo<RetentionGridData>(() => {
    if (filteredRetentionCohorts.length === 0) {
      return { weeks: [], rows: [] };
    }

    const allWeekIndices = filteredRetentionCohorts.flatMap((cohort) =>
      cohort.points.map((point) => point.weekIndex)
    );
    const maxWeek = max(allWeekIndices) ?? 0;
    const rawMin = Math.max(0, Math.floor(weekRange.min));
    const rawMax = Math.max(rawMin, Math.ceil(weekRange.max));
    const rangeMin = Math.min(rawMin, maxWeek);
    const rangeMax = Math.min(rawMax, maxWeek);
    const weeks = rangeMin <= rangeMax ? range(rangeMin, rangeMax + 1) : [];

    const rows = [...filteredRetentionCohorts]
      .sort(
        (a, b) =>
          new Date(b.cohortStart).getTime() - new Date(a.cohortStart).getTime()
      )
      .map((cohort) => ({
        cohort,
        pointsByWeek: new Map(
          cohort.points.map((point) => [point.weekIndex, point])
        ),
      }));

    return { weeks, rows };
  }, [filteredRetentionCohorts, weekRange]);

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
    const maxWeeks = max(churnDurationsWeeks) ?? 0;
    const xMax = Math.max(1, maxWeeks);

    const xScale = scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([margin.left, width - margin.right]);

    const maxWeekLabel = Math.max(1, Math.ceil(xMax));
    const weeklyThresholds = range(0, maxWeekLabel + 1, 1);

    const bins = bin<number, number>()
      .domain(xScale.domain() as [number, number])
      .thresholds(weeklyThresholds)(churnDurationsWeeks);

    const trimmedBins = [...bins];
    while (
      trimmedBins.length > 1 &&
      trimmedBins[trimmedBins.length - 1].length === 0
    ) {
      trimmedBins.pop();
    }

    const maxCount = max(trimmedBins, (bin) => bin.length) ?? 0;
    const yScale = scaleLinear()
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

    const dateExtent = extent(parsedContractStatusHistory, (d) => d.parsedDate);
    if (!dateExtent[0] || !dateExtent[1]) return null;

    const xScale = scaleTime()
      .domain(dateExtent)
      .range([margin.left, width - margin.right]);

    const maxTotal =
      max(parsedContractStatusHistory, (d) => d.totalEverSigned) ?? 10;

    const yScale = scaleLinear()
      .domain([0, maxTotal * 1.1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Area for active users (green, bottom)
    const activeArea = area<(typeof parsedContractStatusHistory)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.activeCount))
      .curve(curveMonotoneX);

    // Area for churned users (red, stacked on top of active)
    const churnedArea = area<(typeof parsedContractStatusHistory)[0]>()
      .x((d) => xScale(d.parsedDate))
      .y0((d) => yScale(d.activeCount))
      .y1((d) => yScale(d.activeCount + d.churnedCount))
      .curve(curveMonotoneX);

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

  const inviteFunnelGeometry = useMemo(() => {
    if (!inviteFunnel) return null;

    const bars = [
      {
        label: "Invites Created",
        value: inviteFunnel.invitesCreated,
        color: "#6366f1",
      },
      {
        label: "Invites Used",
        value: inviteFunnel.invitesUsed,
        color: "#8b5cf6",
      },
      {
        label: "Signed Contract",
        value: inviteFunnel.contractSigned,
        color: "#a855f7",
      },
      {
        label: "Finished Onboarding",
        value: inviteFunnel.onboardingCompleted,
        color: "#c084fc",
      },
    ];

    const width = 600;
    const height = 300;
    const margin = { top: 28, right: 32, bottom: 48, left: 56 };
    const maxValue = Math.max(1, ...bars.map((b) => b.value));

    const barAreaWidth = width - margin.left - margin.right;
    const barWidth = Math.min(80, barAreaWidth / bars.length - 16);
    const totalBarsWidth = bars.length * barWidth + (bars.length - 1) * 16;
    const offsetX = margin.left + (barAreaWidth - totalBarsWidth) / 2;

    const yScale = scaleLinear()
      .domain([0, maxValue * 1.15])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const yTicks = yScale.ticks(5);

    return {
      bars,
      width,
      height,
      margin,
      barWidth,
      offsetX,
      yScale,
      yTicks,
      maxValue,
    };
  }, [inviteFunnel]);

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

  const handleRetentionCellHover = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
      row: RetentionGridRow,
      week: number,
      point: MemberCompletionRetentionCohortDto["points"][number] | undefined
    ) => {
      if (!point || !Number.isFinite(point.weekCompletionRate)) {
        setHoveredRetentionCell(null);
        return;
      }
      if (!retentionGridRef.current) {
        return;
      }
      const containerRect = retentionGridRef.current.getBoundingClientRect();
      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top;
      setHoveredRetentionCell({
        x,
        y,
        week,
        actionIndex: point.actionIndex,
        actionStartDate: point.actionStartDate,
        cohortStart: row.cohort.cohortStart,
        cohortSize: row.cohort.cohortSize,
        value: point.weekCompletionRate,
        weekJoinedCount: point.weekJoinedCount,
        weekCompletedCount: point.weekCompletedCount,
        actions: point.actions ?? [],
      });
    },
    []
  );

  const handleRetentionCellLeave = useCallback(() => {
    setHoveredRetentionCell(null);
  }, []);

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
            <div className="flex flex-row gap-6 items-end">
              <div className="flex flex-col gap-y-1">
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
                    onChange={(e) =>
                      setAssumedHourlyRate(Number(e.target.value))
                    }
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
        </div>
      ) : null}

      {/* Invite Conversion Funnel */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Invite Conversion Funnel
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">
                From
              </label>
              <input
                type="date"
                value={inviteFunnelRange.start}
                onChange={(e) =>
                  setInviteFunnelRange((prev) => ({
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
                value={inviteFunnelRange.end}
                onChange={(e) =>
                  setInviteFunnelRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
            <button
              onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 7);
                setInviteFunnelRange({
                  start: formatDateAsLocal(start),
                  end: formatDateAsLocal(end),
                });
              }}
              className="px-3 py-1 rounded-md text-xs border border-gray-300 bg-white hover:border-gray-400"
            >
              Last 7 days
            </button>
          </div>
        </div>
        <div className="relative p-4">
          {inviteFunnelLoading && !inviteFunnel && (
            <p className="text-sm text-gray-600">Loading invite funnel...</p>
          )}
          {!inviteFunnelLoading && !inviteFunnel && (
            <p className="text-sm text-gray-600">No invite funnel data.</p>
          )}
          {inviteFunnelGeometry && inviteFunnel && (
            <svg
              viewBox={`0 0 ${inviteFunnelGeometry.width} ${inviteFunnelGeometry.height}`}
              className="w-full max-w-[600px] mx-auto"
            >
              {/* Y-axis grid lines */}
              {inviteFunnelGeometry.yTicks.map((tick) => (
                <g key={`funnel-y-${tick}`}>
                  <line
                    x1={inviteFunnelGeometry.margin.left}
                    x2={
                      inviteFunnelGeometry.width -
                      inviteFunnelGeometry.margin.right
                    }
                    y1={inviteFunnelGeometry.yScale(tick)}
                    y2={inviteFunnelGeometry.yScale(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={inviteFunnelGeometry.margin.left - 10}
                    y={inviteFunnelGeometry.yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-500 text-xs"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {/* Bars */}
              {inviteFunnelGeometry.bars.map((bar, idx) => {
                const x =
                  inviteFunnelGeometry.offsetX +
                  idx * (inviteFunnelGeometry.barWidth + 16);
                const barHeight =
                  inviteFunnelGeometry.yScale(0) -
                  inviteFunnelGeometry.yScale(bar.value);
                const y = inviteFunnelGeometry.yScale(bar.value);

                return (
                  <g key={bar.label}>
                    <rect
                      x={x}
                      y={y}
                      width={inviteFunnelGeometry.barWidth}
                      height={Math.max(0, barHeight)}
                      rx={4}
                      fill={bar.color}
                    />
                    {/* Value label above bar */}
                    <text
                      x={x + inviteFunnelGeometry.barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      className="fill-gray-700 text-xs font-semibold"
                    >
                      {bar.value}
                    </text>
                    {/* Conversion rate label */}
                    {idx > 0 &&
                      inviteFunnelGeometry.bars[idx - 1].value > 0 && (
                        <text
                          x={x + inviteFunnelGeometry.barWidth / 2}
                          y={y - 18}
                          textAnchor="middle"
                          className="fill-gray-400 text-[10px]"
                        >
                          {Math.round(
                            (bar.value /
                              inviteFunnelGeometry.bars[idx - 1].value) *
                              100
                          )}
                          %
                        </text>
                      )}
                    {/* X-axis label */}
                    <text
                      x={x + inviteFunnelGeometry.barWidth / 2}
                      y={
                        inviteFunnelGeometry.height -
                        inviteFunnelGeometry.margin.bottom +
                        16
                      }
                      textAnchor="middle"
                      className="fill-gray-600 text-[11px]"
                    >
                      {bar.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Members Over Time Chart */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 p-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Members over time</h3>
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
                        contractStatusChartGeometry.width - 130
                      )}
                      y={contractStatusChartGeometry.margin.top + 12}
                      width={118}
                      height={48}
                      rx={6}
                      fill="white"
                      stroke="#e5e7eb"
                    />
                    <text
                      x={Math.min(
                        contractStatusChartGeometry.xScale(
                          hoveredContractPoint.parsedDate
                        ) + 24,
                        contractStatusChartGeometry.width - 118
                      )}
                      y={contractStatusChartGeometry.margin.top + 31}
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
                    <text
                      x={Math.min(
                        contractStatusChartGeometry.xScale(
                          hoveredContractPoint.parsedDate
                        ) + 24,
                        contractStatusChartGeometry.width - 118
                      )}
                      y={contractStatusChartGeometry.margin.top + 50}
                      className="fill-gray-500 text-xs"
                    >
                      {hoveredContractPoint.activeCount} members
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
              <defs>
                <pattern
                  id="in-progress-stripes"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#dbeafe" />
                  <rect width="4" height="8" fill="#93c5fd" />
                </pattern>
                <pattern
                  id="in-progress-stripes-hover"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#bfdbfe" />
                  <rect width="4" height="8" fill="#60a5fa" />
                </pattern>
              </defs>
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
                      width={Math.max(expectedWidth, 0)}
                      height={actionBarsGeometry.barHeight}
                      rx={4}
                      fill={
                        action.memberActionEndDate &&
                        new Date(action.memberActionEndDate) > new Date()
                          ? isHovered
                            ? "url(#in-progress-stripes-hover)"
                            : "url(#in-progress-stripes)"
                          : isHovered
                          ? "#d1d5db"
                          : "#e5e7eb"
                      }
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
                        Math.max(
                          expectedWidth,
                          completedWidth + withdrawnWidth
                        ) +
                        8
                      }
                      y={y + actionBarsGeometry.barHeight / 2}
                      dominantBaseline="middle"
                      className="fill-gray-600 text-xs"
                    >
                      {action.usersCompleted}/{totalExpected}{" "}
                      {totalExpected > 0 ? `(${displayRate}%)` : ""}
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
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 rounded" viewBox="0 0 16 16">
              <defs>
                <pattern
                  id="legend-stripes"
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="4" height="4" fill="#dbeafe" />
                  <rect width="2" height="4" fill="#93c5fd" />
                </pattern>
              </defs>
              <rect width="16" height="16" rx="2" fill="url(#legend-stripes)" />
            </svg>
            <span className="text-sm text-gray-600">In progress</span>
          </div>
        </div>
      </div>

      {/* Action Completion Curves */}
      <ActionCompletionCurveChart refreshKey={completionCurveRefreshKey} />

      <TimeSeriesChart
        title="Task Form Words vs First-Day Completion"
        xType="number"
        loading={taskFormWordsCompletionLoading}
        emptyMessage="No completion curve data available for actions."
        multiLineData={taskFormWordsCompletionSeries}
        getXValue={(d) => (d.x as number) ?? 0}
        getYValue={(d) => (d.firstDayCompletionRate as number) ?? 0}
        xAxisFormat={(v) => `${Math.round(v)}`}
        yDomain={[0, 1]}
        yAxisFormat={(v) => `${Math.round(v * 100)}%`}
        height={360}
        headerContent={
          <span className="text-xs text-gray-500 md:ml-auto">
            X: words in task form | Y: members completing on day 1
          </span>
        }
        getHoverContent={(point, series) => {
          const words = Math.round(((point.x as number) ?? 0) * 10) / 10;
          const completionRate = (point.firstDayCompletionRate as number) ?? 0;

          if (series.key === "task-form-words-trendline") {
            return {
              title: "Trendline",
              items: [
                { label: "Task-form words", value: words },
                {
                  label: "Predicted day-1 completion",
                  value: `${(completionRate * 100).toFixed(1)}%`,
                  color: series.color,
                },
              ],
            };
          }

          return {
            title: (point.actionName as string) ?? series.label,
            items: [
              { label: "Task-form words", value: words },
              {
                label: "Day-1 completion",
                value: `${(completionRate * 100).toFixed(1)}%`,
                color: series.color,
              },
              { label: "Members joined", value: (point.usersJoined as number) ?? 0 },
            ],
          };
        }}
      />

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

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Cohort Completion Grid
            </h3>
          </div>
        </div>
        <div className="p-4">
          {retentionLoading && retentionGridData.rows.length === 0 && (
            <p className="text-sm text-gray-600">Loading cohorts...</p>
          )}
          {!retentionLoading && retentionGridData.rows.length === 0 && (
            <p className="text-sm text-gray-600">
              No cohorts have completions yet.
            </p>
          )}
          {!retentionLoading &&
            retentionGridData.rows.length > 0 &&
            retentionGridData.weeks.length === 0 && (
              <p className="text-sm text-gray-600">
                No weeks in the selected range.
              </p>
            )}
          {!retentionLoading &&
            retentionGridData.rows.length > 0 &&
            retentionGridData.weeks.length > 0 && (
              <div className="overflow-x-auto">
                <div className="min-w-max relative" ref={retentionGridRef}>
                  <div
                    className="grid items-center gap-0"
                    style={{
                      gridTemplateColumns: `200px repeat(${retentionGridData.weeks.length}, 40px)`,
                    }}
                  >
                    <div
                      className="h-10 px-2 flex items-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide"
                      style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                    >
                      Cohort
                    </div>
                    {retentionGridData.weeks.map((week) => (
                      <div
                        key={`retention-grid-header-${week}`}
                        className="h-10 w-10 flex items-center justify-center text-[11px] text-gray-500"
                        style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                      >
                        W{week}
                      </div>
                    ))}
                    {retentionGridData.rows.map((row) => {
                      const cohortDate = new Date(
                        `${row.cohort.cohortStart}T00:00:00Z`
                      );
                      return (
                        <React.Fragment
                          key={`retention-grid-row-${row.cohort.cohortStart}`}
                        >
                          <div
                            className="h-10 px-2 flex flex-col justify-center gap-0.5"
                            style={{ boxShadow: "inset 0 0 0 0.5px #e5e7eb" }}
                          >
                            <div className="text-[11px] font-semibold text-gray-700 leading-tight">
                              Week of {fullDateFormatter.format(cohortDate)}
                            </div>
                            <div className="text-[10px] text-gray-500 leading-tight">
                              {row.cohort.cohortSize} members
                            </div>
                          </div>
                          {retentionGridData.weeks.map((week) => {
                            const point = row.pointsByWeek.get(week);
                            const value = point?.weekCompletionRate;
                            const hasValue =
                              typeof value === "number" &&
                              Number.isFinite(value);
                            const displayValue = hasValue
                              ? `${Math.round(value * 100)}%`
                              : "";
                            const fill = hasValue
                              ? retentionHeatmapScale(value).hex()
                              : "#f8fafc";
                            const textColor =
                              hasValue &&
                              retentionHeatmapScale(value).luminance() < 0.45
                                ? "#f8fafc"
                                : "#0f172a";

                            return (
                              <div
                                key={`retention-grid-${row.cohort.cohortStart}-${week}`}
                                className="h-10 w-10 flex items-center justify-center text-[11px] font-semibold"
                                style={{
                                  backgroundColor: fill,
                                  color: textColor,
                                  boxShadow: "inset 0 0 0 0.5px #e5e7eb",
                                }}
                                onMouseEnter={(event) =>
                                  handleRetentionCellHover(
                                    event,
                                    row,
                                    week,
                                    point
                                  )
                                }
                                onMouseMove={(event) =>
                                  handleRetentionCellHover(
                                    event,
                                    row,
                                    week,
                                    point
                                  )
                                }
                                onMouseLeave={handleRetentionCellLeave}
                              >
                                {displayValue}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {hoveredRetentionCell && (
                    <div
                      className="absolute z-20 w-64 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg"
                      style={{
                        left: hoveredRetentionCell.x,
                        top: hoveredRetentionCell.y,
                        transform: "translate(-50%, -115%)",
                        pointerEvents: "none",
                      }}
                    >
                      <div className="flex items-center gap-2 justify-between mb-2">
                        <div className="text-xs font-semibold text-gray-900">
                          Week {hoveredRetentionCell.week}
                        </div>
                        <p>
                          {fullDateFormatter.format(
                            new Date(
                              `${hoveredRetentionCell.actionStartDate}T00:00:00Z`
                            )
                          )}
                        </p>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Cohort: Week of{" "}
                        {fullDateFormatter.format(
                          new Date(
                            `${hoveredRetentionCell.cohortStart}T00:00:00Z`
                          )
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Completed</span>
                        <span>{hoveredRetentionCell.weekCompletedCount}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Joined</span>
                        <span>{hoveredRetentionCell.weekJoinedCount}</span>
                      </div>
                      {hoveredRetentionCell.actions.length > 0 && (
                        <>
                          <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                            Actions
                          </div>
                          <div className="mt-1 space-y-1">
                            {hoveredRetentionCell.actions.map((action) => (
                              <div
                                key={`retention-action-${hoveredRetentionCell.cohortStart}-${hoveredRetentionCell.week}-${action.actionId}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="truncate">
                                  {action.actionName}
                                </span>
                                <span className="text-gray-500">
                                  {action.memberCount}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
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

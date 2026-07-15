import {
  analyticsGetActionStatsAdmin,
  analyticsGetAggregateStatsAdmin,
  analyticsGetContractStatusHistoryAdmin,
  analyticsGetDailyStatsAdmin,
  analyticsGetInviteFunnelAdmin,
  analyticsGetMemberCompletionRetentionAdmin,
  analyticsGetMemberReliabilityWindowAdmin,
  analyticsGetReminderGroupClickRatesAdmin,
  analyticsGetTimeToChurnSamplesAdmin,
  analyticsRecalculateActionStatsAdmin,
} from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import {
  ActionStatsWithOnboardingDto,
  AggregateStatsDto,
  ContractStatusPointDto,
  DailyStatsDto,
  InviteFunnelDto,
  MemberCompletionRetentionCohortDto,
  MemberReliabilityWindowDto,
  ReminderGroupClickRatePointDto,
  TimeToChurnSampleDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import { useQuery } from "@tanstack/react-query";
import chroma from "chroma-js";
import {
  area,
  bin,
  curveMonotoneX,
  extent,
  max,
  min,
  range,
  scaleBand,
  scaleLinear,
  scaleTime,
} from "d3";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ActionCompletionCurveChart from "../components/ActionCompletionCurveChart";
import {
  TimeSeriesChart,
  formatDateAsLocal,
  fullDateFormatter,
  type ChartSeries,
  type DataPoint,
  type MultiLineSeries,
} from "../components/TimeSeriesChart";

type ParsedDailyStats = DailyStatsDto & { parsedDate: Date };
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
type ReminderGroupClickRatePoint = Omit<
  ReminderGroupClickRatePointDto,
  "date"
> & { date: Date };
type ReminderActionChannelBar = {
  actionId: number;
  actionName: string;
  averageRate: number;
  reminderGroupCount: number;
  sentCount: number;
  clickedCount: number;
};
type HoveredReminderActionBar = {
  bar: ReminderActionChannelBar;
  channel: "email" | "text";
};
type PlatformTenureCohortActionStats = {
  actionId: number;
  actionName: string;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  memberActionStartDate: string;
  memberActionEndDate?: string;
};
type PlatformTenureCohortStats = {
  weeksOnPlatform: number;
  cohortSize: number;
  activeCount: number;
  churnedCount: number;
  churnRate: number;
  assignedCount: number;
  completedCount: number;
  completionRate: number;
  actions: PlatformTenureCohortActionStats[];
};

const buildRoundedLeftPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
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
  radius: number,
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

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type ParsedContractStatusPoint = ContractStatusPointDto & {
  parsedDate: Date;
};

const findContractStatusPointDaysAgo = (
  history: ParsedContractStatusPoint[],
  daysAgo: number,
): ParsedContractStatusPoint | null => {
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const targetDate = new Date(latest.parsedDate);
  targetDate.setDate(targetDate.getDate() - daysAgo);

  let closest = history[0];
  for (const point of history) {
    if (point.parsedDate <= targetDate) {
      closest = point;
    } else {
      break;
    }
  }

  const daysBetween =
    (latest.parsedDate.getTime() - closest.parsedDate.getTime()) /
    (1000 * 60 * 60 * 24);
  if (daysBetween < daysAgo - 2) return null;

  return closest;
};

const asRecordArray = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];

const parseLocalDateInput = (
  value?: string | null,
  endOfDay = false,
): Date | null => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const parsed = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWeekStartDate = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dayOfWeek = date.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return date;
};

const fetchPlatformTenureCohort = async (
  weeksOnPlatform: number,
): Promise<PlatformTenureCohortStats> => {
  const response = await client.get<PlatformTenureCohortStats>({
    url: "/analytics/platform-tenure-cohort",
    query: { weeksOnPlatform },
  });

  if (!response.data) {
    throw new Error("No platform tenure cohort data returned");
  }

  return response.data;
};

const fetchMemberReliabilityWindow = async (
  weeks: number,
): Promise<MemberReliabilityWindowDto> => {
  const response = await analyticsGetMemberReliabilityWindowAdmin({
    query: { weeks },
  });

  if (!response.data) {
    throw new Error("No member reliability data returned");
  }

  return response.data;
};

const StatsPage: React.FC = () => {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [startInput, setStartInput] = useState<string>(defaultRange.start);
  const [endInput, setEndInput] = useState<string>(defaultRange.end);
  const [queryRange, setQueryRange] = useState(defaultRange);
  const [stats, setStats] = useState<DailyStatsDto[]>([]);
  const [actionStats, setActionStats] = useState<ActionStatsWithWithdrawals[]>(
    [],
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
  const [retentionLoading, setRetentionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredActionBar, setHoveredActionBar] =
    useState<HoveredActionBar | null>(null);
  const [hoveredReminderActionBar, setHoveredReminderActionBar] =
    useState<HoveredReminderActionBar | null>(null);
  const [timeToChurnSamples, setTimeToChurnSamples] = useState<
    TimeToChurnSampleDto[]
  >([]);
  const [timeToChurnLoading, setTimeToChurnLoading] = useState<boolean>(false);
  const [platformTenureWeeksInput, setPlatformTenureWeeksInput] =
    useState<string>("4");
  const [platformTenureCohort, setPlatformTenureCohort] =
    useState<PlatformTenureCohortStats | null>(null);
  const [platformTenureCohortLoading, setPlatformTenureCohortLoading] =
    useState<boolean>(false);
  const [platformTenureCohortError, setPlatformTenureCohortError] = useState<
    string | null
  >(null);
  const [memberReliabilityWeeksInput, setMemberReliabilityWeeksInput] =
    useState<string>("5");
  const [memberReliabilityWindow, setMemberReliabilityWindow] =
    useState<MemberReliabilityWindowDto | null>(null);
  const [memberReliabilityLoading, setMemberReliabilityLoading] =
    useState<boolean>(false);
  const [memberReliabilityError, setMemberReliabilityError] = useState<
    string | null
  >(null);
  const [missedActions, setMissedActions] = useState<unknown>(null);
  const [missedActionsLoading, setMissedActionsLoading] =
    useState<boolean>(false);
  const [missedActionsRequested, setMissedActionsRequested] =
    useState<boolean>(false);
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
  const [reminderClickRateRange, setReminderClickRateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    return {
      start: formatDateAsLocal(start),
      end: formatDateAsLocal(end),
    };
  });
  const [inviteFunnel, setInviteFunnel] = useState<InviteFunnelDto | null>(
    null,
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
      const response = await analyticsGetDailyStatsAdmin({
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
      const response = await analyticsGetActionStatsAdmin();
      setActionStats(response.data ?? []);
    } catch (err) {
      console.error("Failed to load action stats", err);
    } finally {
      setActionStatsLoading(false);
    }
  }, []);

  const {
    data: reminderGroupClickRatePoints = [],
    isPending: reminderGroupClickRatesLoading,
  } = useQuery({
    queryKey: queryKeys.reminderGroupClickRatesAdmin(),
    queryFn: async () => {
      const response = await analyticsGetReminderGroupClickRatesAdmin();
      return (response.data ?? []).map(
        (point): ReminderGroupClickRatePoint => ({
          ...point,
          date: new Date(point.date),
        }),
      );
    },
  });

  const loadRetentionCohorts = useCallback(async () => {
    setRetentionLoading(true);
    try {
      const response = await analyticsGetMemberCompletionRetentionAdmin();
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
      const response = await analyticsGetAggregateStatsAdmin();
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
      const response = await analyticsGetTimeToChurnSamplesAdmin();
      setTimeToChurnSamples(response.data ?? []);
    } catch (err) {
      console.error("Failed to load time to churn samples", err);
    } finally {
      setTimeToChurnLoading(false);
    }
  }, []);

  const loadPlatformTenureCohort = useCallback(async (weeks: number) => {
    setPlatformTenureCohortLoading(true);
    setPlatformTenureCohortError(null);
    try {
      const cohort = await fetchPlatformTenureCohort(weeks);
      setPlatformTenureCohort(cohort);
    } catch (err) {
      console.error("Failed to load platform tenure cohort", err);
      setPlatformTenureCohort(null);
      setPlatformTenureCohortError(
        "Unable to load this cohort right now. Please try again soon.",
      );
    } finally {
      setPlatformTenureCohortLoading(false);
    }
  }, []);

  const handleApplyPlatformTenureCohort = useCallback(() => {
    const weeks = Number(platformTenureWeeksInput);
    if (!Number.isInteger(weeks) || weeks < 0) {
      setPlatformTenureCohortError("Weeks on platform must be a whole number.");
      return;
    }
    void loadPlatformTenureCohort(weeks);
  }, [loadPlatformTenureCohort, platformTenureWeeksInput]);

  const loadMemberReliabilityWindow = useCallback(async (weeks: number) => {
    setMemberReliabilityLoading(true);
    setMemberReliabilityError(null);
    try {
      setMemberReliabilityWindow(await fetchMemberReliabilityWindow(weeks));
    } catch (err) {
      console.error("Failed to load member reliability", err);
      setMemberReliabilityWindow(null);
      setMemberReliabilityError(
        "Unable to load reliability data right now. Please try again soon.",
      );
    } finally {
      setMemberReliabilityLoading(false);
    }
  }, []);

  const handleApplyMemberReliabilityWindow = useCallback(() => {
    const weeks = Number(memberReliabilityWeeksInput);
    if (!Number.isInteger(weeks) || weeks < 1) {
      setMemberReliabilityError("Weeks must be a whole number of at least 1.");
      return;
    }
    void loadMemberReliabilityWindow(weeks);
  }, [loadMemberReliabilityWindow, memberReliabilityWeeksInput]);

  const loadMissedActions = useCallback(async () => {
    setMissedActionsLoading(true);
    try {
      const response = await client.get({ url: "/analytics/missed-actions" });
      setMissedActions(response.data ?? null);
    } catch (err) {
      console.error("Failed to load missed actions", err);
      setMissedActions(null);
    } finally {
      setMissedActionsLoading(false);
    }
  }, []);

  const handleLoadMissedActions = useCallback(() => {
    setMissedActionsRequested(true);
    void loadMissedActions();
  }, [loadMissedActions]);

  const handleRecalculateActionStats = useCallback(async () => {
    setActionStatsLoading(true);
    try {
      const actionStatsResponse = await analyticsRecalculateActionStatsAdmin();
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
      const response = await analyticsGetInviteFunnelAdmin({
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
      const response = await analyticsGetContractStatusHistoryAdmin({
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
    [actionStats],
  );

  const platformTenureMaxAssigned = useMemo(() => {
    return Math.max(
      max(
        platformTenureCohort?.actions ?? [],
        (action) => action.assignedCount,
      ) ?? 0,
      1,
    );
  }, [platformTenureCohort]);

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
    const maxTotalExpected = max(chartActionStats, (d) => d.usersJoined) ?? 0;
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

  // Cumulative average completion rate data.
  const cumulativeCompletionData = useMemo(() => {
    const now = new Date();
    const completedActions = actionStats
      .filter(
        (a) =>
          a.memberActionEndDate &&
          a.showInChart &&
          !a.onboarding &&
          !a.optional,
      )
      .map((a) => ({
        ...a,
        endDate: new Date(a.memberActionEndDate!),
      }))
      .filter((a) => a.endDate <= now)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

    if (completedActions.length === 0) return [];

    const rangeStart = parseLocalDateInput(completionRateRange.start);
    const rangeEnd = parseLocalDateInput(completionRateRange.end, true);
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      return [];
    }

    const dataPoints: {
      date: Date;
      avgRate: number;
      actionCount: number;
      actionNames: string[];
      dayKey: string;
    }[] = [];
    let runningSum = 0;
    let count = 0;

    for (const action of completedActions) {
      if (action.endDate < rangeStart) {
        runningSum += action.completionRate;
        count += 1;
        continue;
      }
      if (action.endDate > rangeEnd) break;

      runningSum += action.completionRate;
      count += 1;
      const dayKey = formatDateAsLocal(action.endDate);
      const existingPoint = dataPoints[dataPoints.length - 1];

      if (existingPoint && existingPoint.dayKey === dayKey) {
        // Keep one visual point per day, but preserve cumulative value
        // after all same-day actions have been included.
        existingPoint.date = action.endDate;
        existingPoint.avgRate = runningSum / count;
        existingPoint.actionCount = count;
        existingPoint.actionNames.push(action.actionName);
        continue;
      }

      dataPoints.push({
        date: action.endDate,
        avgRate: runningSum / count,
        actionCount: count,
        actionNames: [action.actionName],
        dayKey,
      });
    }

    return dataPoints.map(({ dayKey: _dayKey, ...point }) => point);
  }, [actionStats, completionRateRange]);

  const cumulativeCompletionChartData: DataPoint[] = useMemo(() => {
    return cumulativeCompletionData.map((d) => ({
      date: d.date,
      avgRate: d.avgRate,
      actionCount: d.actionCount,
      actionNames: d.actionNames,
    }));
  }, [cumulativeCompletionData]);

  const cumulativeCompletionYDomain = useMemo(() => {
    if (completionRateAbsolute) {
      return [0, 1] as [number, number];
    }
    const values = cumulativeCompletionChartData
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
  }, [completionRateAbsolute, cumulativeCompletionChartData]);

  const cumulativeCompletionSeries: ChartSeries[] = useMemo(
    () => [
      {
        key: "avgRate",
        label: "Avg Rate",
        color: "#15803d",
        getValue: (d) => (d.avgRate as number) ?? 0,
      },
    ],
    [],
  );

  // Weekly (non-cumulative) completion rate data.
  const weeklyCompletionData = useMemo(() => {
    const now = new Date();
    const rangeStart = parseLocalDateInput(completionRateRange.start);
    const rangeEnd = parseLocalDateInput(completionRateRange.end, true);
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      return [];
    }

    const weeklyBuckets = new Map<
      string,
      {
        date: Date;
        actionCount: number;
        completedCount: number;
        joinedCount: number;
        actionNames: string[];
      }
    >();
    for (const action of actionStats) {
      if (
        !action.memberActionEndDate ||
        !action.showInChart ||
        action.onboarding ||
        action.optional
      ) {
        continue;
      }
      const endDate = parseIsoDate(action.memberActionEndDate);
      if (!endDate || endDate < rangeStart || endDate > rangeEnd) {
        continue;
      }

      const weekStart = getWeekStartDate(endDate);
      const bucketKey = formatDateAsLocal(weekStart);
      const existingBucket = weeklyBuckets.get(bucketKey) ?? {
        date: weekStart,
        actionCount: 0,
        completedCount: 0,
        joinedCount: 0,
        actionNames: [],
      };
      if (endDate > now) {
        continue;
      }

      existingBucket.actionCount += 1;
      existingBucket.completedCount += Math.max(0, action.usersCompleted);
      existingBucket.joinedCount += Math.max(0, action.usersJoined);
      existingBucket.actionNames.push(action.actionName);
      weeklyBuckets.set(bucketKey, existingBucket);
    }

    return Array.from(weeklyBuckets.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((bucket) => ({
        date: bucket.date,
        weekRate:
          bucket.joinedCount > 0
            ? bucket.completedCount / bucket.joinedCount
            : 0,
        actionCount: bucket.actionCount,
        completedCount: bucket.completedCount,
        joinedCount: bucket.joinedCount,
        actionNames: bucket.actionNames.sort((a, b) => a.localeCompare(b)),
      }));
  }, [actionStats, completionRateRange]);

  const completionRateChartData: DataPoint[] = useMemo(() => {
    return weeklyCompletionData.map((d) => ({
      date: d.date,
      weekRate: d.weekRate,
      actionCount: d.actionCount,
      completedCount: d.completedCount,
      joinedCount: d.joinedCount,
      actionNames: d.actionNames,
    }));
  }, [weeklyCompletionData]);

  const completionRateYDomain = useMemo(() => {
    if (completionRateAbsolute) {
      return [0, 1] as [number, number];
    }
    const values = completionRateChartData
      .map((d) => d.weekRate)
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
        key: "weekRate",
        label: "Weekly Rate",
        color: "#16a34a",
        getValue: (d) => (d.weekRate as number) ?? 0,
      },
    ],
    [],
  );

  const filteredReminderGroupClickRatePoints = useMemo(() => {
    const start = parseIsoDate(reminderClickRateRange.start);
    const end = parseIsoDate(reminderClickRateRange.end);
    if (!start || !end) {
      return reminderGroupClickRatePoints;
    }
    if (start > end) {
      return [];
    }
    const rangeStart = new Date(start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end);
    rangeEnd.setHours(23, 59, 59, 999);

    return reminderGroupClickRatePoints.filter(
      (point) => point.date >= rangeStart && point.date <= rangeEnd,
    );
  }, [reminderGroupClickRatePoints, reminderClickRateRange]);

  const reminderActionAggregates = useMemo(() => {
    const byAction = new Map<
      number,
      {
        actionId: number;
        actionName: string;
        mostRecentDateMs: number;
        emailGroupCount: number;
        emailSentCount: number;
        emailClickedCount: number;
        textGroupCount: number;
        textSentCount: number;
        textClickedCount: number;
      }
    >();

    for (const point of filteredReminderGroupClickRatePoints) {
      const existing = byAction.get(point.actionId) ?? {
        actionId: point.actionId,
        actionName: point.actionName,
        mostRecentDateMs: point.date.getTime(),
        emailGroupCount: 0,
        emailSentCount: 0,
        emailClickedCount: 0,
        textGroupCount: 0,
        textSentCount: 0,
        textClickedCount: 0,
      };

      existing.mostRecentDateMs = Math.max(
        existing.mostRecentDateMs,
        point.date.getTime(),
      );

      if (point.emailSentCount > 0) {
        existing.emailGroupCount += 1;
        existing.emailSentCount += point.emailSentCount;
        existing.emailClickedCount += point.emailClickedCount;
      }
      if (point.textSentCount > 0) {
        existing.textGroupCount += 1;
        existing.textSentCount += point.textSentCount;
        existing.textClickedCount += point.textClickedCount;
      }

      byAction.set(point.actionId, existing);
    }

    return Array.from(byAction.values()).sort((a, b) => {
      if (a.mostRecentDateMs !== b.mostRecentDateMs) {
        return a.mostRecentDateMs - b.mostRecentDateMs;
      }
      return a.actionName.localeCompare(b.actionName);
    });
  }, [filteredReminderGroupClickRatePoints]);

  const emailReminderActionBars = useMemo<ReminderActionChannelBar[]>(
    () =>
      reminderActionAggregates
        .filter((aggregate) => aggregate.emailGroupCount > 0)
        .map((aggregate) => ({
          actionId: aggregate.actionId,
          actionName: aggregate.actionName,
          averageRate:
            aggregate.emailSentCount > 0
              ? aggregate.emailClickedCount / aggregate.emailSentCount
              : 0,
          reminderGroupCount: aggregate.emailGroupCount,
          sentCount: aggregate.emailSentCount,
          clickedCount: aggregate.emailClickedCount,
        })),
    [reminderActionAggregates],
  );

  const textReminderActionBars = useMemo<ReminderActionChannelBar[]>(
    () =>
      reminderActionAggregates
        .filter((aggregate) => aggregate.textGroupCount > 0)
        .map((aggregate) => ({
          actionId: aggregate.actionId,
          actionName: aggregate.actionName,
          averageRate:
            aggregate.textSentCount > 0
              ? aggregate.textClickedCount / aggregate.textSentCount
              : 0,
          reminderGroupCount: aggregate.textGroupCount,
          sentCount: aggregate.textSentCount,
          clickedCount: aggregate.textClickedCount,
        })),
    [reminderActionAggregates],
  );

  const buildReminderActionBarGeometry = useCallback(
    (bars: ReminderActionChannelBar[]) => {
      if (bars.length === 0) return null;

      const width = Math.max(900, bars.length * 88 + 120);
      const height = 420;
      const margin = { top: 20, right: 24, bottom: 86, left: 64 };

      const xScale = scaleBand<string>()
        .domain(bars.map((_, index) => String(index)))
        .range([margin.left, width - margin.right])
        .paddingInner(0.2)
        .paddingOuter(0.08);

      const yScale = scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

      const yTicks = yScale.ticks(5);
      const maxXTicks = 10;
      const xTickStep = Math.max(1, Math.ceil(bars.length / maxXTicks));
      const xTickIndexes = bars
        .map((_, index) => index)
        .filter(
          (index) => index % xTickStep === 0 || index === bars.length - 1,
        );

      return {
        width,
        height,
        margin,
        xScale,
        yScale,
        yTicks,
        xTickIndexes,
      };
    },
    [],
  );

  const emailReminderBarGeometry = useMemo(
    () => buildReminderActionBarGeometry(emailReminderActionBars),
    [buildReminderActionBarGeometry, emailReminderActionBars],
  );

  const textReminderBarGeometry = useMemo(
    () => buildReminderActionBarGeometry(textReminderActionBars),
    [buildReminderActionBarGeometry, textReminderActionBars],
  );

  const sortedRetentionCohorts = useMemo(() => {
    return retentionCohorts
      .map((cohort) => ({
        ...cohort,
        points: [...cohort.points].sort((a, b) => a.weekIndex - b.weekIndex),
      }))
      .sort(
        (a, b) =>
          new Date(a.cohortStart).getTime() - new Date(b.cohortStart).getTime(),
      );
  }, [retentionCohorts]);

  const filteredRetentionCohorts = useMemo(() => {
    return sortedRetentionCohorts.filter((cohort) =>
      cohort.points.some((point) => point.completedCount > 0),
    );
  }, [sortedRetentionCohorts]);

  const retentionChartData = useMemo(() => {
    if (filteredRetentionCohorts.length === 0) {
      return { multiLineData: [], legendGradient: "", cohortMap: new Map() };
    }

    const cohortDates = filteredRetentionCohorts.map((cohort) =>
      new Date(cohort.cohortStart).getTime(),
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
            new Date(cohort.cohortStart),
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
      },
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
      cohort.points.map((point) => point.weekIndex),
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
          new Date(b.cohortStart).getTime() - new Date(a.cohortStart).getTime(),
      )
      .map((cohort) => ({
        cohort,
        pointsByWeek: new Map(
          cohort.points.map((point) => [point.weekIndex, point]),
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

  const parsedContractStatusHistory = useMemo<
    ParsedContractStatusPoint[]
  >(() => {
    return contractStatusHistory.map((point) => ({
      ...point,
      parsedDate: new Date(point.date),
    }));
  }, [contractStatusHistory]);

  const monthlyChurnRate = useMemo(() => {
    const latest =
      parsedContractStatusHistory[parsedContractStatusHistory.length - 1];
    if (!latest) return null;

    const monthAgo = findContractStatusPointDaysAgo(
      parsedContractStatusHistory,
      30,
    );
    if (!monthAgo || monthAgo.activeCount <= 0) return null;

    const churnedInPeriod = Math.max(
      0,
      latest.churnedCount - monthAgo.churnedCount,
    );
    return (churnedInPeriod / monthAgo.activeCount) * 100;
  }, [parsedContractStatusHistory]);

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
        hoveredDate.getTime() - closestPoint.parsedDate.getTime(),
      );

      for (const point of parsedContractStatusHistory) {
        const distance = Math.abs(
          hoveredDate.getTime() - point.parsedDate.getTime(),
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = point;
        }
      }

      setHoveredContractPoint(closestPoint);
    },
    [contractStatusChartGeometry, parsedContractStatusHistory],
  );

  const handleRetentionCellHover = useCallback(
    (
      event: React.MouseEvent<HTMLDivElement, MouseEvent>,
      row: RetentionGridRow,
      week: number,
      point: MemberCompletionRetentionCohortDto["points"][number] | undefined,
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
    [],
  );

  const handleRetentionCellLeave = useCallback(() => {
    setHoveredRetentionCell(null);
  }, []);

  const missedActionGroups = useMemo(() => {
    if (typeof missedActions !== "object" || missedActions === null) {
      return null;
    }
    const stats = missedActions as Record<string, unknown>;
    return [
      {
        title: "Missed last action",
        members: asRecordArray(stats.missedLastAction),
      },
      {
        title: "Missed last two actions",
        members: asRecordArray(stats.missedLastTwoActions),
      },
    ];
  }, [missedActions]);

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
                  {(() => {
                    const filtered = actionStats.filter(
                      (a) => !a.onboarding && !a.optional,
                    );
                    const totalCompleted = filtered.reduce(
                      (sum, a) => sum + a.usersCompleted,
                      0,
                    );
                    const totalAssigned = filtered.reduce(
                      (sum, a) => sum + a.usersJoined,
                      0,
                    );
                    return totalAssigned > 0
                      ? ((totalCompleted / totalAssigned) * 100).toFixed(2)
                      : "[No data]";
                  })()}
                  %
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-sm text-gray-600">All-time churn</div>
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
              <div className="flex flex-col">
                <div className="text-sm text-gray-600">Last month churn</div>
                <div className="text-3xl font-bold text-gray-900">
                  {monthlyChurnRate !== null
                    ? monthlyChurnRate.toFixed(1)
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

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              Recent missed actions
            </h3>
            <p className="text-xs text-gray-500">
              Active members whose most recent completed non-optional action was
              missed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadMissedActions}
            disabled={missedActionsLoading}
            className="rounded-md bg-green px-4 py-2 text-sm text-white shadow hover:bg-green-2 disabled:opacity-50"
          >
            {missedActionsLoading ? "Loading..." : "View actions"}
          </button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {!missedActionsRequested ? null : missedActionsLoading &&
            !missedActions ? (
            <p className="text-sm text-gray-600">Loading missed actions...</p>
          ) : missedActionGroups ? (
            missedActionGroups.map(({ title, members }) => (
              <div
                key={title}
                className="rounded-md border border-gray-200 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {title}
                  </h4>
                  <span className="text-3xl font-bold text-gray-900">
                    {members.length}
                  </span>
                </div>
                {members.length > 0 ? (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                    {members.map((member) => (
                      <li
                        key={String(member.userId)}
                        className="flex justify-between gap-3"
                      >
                        <a
                          href={`/member/${String(member.userId)}`}
                          className="min-w-0 truncate text-link hover:underline"
                        >
                          {String(member.name)}
                        </a>
                        <span className="shrink-0 text-xs text-gray-500">
                          {String(member.lastActionName)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No members.</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">
              Unable to load missed actions.
            </p>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              Action Completion and Churn After Joining
            </h3>
            <p className="text-xs text-gray-500">
              Members who first joined exactly N weeks ago
            </p>
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleApplyPlatformTenureCohort();
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                Weeks after joining
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={platformTenureWeeksInput}
                onChange={(event) =>
                  setPlatformTenureWeeksInput(event.target.value)
                }
                className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </label>
            <button
              type="submit"
              disabled={platformTenureCohortLoading}
              className="rounded-md bg-green px-4 py-2 text-sm text-white shadow hover:bg-green-2 disabled:opacity-50"
            >
              {platformTenureCohortLoading ? "Loading..." : "View cohort"}
            </button>
          </form>
        </div>
        <div className="p-4">
          {platformTenureCohortError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {platformTenureCohortError}
            </div>
          )}
          {platformTenureCohortLoading && !platformTenureCohort ? (
            <p className="text-sm text-gray-600">Loading cohort...</p>
          ) : platformTenureCohort ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Cohort size
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {platformTenureCohort.cohortSize}
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Action completion
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {(platformTenureCohort.completionRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Churn rate
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {(platformTenureCohort.churnRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Active / churned
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {platformTenureCohort.activeCount} /{" "}
                    {platformTenureCohort.churnedCount}
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Completed
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {platformTenureCohort.completedCount}
                  </div>
                </div>
                <div className="rounded-md border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Assigned
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {platformTenureCohort.assignedCount}
                  </div>
                </div>
              </div>

              {platformTenureCohort.actions.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No assigned reliability actions for this cohort.
                </p>
              ) : (
                <div className="space-y-2">
                  {platformTenureCohort.actions.slice(0, 12).map((action) => {
                    const assignedWidth =
                      (action.assignedCount / platformTenureMaxAssigned) * 100;
                    const completedWidth =
                      action.assignedCount > 0
                        ? (action.completedCount / action.assignedCount) *
                          assignedWidth
                        : 0;
                    return (
                      <div
                        key={action.actionId}
                        className="grid gap-2 text-sm md:grid-cols-[220px_1fr_120px]"
                      >
                        <div className="truncate text-gray-700">
                          {action.actionName}
                        </div>
                        <div className="relative h-6 overflow-hidden rounded bg-gray-100">
                          <div
                            className="absolute inset-y-0 left-0 bg-gray-200"
                            style={{ width: `${assignedWidth}%` }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 bg-green-600"
                            style={{ width: `${completedWidth}%` }}
                          />
                        </div>
                        <div className="text-right text-gray-600">
                          {action.completedCount}/{action.assignedCount} (
                          {(action.completionRate * 100).toFixed(0)}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">
              Member Reliability by Assignment Week
            </h3>
            <p className="text-xs text-gray-500">
              Completed actions only. New members begin with the first
              member-action week after signing.
            </p>
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleApplyMemberReliabilityWindow();
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">
                Completed action weeks
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={memberReliabilityWeeksInput}
                onChange={(event) =>
                  setMemberReliabilityWeeksInput(event.target.value)
                }
                className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </label>
            <button
              type="submit"
              disabled={memberReliabilityLoading}
              className="rounded-md bg-green px-4 py-2 text-sm text-white shadow hover:bg-green-2 disabled:opacity-50"
            >
              {memberReliabilityLoading ? "Loading..." : "View reliability"}
            </button>
          </form>
        </div>
        <div className="p-4">
          {memberReliabilityError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {memberReliabilityError}
            </div>
          )}
          {memberReliabilityLoading && !memberReliabilityWindow ? (
            <p className="text-sm text-gray-600">Loading reliability...</p>
          ) : memberReliabilityWindow ? (
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  [
                    "First assigned week",
                    "Members' first week of assigned actions across the selected weeks.",
                    memberReliabilityWindow.firstWeek,
                  ],
                  [
                    "Fourth assigned week or later",
                    "Actions taken in the selected weeks by members on assignment week four or beyond.",
                    memberReliabilityWindow.fourthWeekOrLater,
                  ],
                ] as const
              ).map(([title, description, rate]) => (
                <div
                  key={title}
                  className="rounded-md border border-gray-200 p-4"
                >
                  <div className="text-sm font-semibold text-gray-900">
                    {title}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{description}</p>
                  <div className="mt-3 text-3xl font-bold text-gray-900">
                    {(rate.completionRate * 100).toFixed(1)}%
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {rate.completedCount} completed / {rate.assignedCount}{" "}
                    assigned
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

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
                              100,
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
                        hoveredContractPoint.parsedDate,
                      )}
                      x2={contractStatusChartGeometry.xScale(
                        hoveredContractPoint.parsedDate,
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
                          hoveredContractPoint.parsedDate,
                        ) + 12,
                        contractStatusChartGeometry.width - 130,
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
                          hoveredContractPoint.parsedDate,
                        ) + 24,
                        contractStatusChartGeometry.width - 118,
                      )}
                      y={contractStatusChartGeometry.margin.top + 31}
                      className="fill-black text-sm font-semibold"
                    >
                      {hoveredContractPoint.totalEverSigned > 0
                        ? `${Math.round(
                            (hoveredContractPoint.churnedCount /
                              hoveredContractPoint.totalEverSigned) *
                              100,
                          )}% churn`
                        : "0% churn"}
                    </text>
                    <text
                      x={Math.min(
                        contractStatusChartGeometry.xScale(
                          hoveredContractPoint.parsedDate,
                        ) + 24,
                        contractStatusChartGeometry.width - 118,
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
              className="px-4 py-2 rounded-md text-sm bg-green text-white shadow hover:bg-green-2"
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
            className="px-4 py-2 rounded-md text-sm bg-green text-white shadow hover:bg-green-2 disabled:opacity-50"
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
                      className={cn(
                        "text-xs",
                        isHovered
                          ? "fill-gray-900 font-semibold"
                          : "fill-gray-700",
                      )}
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
                            4,
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
                          4,
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
                          completedWidth + withdrawnWidth,
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
                    {hoveredActionBar.action.usersJoined > 0
                      ? `${Math.round(
                          (hoveredActionBar.action.usersCompleted /
                            hoveredActionBar.action.usersJoined) *
                            100,
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
        title="Cumulative Completion Rate"
        data={cumulativeCompletionChartData}
        series={cumulativeCompletionSeries}
        loading={actionStatsLoading}
        emptyMessage="No completed actions in this date range."
        showArea
        areaSeriesKey="avgRate"
        areaColor="rgba(21, 128, 61, 0.14)"
        yDomain={cumulativeCompletionYDomain}
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
          items: (() => {
            const actionNames =
              (point.actionNames as string[] | undefined) ?? [];
            const actionItems = actionNames.map((name, index) => ({
              label: `Action ${index + 1}`,
              value:
                name.length > 40 ? `${name.slice(0, 40).trimEnd()}...` : name,
            }));
            return [
              {
                label: "Avg Rate",
                value: `${((point.avgRate as number) * 100).toFixed(2)}%`,
                color: "#15803d",
              },
              {
                label: "Total Actions",
                value: point.actionCount as number,
              },
              ...actionItems,
            ];
          })(),
        })}
      />

      {/* Weekly (non-cumulative) completion rate chart */}
      <TimeSeriesChart
        title="Non-Cumulative Completion Rate (Weekly)"
        data={completionRateChartData}
        series={completionRateSeries}
        loading={actionStatsLoading}
        emptyMessage="No completed actions in this date range."
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
          title: `Week of ${fullDateFormatter.format(point.date)}`,
          items: (() => {
            const actionNames =
              (point.actionNames as string[] | undefined) ?? [];
            const actionItems = actionNames.map((name, index) => ({
              label: `Action ${index + 1}`,
              value:
                name.length > 40 ? `${name.slice(0, 40).trimEnd()}...` : name,
            }));
            return [
              {
                label: "Weekly Rate",
                value: `${((point.weekRate as number) * 100).toFixed(2)}%`,
                color: "#16a34a",
              },
              {
                label: "Actions",
                value: point.actionCount as number,
              },
              {
                label: "Completed / Joined",
                value: `${point.completedCount as number}/${
                  point.joinedCount as number
                }`,
              },
              ...actionItems,
            ];
          })(),
        })}
      />

      <div className="relative overflow-hidden rounded border border-gray-200 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Reminder Link Click Rate by Action
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">
                From
              </label>
              <input
                type="date"
                value={reminderClickRateRange.start}
                onChange={(event) =>
                  setReminderClickRateRange((prev) => ({
                    ...prev,
                    start: event.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">To</label>
              <input
                type="date"
                value={reminderClickRateRange.end}
                onChange={(event) =>
                  setReminderClickRateRange((prev) => ({
                    ...prev,
                    end: event.target.value,
                  }))
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
              />
            </div>
          </div>
        </div>
        <div className="relative p-4">
          {reminderGroupClickRatesLoading &&
            filteredReminderGroupClickRatePoints.length === 0 && (
              <p className="text-sm text-gray-600">Loading...</p>
            )}
          {!reminderGroupClickRatesLoading &&
            filteredReminderGroupClickRatePoints.length === 0 && (
              <p className="text-sm text-gray-600">
                No sent reminder groups with email/text link clicks in this date
                range.
              </p>
            )}
          {filteredReminderGroupClickRatePoints.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="rounded border border-gray-200 bg-white">
                <div className="px-3 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Email Click Rate (Avg by Action)
                  </h4>
                </div>
                <div className="p-3">
                  {!emailReminderBarGeometry ||
                  emailReminderActionBars.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      No emailed reminder data in this range.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <svg
                        viewBox={`0 0 ${emailReminderBarGeometry.width} ${emailReminderBarGeometry.height}`}
                        className="w-full min-w-[900px]"
                        onMouseLeave={() => setHoveredReminderActionBar(null)}
                      >
                        <g>
                          {emailReminderBarGeometry.yTicks.map((tick) => (
                            <g key={`email-action-y-${tick}`}>
                              <line
                                x1={emailReminderBarGeometry.margin.left}
                                x2={
                                  emailReminderBarGeometry.width -
                                  emailReminderBarGeometry.margin.right
                                }
                                y1={emailReminderBarGeometry.yScale(tick)}
                                y2={emailReminderBarGeometry.yScale(tick)}
                                stroke="#e5e7eb"
                                strokeDasharray="4 6"
                              />
                              <text
                                x={emailReminderBarGeometry.margin.left - 12}
                                y={emailReminderBarGeometry.yScale(tick)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                className="fill-gray-500 text-base"
                              >
                                {Math.round(tick * 100)}%
                              </text>
                            </g>
                          ))}
                          {emailReminderBarGeometry.xTickIndexes.map(
                            (index) => {
                              const x = emailReminderBarGeometry.xScale(
                                String(index),
                              );
                              if (x === undefined) return null;
                              const action = emailReminderActionBars[index];
                              const label =
                                action.actionName.length > 16
                                  ? `${action.actionName.slice(0, 16)}...`
                                  : action.actionName;
                              return (
                                <text
                                  key={`email-action-x-${action.actionId}`}
                                  x={
                                    x +
                                    emailReminderBarGeometry.xScale.bandwidth() /
                                      2
                                  }
                                  y={
                                    emailReminderBarGeometry.height -
                                    emailReminderBarGeometry.margin.bottom +
                                    24
                                  }
                                  textAnchor="middle"
                                  className="fill-gray-600 text-xs"
                                >
                                  {label}
                                </text>
                              );
                            },
                          )}
                        </g>

                        {emailReminderActionBars.map((bar, index) => {
                          const x = emailReminderBarGeometry.xScale(
                            String(index),
                          );
                          if (x === undefined) return null;
                          const y = emailReminderBarGeometry.yScale(
                            Math.max(0, Math.min(1, bar.averageRate)),
                          );
                          const barBottom =
                            emailReminderBarGeometry.height -
                            emailReminderBarGeometry.margin.bottom;
                          return (
                            <rect
                              key={`email-action-bar-${bar.actionId}`}
                              x={x}
                              y={y}
                              width={emailReminderBarGeometry.xScale.bandwidth()}
                              height={Math.max(0, barBottom - y)}
                              fill="#2563eb"
                              rx={3}
                              className="cursor-pointer"
                              onMouseEnter={() =>
                                setHoveredReminderActionBar({
                                  bar,
                                  channel: "email",
                                })
                              }
                            />
                          );
                        })}
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded border border-gray-200 bg-white">
                <div className="px-3 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Text Click Rate (Avg by Action)
                  </h4>
                </div>
                <div className="p-3">
                  {!textReminderBarGeometry ||
                  textReminderActionBars.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      No texted reminder data in this range.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <svg
                        viewBox={`0 0 ${textReminderBarGeometry.width} ${textReminderBarGeometry.height}`}
                        className="w-full min-w-[900px]"
                        onMouseLeave={() => setHoveredReminderActionBar(null)}
                      >
                        <g>
                          {textReminderBarGeometry.yTicks.map((tick) => (
                            <g key={`text-action-y-${tick}`}>
                              <line
                                x1={textReminderBarGeometry.margin.left}
                                x2={
                                  textReminderBarGeometry.width -
                                  textReminderBarGeometry.margin.right
                                }
                                y1={textReminderBarGeometry.yScale(tick)}
                                y2={textReminderBarGeometry.yScale(tick)}
                                stroke="#e5e7eb"
                                strokeDasharray="4 6"
                              />
                              <text
                                x={textReminderBarGeometry.margin.left - 12}
                                y={textReminderBarGeometry.yScale(tick)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                className="fill-gray-500 text-base"
                              >
                                {Math.round(tick * 100)}%
                              </text>
                            </g>
                          ))}
                          {textReminderBarGeometry.xTickIndexes.map((index) => {
                            const x = textReminderBarGeometry.xScale(
                              String(index),
                            );
                            if (x === undefined) return null;
                            const action = textReminderActionBars[index];
                            const label =
                              action.actionName.length > 16
                                ? `${action.actionName.slice(0, 16)}...`
                                : action.actionName;
                            return (
                              <text
                                key={`text-action-x-${action.actionId}`}
                                x={
                                  x +
                                  textReminderBarGeometry.xScale.bandwidth() / 2
                                }
                                y={
                                  textReminderBarGeometry.height -
                                  textReminderBarGeometry.margin.bottom +
                                  24
                                }
                                textAnchor="middle"
                                className="fill-gray-600 text-xs"
                              >
                                {label}
                              </text>
                            );
                          })}
                        </g>

                        {textReminderActionBars.map((bar, index) => {
                          const x = textReminderBarGeometry.xScale(
                            String(index),
                          );
                          if (x === undefined) return null;
                          const y = textReminderBarGeometry.yScale(
                            Math.max(0, Math.min(1, bar.averageRate)),
                          );
                          const barBottom =
                            textReminderBarGeometry.height -
                            textReminderBarGeometry.margin.bottom;
                          return (
                            <rect
                              key={`text-action-bar-${bar.actionId}`}
                              x={x}
                              y={y}
                              width={textReminderBarGeometry.xScale.bandwidth()}
                              height={Math.max(0, barBottom - y)}
                              fill="#ea580c"
                              rx={3}
                              className="cursor-pointer"
                              onMouseEnter={() =>
                                setHoveredReminderActionBar({
                                  bar,
                                  channel: "text",
                                })
                              }
                            />
                          );
                        })}
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hoveredReminderActionBar && (
            <div className="absolute right-4 top-4 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[250px] pointer-events-none">
              <p className="font-semibold text-gray-900 max-w-[260px]">
                {hoveredReminderActionBar.bar.actionName}
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Channel</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {hoveredReminderActionBar.channel}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Click rate</span>
                  <span
                    className={cn(
                      "font-medium",
                      hoveredReminderActionBar.channel === "email"
                        ? "text-blue-600"
                        : "text-orange-600",
                    )}
                  >
                    {Math.round(hoveredReminderActionBar.bar.averageRate * 100)}
                    %
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">
                    Reminder groups averaged
                  </span>
                  <span className="font-medium text-gray-900">
                    {hoveredReminderActionBar.bar.reminderGroupCount}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Clicked / Sent</span>
                  <span className="font-medium text-gray-900">
                    {hoveredReminderActionBar.bar.clickedCount}/
                    {hoveredReminderActionBar.bar.sentCount}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-gray-100 pt-1 mt-1">
                  <span className="text-gray-600">Action ID</span>
                  <span className="font-medium text-gray-900">
                    {hoveredReminderActionBar.bar.actionId}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
            new Date(`${point.cohortStart}T00:00:00Z`),
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
                        `${row.cohort.cohortStart}T00:00:00Z`,
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
                                    point,
                                  )
                                }
                                onMouseMove={(event) =>
                                  handleRetentionCellHover(
                                    event,
                                    row,
                                    week,
                                    point,
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
                              `${hoveredRetentionCell.actionStartDate}T00:00:00Z`,
                            ),
                          )}
                        </p>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Cohort: Week of{" "}
                        {fullDateFormatter.format(
                          new Date(
                            `${hoveredRetentionCell.cohortStart}T00:00:00Z`,
                          ),
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
                    2,
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
            className={cn(
              "w-5 h-5 text-gray-500 transition-transform",
              dailyStatsTableOpen && "rotate-180",
            )}
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
              className={cn(
                "w-5 h-5 text-gray-500 transition-transform",
                actionStatsTableOpen && "rotate-180",
              )}
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
                              action.memberActionStartDate,
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

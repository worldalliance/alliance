/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import {
  analyticsGetMemberCompletionRetentionAdmin,
  analyticsGetTimeToChurnSamplesAdmin,
} from "@alliance/shared/client";
import {
  DailyStatsDto,
  MemberCompletionRetentionCohortDto,
  TimeToChurnSampleDto,
} from "@alliance/shared/client/types.gen";
import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { cn } from "@alliance/shared/styles/util";
import chroma from "chroma-js";
import { bin, max, min, range, scaleBand, scaleLinear } from "d3";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ActionCompletionCurveChart from "../components/ActionCompletionCurveChart";
import ActionCompletionBarsChart from "../components/stats/ActionCompletionBarsChart";
import AggregateStatsCard from "../components/stats/AggregateStatsCard";
import CompletionRateCharts from "../components/stats/CompletionRateCharts";
import { type ParsedContractStatusPoint } from "../components/stats/contractStatusHistory";
import InviteFunnelCard from "../components/stats/InviteFunnelCard";
import MemberReliabilityCard from "../components/stats/MemberReliabilityCard";
import MembersOverTimeChart from "../components/stats/MembersOverTimeChart";
import MissedActionsCard from "../components/stats/MissedActionsCard";
import { parseIsoDate } from "../components/stats/parseIsoDate";
import PlatformTenureCohortCard from "../components/stats/PlatformTenureCohortCard";
import {
  TimeSeriesChart,
  fullDateFormatter,
  type MultiLineSeries,
} from "../components/TimeSeriesChart";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionStats } from "../lib/useActionStats";
import { useContractStatusHistoryAdmin } from "../lib/useContractStatusHistoryAdmin";
import { useDailyStatsAdmin } from "../lib/useDailyStatsAdmin";
import { useReminderGroupClickRatesAdmin } from "../lib/useReminderGroupClickRatesAdmin";

type ParsedDailyStats = DailyStatsDto & { parsedDate: Date };
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

const getDefaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    start: dateToInputValue(start),
    end: dateToInputValue(end),
  };
};

const invalidRangeMessage = (range: {
  start: string;
  end: string;
}): string | null => {
  const parsedStart = new Date(range.start);
  const parsedEnd = new Date(range.end);

  if (
    Number.isNaN(parsedStart.getTime()) ||
    Number.isNaN(parsedEnd.getTime())
  ) {
    return "Please provide valid start and end dates.";
  }

  if (parsedStart > parsedEnd) {
    return "Start date must be before the end date.";
  }

  return null;
};

const StatsPage: React.FC = () => {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [startInput, setStartInput] = useState<string>(defaultRange.start);
  const [endInput, setEndInput] = useState<string>(defaultRange.end);
  const [queryRange, setQueryRange] = useState(defaultRange);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [retentionCohorts, setRetentionCohorts] = useState<
    MemberCompletionRetentionCohortDto[]
  >([]);
  const [retentionLoading, setRetentionLoading] = useState<boolean>(false);
  const [hoveredReminderActionBar, setHoveredReminderActionBar] =
    useState<HoveredReminderActionBar | null>(null);
  const [timeToChurnSamples, setTimeToChurnSamples] = useState<
    TimeToChurnSampleDto[]
  >([]);
  const [timeToChurnLoading, setTimeToChurnLoading] = useState<boolean>(false);
  const [dailyStatsTableOpen, setDailyStatsTableOpen] = useState(false);
  const [actionStatsTableOpen, setActionStatsTableOpen] = useState(false);
  const [weekRange, setWeekRange] = useState({ min: 0, max: 20 });
  const [reminderClickRateRange, setReminderClickRateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    return {
      start: dateToInputValue(start),
      end: dateToInputValue(end),
    };
  });
  const [contractStatusRange, setContractStatusRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    return {
      start: dateToInputValue(start),
      end: dateToInputValue(end),
    };
  });

  const retentionGridRef = useRef<HTMLDivElement | null>(null);
  const [hoveredRetentionCell, setHoveredRetentionCell] =
    useState<HoveredRetentionCell | null>(null);

  const {
    data: stats = [],
    isPending: loading,
    error: statsError,
  } = useDailyStatsAdmin(queryRange);
  const error =
    rangeError ??
    (statsError &&
      adminRefusalMessage(
        statsError,
        "Unable to load analytics right now. Please try again soon.",
      ));

  const {
    stats: {
      data: actionStats = [],
      isPending: actionStatsPending,
      isError: actionStatsLoadFailed,
    },
    recalculate: recalculateActionStats,
  } = useActionStats();
  const actionStatsLoading =
    actionStatsPending || recalculateActionStats.isPending;

  const {
    data: reminderGroupClickRatePoints = [],
    isPending: reminderGroupClickRatesLoading,
    isError: reminderGroupClickRatesLoadFailed,
  } = useReminderGroupClickRatesAdmin();

  const {
    data: contractStatusHistory = [],
    isPending: contractStatusPending,
    isPlaceholderData: contractStatusPlaceholder,
    error: contractStatusError,
  } = useContractStatusHistoryAdmin(contractStatusRange);
  const contractStatusLoading =
    contractStatusPending || contractStatusPlaceholder;

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

  useEffect(() => {
    void loadRetentionCohorts();
  }, [loadRetentionCohorts]);

  useEffect(() => {
    void loadTimeToChurnSamples();
  }, [loadTimeToChurnSamples]);

  const parsedStats = useMemo<ParsedDailyStats[]>(() => {
    return stats
      .map((record) => ({
        ...record,
        parsedDate: new Date(record.date),
      }))
      .filter((record) => !Number.isNaN(record.parsedDate.getTime()));
  }, [stats]);

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

  const handleApplyRange = useCallback(() => {
    const range = { start: startInput, end: endInput };
    const invalid = invalidRangeMessage(range);
    setRangeError(invalid);
    if (!invalid) setQueryRange(range);
  }, [endInput, startInput]);

  const handleQuickRange = useCallback((days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const startValue = dateToInputValue(start);
    const endValue = dateToInputValue(end);
    setStartInput(startValue);
    setEndInput(endValue);
    setRangeError(null);
    setQueryRange({ start: startValue, end: endValue });
  }, []);

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

  return (
    <div className="p-6 md:p-8 space-y-6 text-gray-900 mx-auto">
      <AggregateStatsCard
        actionStats={actionStats}
        parsedContractStatusHistory={parsedContractStatusHistory}
      />

      <MissedActionsCard />

      <PlatformTenureCohortCard />

      <MemberReliabilityCard />

      <InviteFunnelCard />

      <MembersOverTimeChart
        parsedContractStatusHistory={parsedContractStatusHistory}
        contractStatusLoading={contractStatusLoading}
        contractStatusError={contractStatusError}
        contractStatusRange={contractStatusRange}
        setContractStatusRange={setContractStatusRange}
      />

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
      {!loading && !statsError && parsedStats.length === 0 && (
        <p className="text-sm text-gray-600">No daily stats for this range.</p>
      )}

      <ActionCompletionBarsChart
        actionStats={actionStats}
        actionStatsLoading={actionStatsLoading}
        actionStatsLoadFailed={actionStatsLoadFailed}
        recalculateActionStats={recalculateActionStats}
      />

      {/* Action Completion Curves */}
      <ActionCompletionCurveChart />

      <CompletionRateCharts
        actionStats={actionStats}
        actionStatsLoading={actionStatsLoading}
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
          {reminderGroupClickRatesLoadFailed && (
            <p className="text-sm text-red-600">
              Unable to load reminder click rates.
            </p>
          )}
          {!reminderGroupClickRatesLoading &&
            !reminderGroupClickRatesLoadFailed &&
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

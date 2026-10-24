/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import { analyticsGetTimeToChurnSamplesAdmin } from "@alliance/shared/client";
import {
  DailyStatsDto,
  TimeToChurnSampleDto,
} from "@alliance/shared/client/types.gen";
import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import { cn } from "@alliance/shared/styles/util";
import { bin, max, range, scaleLinear } from "d3";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ActionCompletionCurveChart from "../components/ActionCompletionCurveChart";
import ActionCompletionBarsChart from "../components/stats/ActionCompletionBarsChart";
import AggregateStatsCard from "../components/stats/AggregateStatsCard";
import CohortRetentionCharts from "../components/stats/CohortRetentionCharts";
import CompletionRateCharts from "../components/stats/CompletionRateCharts";
import { type ParsedContractStatusPoint } from "../components/stats/contractStatusHistory";
import InviteFunnelCard from "../components/stats/InviteFunnelCard";
import MemberReliabilityCard from "../components/stats/MemberReliabilityCard";
import MembersOverTimeChart from "../components/stats/MembersOverTimeChart";
import MissedActionsCard from "../components/stats/MissedActionsCard";
import PlatformTenureCohortCard from "../components/stats/PlatformTenureCohortCard";
import ReminderClickRateCard from "../components/stats/ReminderClickRateCard";
import { fullDateFormatter } from "../components/TimeSeriesChart";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionStats } from "../lib/useActionStats";
import { useContractStatusHistoryAdmin } from "../lib/useContractStatusHistoryAdmin";
import { useDailyStatsAdmin } from "../lib/useDailyStatsAdmin";

type ParsedDailyStats = DailyStatsDto & { parsedDate: Date };
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
  const [timeToChurnSamples, setTimeToChurnSamples] = useState<
    TimeToChurnSampleDto[]
  >([]);
  const [timeToChurnLoading, setTimeToChurnLoading] = useState<boolean>(false);
  const [dailyStatsTableOpen, setDailyStatsTableOpen] = useState(false);
  const [actionStatsTableOpen, setActionStatsTableOpen] = useState(false);
  const [contractStatusRange, setContractStatusRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    return {
      start: dateToInputValue(start),
      end: dateToInputValue(end),
    };
  });

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
    data: contractStatusHistory = [],
    isPending: contractStatusPending,
    isPlaceholderData: contractStatusPlaceholder,
    error: contractStatusError,
  } = useContractStatusHistoryAdmin(contractStatusRange);
  const contractStatusLoading =
    contractStatusPending || contractStatusPlaceholder;

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

      <ReminderClickRateCard />

      <CohortRetentionCharts />

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

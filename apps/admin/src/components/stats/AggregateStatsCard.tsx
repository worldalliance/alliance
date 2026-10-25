// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import { analyticsGetAggregateStatsAdmin } from "@alliance/shared/client";
import {
  ActionStatsWithOnboardingDto,
  AggregateStatsDto,
} from "@alliance/shared/client/types.gen";
import { minutesInHour } from "date-fns/constants";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  monthlyChurnRate as computeMonthlyChurnRate,
  type ParsedContractStatusPoint,
} from "./contractStatusHistory";

const AggregateStatsCard: React.FC<{
  actionStats: ActionStatsWithOnboardingDto[];
  parsedContractStatusHistory: ParsedContractStatusPoint[];
}> = ({ actionStats, parsedContractStatusHistory }) => {
  const [aggregateStats, setAggregateStats] =
    useState<AggregateStatsDto | null>(null);
  const [aggregateStatsLoading, setAggregateStatsLoading] =
    useState<boolean>(false);
  const [assumedHourlyRate, setAssumedHourlyRate] = useState<number>(15);

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

  useEffect(() => {
    void loadAggregateStats();
  }, [loadAggregateStats]);

  const monthlyChurnRate = useMemo(
    () => computeMonthlyChurnRate(parsedContractStatusHistory),
    [parsedContractStatusHistory],
  );

  return aggregateStatsLoading ? (
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
            <div className="text-sm text-gray-600">Completion reliability</div>
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
              {((aggregateStats.signedUsers * 15) / minutesInHour).toFixed(2)}{" "}
              hours / week
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
                ((aggregateStats.signedUsers * 15) / minutesInHour) *
                assumedHourlyRate *
                52
              ).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default AggregateStatsCard;

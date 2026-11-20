import { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { minutesInHour } from "date-fns/constants";
import React, { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useAggregateStatsAdmin } from "../../lib/useAggregateStatsAdmin";
import { inputClass } from "../ui/controlStyles";
import Section from "../ui/Section";
import StatTile from "../ui/StatTile";
import {
  monthlyChurnRate as computeMonthlyChurnRate,
  type ParsedContractStatusPoint,
} from "./contractStatusHistory";

const EXPECTED_MINUTES_PER_MEMBER_WEEK = 15;

const percent = (ratio: number | null, digits: number) =>
  ratio === null ? null : `${(ratio * 100).toFixed(digits)}%`;

const completionReliability = (actionStats: ActionStatsWithOnboardingDto[]) => {
  const counted = actionStats.filter((a) => !a.onboarding && !a.optional);
  const completed = counted.reduce((sum, a) => sum + a.usersCompleted, 0);
  const assigned = counted.reduce((sum, a) => sum + a.usersJoined, 0);
  return assigned > 0 ? completed / assigned : null;
};

const allTimeChurn = (history: ParsedContractStatusPoint[]) => {
  const latest = history.at(-1);
  return latest && latest.totalEverSigned > 0
    ? latest.churnedCount / latest.totalEverSigned
    : null;
};

const AggregateStatsCard: React.FC<{
  actionStats: ActionStatsWithOnboardingDto[];
  parsedContractStatusHistory: ParsedContractStatusPoint[];
}> = ({ actionStats, parsedContractStatusHistory }) => {
  const {
    data: aggregateStats,
    isPending: aggregateStatsLoading,
    error: aggregateStatsError,
  } = useAggregateStatsAdmin();
  const [assumedHourlyRate, setAssumedHourlyRate] = useState<number>(15);

  const monthlyChurnRate = useMemo(
    () => computeMonthlyChurnRate(parsedContractStatusHistory),
    [parsedContractStatusHistory],
  );

  if (aggregateStatsLoading) {
    return <p className="text-sm text-zinc-600">Loading headline stats…</p>;
  }
  if (aggregateStatsError || !aggregateStats) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {adminRefusalMessage(
          aggregateStatsError,
          "Unable to load aggregate stats.",
        )}
      </p>
    );
  }
  const weeklyHours =
    (aggregateStats.signedUsers * EXPECTED_MINUTES_PER_MEMBER_WEEK) /
    minutesInHour;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total members" value={aggregateStats.signedUsers} />
        <StatTile
          label="Completion reliability"
          value={percent(completionReliability(actionStats), 2)}
          hint="Excludes onboarding and optional actions"
        />
        <StatTile
          label="All-time churn"
          value={percent(allTimeChurn(parsedContractStatusHistory), 1)}
        />
        <StatTile
          label="Last month churn"
          value={
            monthlyChurnRate === null ? null : `${monthlyChurnRate.toFixed(1)}%`
          }
        />
      </div>
      <Section
        title="Member time"
        description={`Assumes ${EXPECTED_MINUTES_PER_MEMBER_WEEK} minutes per member per week.`}
        actions={
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Hourly rate ($)
            <input
              type="number"
              value={assumedHourlyRate}
              onChange={(e) => setAssumedHourlyRate(Number(e.target.value))}
              className={cn(inputClass, "w-20")}
            />
          </label>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <StatTile
            label="Total expected weekly member time"
            value={`${weeklyHours.toFixed(2)} hours / week`}
          />
          <StatTile
            label="Annual expected value of member time"
            value={`$${(weeklyHours * assumedHourlyRate * 52).toFixed(2)}`}
            hint={`At $${assumedHourlyRate} / hour`}
          />
        </div>
      </Section>
    </div>
  );
};

export default AggregateStatsCard;

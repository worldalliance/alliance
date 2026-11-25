import type { ActionStatsWithOnboardingDto } from "@alliance/shared/client/types.gen";
import { minutesInHour } from "date-fns/constants";
import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useAggregateStatsAdmin } from "../../lib/useAggregateStatsAdmin";
import { Input } from "../../ui/Input";
import { Skeleton } from "../../ui/Skeleton";
import { Field } from "../../ui/templates/Form";
import { OverviewGrid, Panel, StatTile } from "../../ui/templates/Overview";
import { ContentState, LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { PanelStat } from "./chartParts";
import {
  monthlyChurnRate as computeMonthlyChurnRate,
  type ParsedContractStatusPoint,
} from "./contractStatusHistory";

const EXPECTED_MINUTES_PER_WEEK = 15;
const WEEKS_PER_YEAR = 52;
const NO_VALUE = "—";
const TILE = "col-span-6 @4xl:col-span-3";

const amount = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Completed over joined, leaving out onboarding and optional tasks. */
function completionReliability(actionStats: ActionStatsWithOnboardingDto[]) {
  const counted = actionStats.filter((a) => !a.onboarding && !a.optional);
  const completed = counted.reduce((sum, a) => sum + a.usersCompleted, 0);
  const joined = counted.reduce((sum, a) => sum + a.usersJoined, 0);
  return joined > 0 ? `${((completed / joined) * 100).toFixed(2)}%` : NO_VALUE;
}

function allTimeChurn(history: ParsedContractStatusPoint[]) {
  const latest = history.at(-1);
  if (!latest) return NO_VALUE;
  return latest.totalEverSigned > 0
    ? `${((latest.churnedCount / latest.totalEverSigned) * 100).toFixed(1)}%`
    : "0%";
}

/** The organization's headline numbers, and what members' time is worth. */
export function KeyStats({
  actionStats,
  parsedContractStatusHistory,
}: {
  actionStats: ActionStatsWithOnboardingDto[];
  parsedContractStatusHistory: ParsedContractStatusPoint[];
}) {
  const aggregate = useAggregateStatsAdmin();
  const [hourlyRate, setHourlyRate] = useState(15);
  const monthlyChurn = useMemo(
    () => computeMonthlyChurnRate(parsedContractStatusHistory),
    [parsedContractStatusHistory],
  );
  const members = aggregate.data?.signedUsers ?? 0;
  const weeklyHours = (members * EXPECTED_MINUTES_PER_WEEK) / minutesInHour;

  return (
    <ContentState
      loading={aggregate.isPending}
      skeleton={
        <OverviewGrid>
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} className={`${TILE} h-24 rounded-card`} />
          ))}
          <Skeleton className="col-span-12 h-36 rounded-card" />
        </OverviewGrid>
      }
      error={
        aggregate.isLoadingError
          ? adminRefusalMessage(aggregate.error, LOAD_FAILED_FALLBACK)
          : null
      }
      errorTitle="Couldn't load the organization's stats"
      onRetry={() => void aggregate.refetch()}
      empty={!aggregate.data}
      emptyTitle="No organization stats yet"
    >
      <OverviewGrid>
        <StatTile
          className={TILE}
          label="Total members"
          value={formatCount(members)}
        />
        <StatTile
          className={TILE}
          label="Completion reliability"
          value={completionReliability(actionStats)}
        />
        <StatTile
          className={TILE}
          label="All-time churn"
          value={allTimeChurn(parsedContractStatusHistory)}
        />
        <StatTile
          className={TILE}
          label="Last month churn"
          value={
            monthlyChurn === null ? NO_VALUE : `${monthlyChurn.toFixed(1)}%`
          }
        />
        <Panel
          title="Expected member time"
          description={`${EXPECTED_MINUTES_PER_WEEK} minutes a week from each member`}
          className="col-span-12"
        >
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <PanelStat
              label="Total expected weekly member time"
              value={`${amount(weeklyHours)} hours / week`}
            />
            <PanelStat
              label="Annual expected value of member time"
              value={`$${amount(weeklyHours * hourlyRate * WEEKS_PER_YEAR)}`}
            />
            <Field label="Assumed hourly rate ($)">
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  className="h-control-sm w-28"
                  value={hourlyRate}
                  onChange={(event) =>
                    setHourlyRate(Number(event.target.value))
                  }
                />
              )}
            </Field>
          </div>
        </Panel>
      </OverviewGrid>
    </ContentState>
  );
}

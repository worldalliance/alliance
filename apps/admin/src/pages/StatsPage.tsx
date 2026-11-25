import { dateToInputValue } from "@alliance/shared/lib/dateInput";
import React, { useMemo, useState } from "react";
import ActionCompletionCurveChart from "../components/ActionCompletionCurveChart";
import ActionCompletionBarsChart from "../components/stats/ActionCompletionBarsChart";
import ActionStatsTable from "../components/stats/ActionStatsTable";
import AggregateStatsCard from "../components/stats/AggregateStatsCard";
import CohortRetentionCharts from "../components/stats/CohortRetentionCharts";
import CompletionRateCharts from "../components/stats/CompletionRateCharts";
import { parseContractStatusHistory } from "../components/stats/contractStatusHistory";
import DailyStatsSection from "../components/stats/DailyStatsSection";
import InviteFunnelCard from "../components/stats/InviteFunnelCard";
import MemberReliabilityCard from "../components/stats/MemberReliabilityCard";
import MembersOverTimeChart from "../components/stats/MembersOverTimeChart";
import MissedActionsCard from "../components/stats/MissedActionsCard";
import PlatformTenureCohortCard from "../components/stats/PlatformTenureCohortCard";
import ReminderClickRateCard from "../components/stats/ReminderClickRateCard";
import TimeToChurnCard from "../components/stats/TimeToChurnCard";
import PageShell, { PageWidth } from "../components/ui/PageShell";
import { useActionStats } from "../lib/useActionStats";
import { useContractStatusHistoryAdmin } from "../lib/useContractStatusHistoryAdmin";

const StatsPage: React.FC = () => {
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

  const parsedContractStatusHistory = useMemo(
    () => parseContractStatusHistory(contractStatusHistory),
    [contractStatusHistory],
  );

  return (
    <PageShell title="Stats" width={PageWidth.Full}>
      <div className="flex flex-col gap-6 text-zinc-900">
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
        <DailyStatsSection />
        <ActionCompletionBarsChart
          actionStats={actionStats}
          actionStatsLoading={actionStatsLoading}
          actionStatsLoadFailed={actionStatsLoadFailed}
          recalculateActionStats={recalculateActionStats}
        />
        <ActionCompletionCurveChart />
        <CompletionRateCharts
          actionStats={actionStats}
          actionStatsLoading={actionStatsLoading}
        />
        <ReminderClickRateCard />
        <CohortRetentionCharts />
        <TimeToChurnCard />
        <ActionStatsTable actionStats={actionStats} />
      </div>
    </PageShell>
  );
};

export default StatsPage;

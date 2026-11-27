import { useMemo, useState } from "react";
import { Link } from "react-router";
import ActionCompletionCurveChart from "../../components/ActionCompletionCurveChart";
import { useActionStats } from "../../lib/useActionStats";
import { useContractStatusHistoryAdmin } from "../../lib/useContractStatusHistoryAdmin";
import { placeById, PlaceId } from "../../places";
import { useQueueCounts } from "../../shell/useQueueCounts";
import { linkClass } from "../../ui/styles";
import { OverviewGrid, Section } from "../../ui/templates/Overview";
import { Page, PageBody } from "../../ui/templates/Page";
import { CohortCompletionPanel } from "./CohortCompletionPanel";
import { CompletionRatePanel } from "./CompletionRatePanel";
import type { ParsedContractStatusPoint } from "./contractStatusHistory";
import { DailyStatsPanel } from "./DailyStatsPanel";
import { lastMonths } from "./homeRules";
import { InviteFunnelPanel } from "./InviteFunnelPanel";
import { KeyStats } from "./KeyStats";
import { MemberReliabilityPanel } from "./MemberReliabilityPanel";
import { MembersOverTimePanel } from "./MembersOverTimePanel";
import { MissedTasksPanel } from "./MissedTasksPanel";
import { NeedsYou } from "./NeedsYou";
import { ReminderClickRatePanel } from "./ReminderClickRatePanel";
import { TaskCompletionBarsPanel } from "./TaskCompletionBarsPanel";
import { TaskStatsPanel } from "./TaskStatsPanel";
import { TenureCohortPanel } from "./TenureCohortPanel";
import { TimeToChurnPanel } from "./TimeToChurnPanel";

const FULL = "col-span-12";
const HALF = "col-span-12 @4xl:col-span-6";

function PlaceLink({ place, children }: { place: PlaceId; children: string }) {
  return (
    <Link to={placeById(place).path} className={linkClass}>
      {children}
    </Link>
  );
}

export default function HomePage() {
  const counts = useQueueCounts();
  const { stats, recalculate } = useActionStats();
  const [membersRange, setMembersRange] = useState(() => lastMonths(6));
  const contractStatus = useContractStatusHistoryAdmin(membersRange);
  const history = useMemo<ParsedContractStatusPoint[]>(
    () =>
      (contractStatus.data ?? []).map((point) => ({
        ...point,
        parsedDate: new Date(point.date),
      })),
    [contractStatus.data],
  );

  return (
    <Page place={PlaceId.Home}>
      <PageBody>
        <NeedsYou counts={counts} />
        <Section title="Organization stats">
          <KeyStats stats={stats} />
        </Section>
        <Section
          title="Members"
          action={<PlaceLink place={PlaceId.People}>All members</PlaceLink>}
        >
          <OverviewGrid>
            <MembersOverTimePanel
              className={FULL}
              history={history}
              loading={
                contractStatus.isPending ||
                (contractStatus.isPlaceholderData && history.length === 0)
              }
              updating={contractStatus.isPlaceholderData}
              query={contractStatus}
              range={membersRange}
              onRangeChange={setMembersRange}
            />
            <TimeToChurnPanel className={HALF} />
            <TenureCohortPanel className={HALF} />
            <MissedTasksPanel className={HALF} />
            <MemberReliabilityPanel className={HALF} />
            <CohortCompletionPanel className={FULL} />
          </OverviewGrid>
        </Section>
        <Section
          title="Tasks"
          action={<PlaceLink place={PlaceId.AllTasks}>All tasks</PlaceLink>}
        >
          <OverviewGrid>
            <TaskCompletionBarsPanel
              className={FULL}
              stats={stats}
              recalculate={recalculate}
            />
            <ActionCompletionCurveChart className={FULL} />
            <CompletionRatePanel className={FULL} stats={stats} />
            <ReminderClickRatePanel className={FULL} />
            <TaskStatsPanel className={FULL} stats={stats} />
          </OverviewGrid>
        </Section>
        <Section
          title="Invites"
          action={<PlaceLink place={PlaceId.Invites}>All invites</PlaceLink>}
        >
          <OverviewGrid>
            <InviteFunnelPanel className={FULL} />
          </OverviewGrid>
        </Section>
        <Section title="Daily activity">
          <OverviewGrid>
            <DailyStatsPanel className={FULL} />
          </OverviewGrid>
        </Section>
      </PageBody>
    </Page>
  );
}

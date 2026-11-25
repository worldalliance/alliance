import type {
  CommunityDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { memberHref } from "../../lib/hrefs";
import type { useCommunityMemberInfoAdmin } from "../../lib/useCommunityMemberInfoAdmin";
import { useCompletedAllActiveActions } from "../../lib/useCompletedAllActiveActions";
import CommunityMembersTable from "../../ui/CommunityMembersTable";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Panel } from "../../ui/templates/Overview";
import { PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useMaxActionsPerWeek } from "../../ui/UserProgressPills";
import { byPersonName } from "./groupRules";

const NO_ACTIONS: UserActionSummaryDto[] = [];

/** Each member's tasks, contact details and time away, in the table leaders see in the member app. */
export function GroupProgressTab({
  group,
  memberInfo,
}: {
  group: CommunityDto;
  memberInfo: ReturnType<typeof useCommunityMemberInfoAdmin>;
}) {
  const { progress, contactInfo } = memberInfo;
  const actionSummaries = progress.data?.actionSummaries ?? NO_ACTIONS;
  const userActionRelations = progress.data?.userActionRelations ?? null;
  // Contact details only fill a column, so the table shows without them.
  const contactError = contactInfo.isLoadingError ? contactInfo.error : null;
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries,
    userActionRelations,
  });
  const completedAllCurrentActions = useCompletedAllActiveActions({
    actionSummaries,
    userActionRelations,
  });
  const leaders = useMemo(() => [...group.leaders].sort(byPersonName), [group]);
  const members = useMemo(() => [...group.users].sort(byPersonName), [group]);

  return (
    <PageBody>
      {contactError && (
        <Banner inline tone={BannerTone.Danger}>
          Couldn't load the members' contact details.{" "}
          {adminRefusalMessage(contactError, LOAD_FAILED_FALLBACK)}
        </Banner>
      )}
      <RefreshFailedBanner inline things="progress" query={progress} />
      <Panel title="Progress" flush>
        <ContentState
          loading={progress.isPending}
          skeleton={<TableSkeleton columns={5} rows={6} />}
          error={
            progress.isLoadingError
              ? adminRefusalMessage(progress.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load progress"
          onRetry={() => void progress.refetch()}
          retrying={progress.isFetching}
        >
          <div className="member-surface p-card">
            <CommunityMembersTable
              leaders={leaders}
              members={members}
              amLeader
              memberHref={memberHref}
              userActionRelations={userActionRelations ?? undefined}
              actions={actionSummaries}
              maxActionsPerWeek={maxActionsPerWeek}
              memberContactInfo={contactInfo.data}
              completedAllCurrentActions={completedAllCurrentActions}
              showInfoTooltip
              showContractFilter
            />
          </div>
        </ContentState>
      </Panel>
    </PageBody>
  );
}

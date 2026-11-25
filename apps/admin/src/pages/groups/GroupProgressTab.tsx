import type {
  CommunityDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import type { useCommunityMemberInfoAdmin } from "../../lib/useCommunityMemberInfoAdmin";
import { useCompletedAllActiveActions } from "../../lib/useCompletedAllActiveActions";
import CommunityMembersTable from "../../ui/CommunityMembersTable";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Panel } from "../../ui/templates/Overview";
import { PageBody } from "../../ui/templates/Page";
import { useMaxActionsPerWeek } from "../../ui/UserProgressPills";
import { byPersonName, memberHref } from "./groupRules";

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
  const loadError = progress.error ?? contactInfo.error;
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
      {loadError && (
        <Banner inline tone={BannerTone.Danger}>
          {adminRefusalMessage(
            loadError,
            "Unable to load member details. Please try again.",
          )}
        </Banner>
      )}
      <Panel title="Progress">
        <div className="member-surface">
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
      </Panel>
    </PageBody>
  );
}

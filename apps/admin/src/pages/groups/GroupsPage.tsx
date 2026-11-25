import type { ReactNode } from "react";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useCommunitiesAdmin } from "../../lib/useCommunitiesAdmin";
import { useGroupAssignmentMembersAdmin } from "../../lib/useGroupAssignmentAdmin";
import { CountId, PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page } from "../../ui/templates/Page";
import {
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { usePlaceTabs, withQueueCounts } from "../../ui/templates/usePlaceTabs";
import { AllGroupsTab } from "./AllGroupsTab";
import { AwaitingTab } from "./AwaitingTab";
import { unusedCapacity } from "./groupRules";
import { NewGroupDialog } from "./NewGroupDialog";
import { useGroupAssignment } from "./useGroupAssignment";

const TABS = ["all", "awaiting"] as const;
type Tab = (typeof TABS)[number];

export default function GroupsPage() {
  const tabs = usePlaceTabs(PlaceId.Groups, TABS);
  const groups = useCommunitiesAdmin();
  const queue = useGroupAssignmentMembersAdmin();
  const assignment = useGroupAssignment({
    members: queue.data,
    groups: groups.data,
  });
  const [creating, setCreating] = useState(false);
  const awaitingCount = queue.data?.length;
  // Free seats less the members waiting for one, so it needs both lists.
  const capacity =
    groups.data && awaitingCount !== undefined
      ? formatCount(unusedCapacity(groups.data, awaitingCount))
      : "—";

  // Each tab names the part of the page that failed to load for it, and
  // what that does to what it shows; its own list's failure is its body.
  const banner: Record<Tab, ReactNode> = {
    all: (
      <>
        {queue.isLoadingError && (
          <Banner tone={BannerTone.Danger}>
            Couldn't load the members awaiting a group.{" "}
            {adminRefusalMessage(queue.error, LOAD_FAILED_FALLBACK)} Unused
            capacity is unknown until they load.
          </Banner>
        )}
        <RefreshFailedBanner things="groups" query={groups} />
      </>
    ),
    awaiting: (
      <>
        {groups.isLoadingError && (
          <Banner tone={BannerTone.Danger}>
            Couldn't load groups.{" "}
            {adminRefusalMessage(groups.error, LOAD_FAILED_FALLBACK)} There are
            no groups to assign to until they load.
          </Banner>
        )}
        <RefreshFailedBanner
          things="the members awaiting a group"
          query={queue}
        />
      </>
    ),
  };

  const body: Record<Tab, () => ReactNode> = {
    all: () => (
      <AllGroupsTab
        groups={groups}
        pendingByGroupId={assignment.pendingByGroupId}
        picking={assignment.picking}
        onNewGroup={() => setCreating(true)}
      />
    ),
    awaiting: () => (
      <AwaitingTab queue={queue} groups={groups} assignment={assignment} />
    ),
  };

  return (
    <Page
      fill
      place={PlaceId.Groups}
      description={`Unused capacity ${capacity}`}
      actions={
        <Button
          // One primary action per view: on Awaiting assignment it is Confirm assignments.
          variant={
            tabs.value === "all" ? ButtonVariant.Primary : ButtonVariant.Default
          }
          onClick={() => setCreating(true)}
        >
          New group…
        </Button>
      }
      tabs={withQueueCounts(tabs, {
        [CountId.AwaitingGroup]: queue.isLoadingError ? null : awaitingCount,
      })}
      banner={banner[tabs.value]}
    >
      {body[tabs.value]()}
      {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
    </Page>
  );
}

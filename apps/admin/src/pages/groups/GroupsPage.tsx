import type { ReactNode } from "react";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useCommunitiesAdmin } from "../../lib/useCommunitiesAdmin";
import { useGroupAssignmentMembersAdmin } from "../../lib/useGroupAssignmentAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs } from "../../ui/templates/usePlaceTabs";
import { AllGroupsTab } from "./AllGroupsTab";
import { AwaitingTab } from "./AwaitingTab";
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

  // Each tab names the part of the page that failed to load for the other,
  // and what that does to what it shows.
  const banner: Record<Tab, ReactNode> = {
    all: queue.isLoadingError && (
      <Banner tone={BannerTone.Danger}>
        {adminRefusalMessage(
          queue.error,
          "Unable to load members awaiting group assignment. Please try again.",
        )}{" "}
        Unused capacity leaves them out.
      </Banner>
    ),
    awaiting: groups.isLoadingError && (
      <Banner tone={BannerTone.Danger}>
        {adminRefusalMessage(
          groups.error,
          "Unable to load groups. Please try again.",
        )}{" "}
        There are no groups to assign to until they load.
      </Banner>
    ),
  };

  const body: Record<Tab, () => ReactNode> = {
    all: () => (
      <AllGroupsTab
        groups={groups}
        awaitingCount={awaitingCount ?? 0}
        pendingByGroupId={assignment.pendingByGroupId}
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
      description="The groups members belong to, and the members waiting to be placed in one."
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
      tabs={{
        ...tabs,
        items: tabs.items.map((tab) =>
          tab.id === "awaiting" && awaitingCount
            ? { ...tab, count: awaitingCount }
            : tab,
        ),
      }}
      banner={banner[tabs.value]}
    >
      {body[tabs.value]()}
      {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
    </Page>
  );
}

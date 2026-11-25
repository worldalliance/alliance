import { getMemberCount } from "@alliance/common/community";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { href, useNavigate, useParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf, formatCount } from "../../lib/formatNumber";
import {
  useCommunitiesAdmin,
  useDeleteCommunityAdmin,
} from "../../lib/useCommunitiesAdmin";
import { useCommunityMemberInfoAdmin } from "../../lib/useCommunityMemberInfoAdmin";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { RecordId } from "../../places";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page, PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  FormSkeleton,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { useToast } from "../../ui/ToastProvider";
import { GroupMembersTab } from "./GroupMembersTab";
import { GroupProgressTab } from "./GroupProgressTab";
import { GroupSettingsTab } from "./GroupSettingsTab";

const TABS = ["members", "progress", "settings"] as const;
type Tab = (typeof TABS)[number];

const panelSkeleton = (columns: number) => (
  <PageBody>
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex min-h-12 items-center border-b border-line px-card">
        <Skeleton className="h-4 w-40" />
      </div>
      <TableSkeleton columns={columns} rows={6} />
    </div>
  </PageBody>
);

const SKELETON: Record<Tab, ReactNode> = {
  members: panelSkeleton(3),
  progress: panelSkeleton(5),
  settings: (
    <PageBody width="form">
      <FormSkeleton fields={5} />
    </PageBody>
  ),
};

export default function GroupPage() {
  const { id } = useParams();
  const groupId = Number(id);
  const validId = !Number.isNaN(groupId);
  const navigate = useNavigate();
  const tabs = useRecordTabs(RecordId.Group, TABS);
  const confirm = useConfirmOnPage();
  const { success } = useToast();

  const groups = useCommunitiesAdmin();
  const group = groups.data?.find((candidate) => candidate.id === groupId);
  // A list cached before the group existed is refetching: wait for it rather
  // than say the group is missing.
  const loading =
    validId && (groups.isPending || (!group && groups.fetchStatus !== "idle"));
  const loadError =
    validId && groups.isError && !group
      ? adminRefusalMessage(groups.error, LOAD_FAILED_FALLBACK)
      : null;
  const memberInfo = useCommunityMemberInfoAdmin(validId ? groupId : null);
  const users = useUsersAdmin();

  const [actionError, setActionError] = useState<string | null>(null);
  const reportError = useCallback(
    (message: string) => setActionError(message),
    [],
  );
  const clearError = useCallback(() => setActionError(null), []);

  const deletion = useDeleteCommunityAdmin({
    onSuccess: () => {
      if (group) success("Group deleted", group.name);
    },
    onError: (error) =>
      reportError(adminRefusalMessage(error, "Couldn't delete the group.")),
  });

  const deleteGroup = async () => {
    if (!group) return;
    const confirmed = await confirm({
      title: `Delete the group “${group.name}”?`,
      message:
        "Its members and leaders lose the group. No one is notified. This can't be undone.",
      confirmLabel: "Delete group",
      destructive: true,
    });
    if (!confirmed) return;
    clearError();
    deletion.mutate(groupId);
  };

  // Leaving from an effect lets the empty render below unmount the Settings
  // tab first, so its unsaved-changes guard doesn't ask about a deleted group.
  useEffect(() => {
    if (deletion.isSuccess) void navigate(href("/members/groups"));
  }, [deletion.isSuccess, navigate]);

  // The list drops the group before the navigation lands; show nothing rather
  // than "Group not found" for a moment.
  if (deletion.isSuccess) return null;

  const body: Record<Tab, (shown: NonNullable<typeof group>) => ReactNode> = {
    members: (shown) => (
      <GroupMembersTab
        group={shown}
        refreshMemberInfo={memberInfo.refresh}
        users={users}
        reportError={reportError}
        clearError={clearError}
      />
    ),
    progress: (shown) => (
      <GroupProgressTab group={shown} memberInfo={memberInfo} />
    ),
    settings: (shown) => <GroupSettingsTab group={shown} />,
  };

  return (
    <Page
      record={RecordId.Group}
      title={group?.name}
      badge={group && <Badge>{group.public ? "Public" : "Private"}</Badge>}
      description={
        group
          ? [
              countOf(getMemberCount(group), "member"),
              countOf(group.leaders.length, "leader"),
              group.maxCapacity === null
                ? "No capacity set"
                : `Capacity ${formatCount(group.maxCapacity)}`,
            ].join(" · ")
          : ""
      }
      actions={
        group && (
          <Button
            variant={ButtonVariant.DangerOutline}
            busy={deletion.isPending}
            onClick={() => void deleteGroup()}
          >
            Delete group
          </Button>
        )
      }
      tabs={tabs}
      banner={
        <>
          <RefreshFailedBanner things="this group" query={groups} />
          {actionError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={clearError}
                >
                  Dismiss
                </Button>
              }
            >
              {actionError}
            </Banner>
          )}
        </>
      }
    >
      <ContentState
        loading={loading}
        skeleton={SKELETON[tabs.value]}
        error={loadError}
        errorTitle="Couldn't load this group"
        onRetry={() => void groups.refetch()}
        retrying={groups.isFetching}
        empty={!group}
        emptyTitle="Group not found"
        emptyDescription="It may have been deleted."
        emptyAction={
          <Button variant={ButtonVariant.Default} to={href("/members/groups")}>
            All groups
          </Button>
        }
      >
        {group && body[tabs.value](group)}
      </ContentState>
    </Page>
  );
}

import { R, type Result } from "@alliance/common/result";

export type GroupsLink<Tab> = { communityId: number | null; tab: Tab | null };

export enum GroupsRefresh {
  Pending = "pending",
  Failed = "failed",
  Succeeded = "succeeded",
}

/** Pending until the link's own refresh finishes, whatever an earlier load left. */
export function groupsRefresh({
  linkRefreshed,
  isFetching,
  isError,
}: {
  linkRefreshed: boolean;
  isFetching: boolean;
  isError: boolean;
}): GroupsRefresh {
  if (!linkRefreshed || isFetching) return GroupsRefresh.Pending;
  return isError ? GroupsRefresh.Failed : GroupsRefresh.Succeeded;
}

export enum GroupsLinkFailure {
  NotMember = "notMember",
  RefreshFailed = "refreshFailed",
}

export const GROUPS_LINK_ALERTS: Record<
  GroupsLinkFailure,
  { title: string; message: string }
> = {
  [GroupsLinkFailure.NotMember]: {
    title: "Group unavailable",
    message: "You're not in that group.",
  },
  [GroupsLinkFailure.RefreshFailed]: {
    title: "Couldn't open that group",
    message: "Your groups didn't load.",
  },
};

/**
 * Fails when the link names a group outside `communityIds`, which after a
 * failed refresh may only mean the stale list predates the join. Returns
 * `null` while the refresh that may bring that group is pending.
 */
export function resolveGroupsLink<Tab extends string>({
  communityIds,
  refresh,
  isTab,
  tabParam,
  communityIdParam,
}: {
  communityIds: number[];
  refresh: GroupsRefresh;
  isTab: (value: string | undefined) => value is Tab;
  tabParam: string | undefined;
  communityIdParam: string | undefined;
}): Result<GroupsLink<Tab>, GroupsLinkFailure> | null {
  const tab = isTab(tabParam) ? tabParam : null;
  if (communityIdParam === undefined)
    return R.success({ communityId: null, tab });
  const communityId = communityIds.find(
    (id) => String(id) === communityIdParam,
  );
  if (communityId !== undefined) return R.success({ communityId, tab });
  switch (refresh) {
    case GroupsRefresh.Pending:
      return null;
    case GroupsRefresh.Failed:
      return R.failure(GroupsLinkFailure.RefreshFailed);
    case GroupsRefresh.Succeeded:
      return R.failure(GroupsLinkFailure.NotMember);
    default:
      throw new Error(`unknown refresh: ${refresh satisfies never}`);
  }
}

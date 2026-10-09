import { R, type Result } from "@alliance/common/result";

type GroupsLink<Tab> = { communityId: number | null; tab: Tab | null };

/** Fails when the link names a group outside `communityIds`. */
export function resolveGroupsLink<Tab extends string>({
  communityIds,
  isTab,
  tabParam,
  communityIdParam,
}: {
  communityIds: number[];
  isTab: (value: string | undefined) => value is Tab;
  tabParam: string | undefined;
  communityIdParam: string | undefined;
}): Result<GroupsLink<Tab>, { communityIdParam: string }> {
  const tab = isTab(tabParam) ? tabParam : null;
  if (communityIdParam === undefined)
    return R.success({ communityId: null, tab });
  const communityId = communityIds.find(
    (id) => String(id) === communityIdParam,
  );
  return communityId === undefined
    ? R.failure({ communityIdParam })
    : R.success({ communityId, tab });
}

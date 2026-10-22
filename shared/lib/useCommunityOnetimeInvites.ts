import { useQuery } from "@tanstack/react-query";
import { userOnetimeInviteGetOnetimeInvitesByCommunity } from "../client";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";
import { useOnetimeInviteCache } from "./useOnetimeInviteCache";

/**
 * Single source of truth for a community's one-time invites — the leader-facing
 * counterpart to {@link useOnetimeInvitesOverview}. Wraps
 * `userOnetimeInviteGetOnetimeInvitesByCommunity` plus the
 * create/approve/reject/delete endpoints in react-query, sharing one cache key
 * (scoped by `communityId`) and exposing cache-aware helpers so handlers update
 * the list without re-fetching.
 */
export function useCommunityOnetimeInvites(
  communityId: number,
  params?: { enabled?: boolean },
) {
  const { enabled = true } = params ?? {};
  const queryKey = queryKeys.communityOnetimeInvites(communityId);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      userOnetimeInviteGetOnetimeInvitesByCommunity({
        path: { communityId },
        throwOnError: true,
      }).then((r) => r.data),
    enabled,
  });

  const cache = useOnetimeInviteCache(queryKey);

  return {
    invites: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    didFail: failedToLoad(query),
    refetch: query.refetch,
    ...cache,
  };
}

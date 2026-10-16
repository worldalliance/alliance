import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  CommunityDto,
  communityGetMyCommunities,
  communityJoinPublicCommunity,
  communityLeave,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";

const QUERY_KEY = queryKeys.myCommunities();

/** Refetches every list a change to the user's group membership alters: their
 * groups, and the public groups' member counts. */
export const refreshMemberships = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: queryKeys.publicCommunities() }),
  ]);

function findCommunityById(
  communities: CommunityDto[],
  communityId: number | null,
): CommunityDto | null {
  if (communityId === null) {
    return communities[0] ?? null;
  }
  return communities.find((community) => community.id === communityId) ?? null;
}

/**
 * Single source of truth for the current user's communities. Wraps
 * `communityGetMyCommunities` in react-query and exposes cache-aware helpers
 * (refresh, remove, member removal, upsert) plus optional prop-driven selection.
 * Consume this instead of calling the generated client directly, so the request
 * is de-duplicated and cache mutations stay consistent across screens.
 *
 * Leaving a group or joining a public one throws when refused. Leaving drops
 * the group from the cache at once. Joining resolves only once the user's
 * groups have been refetched, since the server also removes the user from
 * every group they don't lead.
 */
export function useMyCommunities(params?: {
  selectedCommunityId?: number | null;
  enabled?: boolean;
}) {
  const { selectedCommunityId = null, enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      communityGetMyCommunities({ throwOnError: true }).then(
        (response) => response.data,
      ),
    enabled,
  });
  const {
    data: communities = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = query;

  const communityIds = useMemo(
    () => new Set(communities.map((community) => community.id)),
    [communities],
  );

  const refreshCommunities = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const removeCommunity = useCallback(
    (communityId: number) => {
      queryClient.setQueryData<CommunityDto[]>(QUERY_KEY, (old) =>
        old ? old.filter((community) => community.id !== communityId) : [],
      );
    },
    [queryClient],
  );

  const removeMemberFromCommunity = useCallback(
    (communityId: number, memberId: number) => {
      queryClient.setQueryData<CommunityDto[]>(QUERY_KEY, (old) =>
        old
          ? old.map((community) =>
              community.id === communityId
                ? {
                    ...community,
                    users: community.users.filter(
                      (user) => user.id !== memberId,
                    ),
                  }
                : community,
            )
          : [],
      );
    },
    [queryClient],
  );

  /** Upsert a single community into the cached list. */
  const updateCommunity = useCallback(
    (community: CommunityDto) => {
      queryClient.setQueryData<CommunityDto[]>(QUERY_KEY, (old) => {
        if (old && old.some((c) => c.id === community.id)) {
          return old.map((c) => (c.id === community.id ? community : c));
        }
        return [...(old ?? []), community];
      });
    },
    [queryClient],
  );

  const { mutateAsync: leaveCommunity, isPending: isLeaving } = useMutation({
    mutationFn: (communityId: number) =>
      communityLeave({ path: { communityId }, throwOnError: true }),
    onSuccess: (_, communityId) => {
      removeCommunity(communityId);
      void refreshMemberships(queryClient);
    },
  });

  const { mutateAsync: joinPublicCommunity } = useMutation({
    mutationFn: (communityId: number) =>
      communityJoinPublicCommunity({
        path: { communityId },
        throwOnError: true,
      }).then((response) => response.data),
    onSuccess: () => refreshMemberships(queryClient),
  });

  const selectedCommunity = useMemo(
    () => findCommunityById(communities, selectedCommunityId),
    [communities, selectedCommunityId],
  );

  return {
    communities,
    communityIds,
    isLoading,
    isFetching,
    isError,
    didFail: failedToLoad(query),
    refetch,
    refreshCommunities,
    removeCommunity,
    removeMemberFromCommunity,
    updateCommunity,
    leaveCommunity,
    isLeaving,
    joinPublicCommunity,
    selectedCommunity,
  };
}

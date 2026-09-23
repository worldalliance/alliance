import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommunityDto, communityGetMyCommunities } from "../client";
import { failedToLoad } from "./failedToLoad";

const QUERY_KEY = ["communityGetMyCommunities"] as const;

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

  /** Upsert a single community into the cached list (does not touch selection). */
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

  const [selectedCommunity, setSelectedCommunity] =
    useState<CommunityDto | null>(() =>
      findCommunityById(communities, selectedCommunityId),
    );
  useEffect(() => {
    setSelectedCommunity(findCommunityById(communities, selectedCommunityId));
  }, [communities, selectedCommunityId]);

  const updateSelectedCommunity = useCallback(
    (community: CommunityDto) => {
      updateCommunity(community);
      setSelectedCommunity(findCommunityById(communities, community.id));
    },
    [updateCommunity, communities],
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
    selectedCommunity,
    updateSelectedCommunity,
  };
}

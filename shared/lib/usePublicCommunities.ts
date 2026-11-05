import { communityGetPublicCommunities, type CommunityDto } from "../client";
import { useCommunityList } from "./communityStore";
import { queryKeys } from "./queryKeys";

/**
 * Single source of truth for public communities a user can join. Wraps
 * `communityGetPublicCommunities` in react-query so requests are deduplicated
 * and cached across screens. Prefer this over the generated client directly.
 */
export function usePublicCommunities(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};

  const {
    data: publicCommunities = NO_COMMUNITIES,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useCommunityList({
    queryKey: queryKeys.publicCommunities(),
    fetch: (signal) =>
      communityGetPublicCommunities({ throwOnError: true, signal }).then(
        (response) => response.data,
      ),
    enabled,
  });

  return {
    publicCommunities,
    isLoading,
    isFetching,
    isError,
    refetch,
  };
}

const NO_COMMUNITIES: CommunityDto[] = [];

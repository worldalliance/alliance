import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  communityCreateCommunity,
  communityDelete,
  CommunityDto,
  communityGetMyCommunities,
  communityJoinPublicCommunity,
  communityLeave,
  communityRemoveMember,
  communityUpdate,
  CreateCommunityDto,
  UpdateCommunityDto,
} from "../client";
import { communityStore, useCommunityList } from "./communityStore";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";
import { currentSession } from "./sessionStores";

const QUERY_KEY = queryKeys.myCommunities();

export const CREATE_GROUP_SESSION_EXPIRED =
  "Your session has expired. Sign in again to create a group.";
export const UPDATE_GROUP_SESSION_EXPIRED =
  "Your session has expired. Sign in again to save the group's settings.";
export const DELETE_GROUP_SESSION_EXPIRED =
  "Your session has expired. Sign in again to delete the group.";
export const REMOVE_MEMBER_SESSION_EXPIRED =
  "Your session has expired. Sign in again to remove a member.";

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
 * `communityGetMyCommunities` in react-query and exposes a refresh, the group
 * writes below, and optional prop-driven selection.
 * Consume this instead of calling the generated client directly, so the request
 * is de-duplicated and cache mutations stay consistent across screens.
 *
 * Creating, saving, deleting, leaving, or joining a group, and removing a
 * member, throw when refused. The group a write returns replaces the group
 * everywhere it shows, creating adds it to the user's groups, leaving drops it
 * from them, and deleting drops it from every list. Joining resolves only once
 * the user's groups have been refetched, since the server also removes the user
 * from every group they don't lead.
 */
export function useMyCommunities(params?: {
  selectedCommunityId?: number | null;
  enabled?: boolean;
}) {
  const { selectedCommunityId = null, enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const store = communityStore(queryClient);

  const query = useCommunityList({
    queryKey: QUERY_KEY,
    fetch: (signal) =>
      communityGetMyCommunities({ throwOnError: true, signal }).then(
        (response) => response.data,
      ),
    enabled,
  });
  const {
    data: communities = NO_COMMUNITIES,
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

  const { mutateAsync: createCommunity } = useMutation({
    mutationFn: async (body: CreateCommunityDto) => {
      const session = currentSession(queryClient);
      const { data: community } = await communityCreateCommunity({
        body,
        throwOnError: true,
      });
      store.created({ session, community });
      void refreshMemberships(queryClient);
      return community;
    },
    // Offline, the create fails its form at once instead of pausing.
    networkMode: "always",
  });

  const { mutateAsync: saveCommunity } = useMutation({
    mutationFn: async ({
      communityId,
      body,
    }: {
      communityId: number;
      body: UpdateCommunityDto;
    }) => {
      const session = currentSession(queryClient);
      const { data: community } = await communityUpdate({
        path: { communityId },
        body,
        throwOnError: true,
      });
      store.saved({ session, community });
      // Saving can make the group public or private.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publicCommunities(),
      });
      return community;
    },
    networkMode: "always",
  });

  const { mutateAsync: deleteCommunity } = useMutation({
    mutationFn: async (communityId: number) => {
      const session = currentSession(queryClient);
      await communityDelete({ path: { communityId }, throwOnError: true });
      store.deleted({ session, communityId });
      void refreshMemberships(queryClient);
    },
    networkMode: "always",
  });

  const { mutateAsync: removeMember } = useMutation({
    mutationFn: async ({
      communityId,
      memberId,
    }: {
      communityId: number;
      memberId: number;
    }) => {
      const session = currentSession(queryClient);
      const { data: community } = await communityRemoveMember({
        path: { communityId },
        body: { userId: memberId },
        throwOnError: true,
      });
      store.saved({ session, community });
    },
    networkMode: "always",
  });

  const { mutateAsync: leaveCommunity, isPending: isLeaving } = useMutation({
    mutationFn: async (communityId: number) => {
      const session = currentSession(queryClient);
      await communityLeave({ path: { communityId }, throwOnError: true });
      store.left({ session, communityId });
      void refreshMemberships(queryClient);
    },
  });

  const { mutateAsync: joinPublicCommunity } = useMutation({
    mutationFn: async (communityId: number) => {
      const session = currentSession(queryClient);
      const { data: community } = await communityJoinPublicCommunity({
        path: { communityId },
        throwOnError: true,
      });
      store.saved({ session, community });
      await refreshMemberships(queryClient);
      return community;
    },
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
    createCommunity,
    saveCommunity,
    deleteCommunity,
    removeMember,
    leaveCommunity,
    isLeaving,
    joinPublicCommunity,
    selectedCommunity,
  };
}

const NO_COMMUNITIES: CommunityDto[] = [];

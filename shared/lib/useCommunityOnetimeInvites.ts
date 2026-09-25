import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CreateOnetimeInviteDto,
  userCreateOnetimeInvite,
  userGetOnetimeInvitesByCommunity,
} from "../client";
import { queryKeys } from "./queryKeys";
import { useOnetimeInviteCache } from "./useOnetimeInviteCache";

/**
 * Single source of truth for a community's one-time invites — the leader-facing
 * counterpart to {@link useOnetimeInvitesOverview}. Wraps
 * `userGetOnetimeInvitesByCommunity` plus the create/approve/reject/delete
 * endpoints in react-query, sharing one cache key (scoped by `communityId`) and
 * exposing cache-aware helpers so handlers update the list without re-fetching.
 */
export function useCommunityOnetimeInvites(
  communityId: number,
  params?: { enabled?: boolean },
) {
  const { enabled = true } = params ?? {};
  const queryKey = queryKeys.communityOnetimeInvites(communityId);

  const {
    data: invites = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      userGetOnetimeInvitesByCommunity({
        path: { communityId },
        throwOnError: true,
      }).then((r) => r.data),
    enabled,
  });

  const cache = useOnetimeInviteCache(queryKey);

  const createMutation = useMutation({
    mutationFn: (body: CreateOnetimeInviteDto) =>
      userCreateOnetimeInvite({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: (invite) => cache.upsertInvite(invite),
  });

  return {
    invites,
    isLoading,
    isFetching,
    isError,
    refetch,
    ...cache,
    createInvite: createMutation.mutateAsync,
  };
}

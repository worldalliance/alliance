import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  userGetOnetimeInvitesOverview,
  userUpdateOnetimeInvite,
} from "../client";
import { queryKeys } from "./queryKeys";
import { useOnetimeInviteCache } from "./useOnetimeInviteCache";

const QUERY_KEY = queryKeys.onetimeInvitesOverview();

/**
 * Single source of truth for the current user's one-time invites. Exposes
 * cache-aware helpers so handlers update the list without re-fetching.
 */
export function useOnetimeInvitesOverview(params?: { enabled?: boolean }) {
  const { enabled = true } = params ?? {};
  const queryClient = useQueryClient();

  const {
    data: invites = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      userGetOnetimeInvitesOverview({ throwOnError: true }).then((r) => r.data),
    enabled,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const cache = useOnetimeInviteCache(QUERY_KEY);

  const updateMutation = useMutation({
    /** Each field is left alone when omitted; `communityId: null` clears the group. */
    mutationFn: (vars: {
      inviteId: number;
      invitee?: string;
      communityId?: number | null;
    }) => {
      const { inviteId, ...body } = vars;
      return userUpdateOnetimeInvite({
        path: { inviteId },
        body,
        throwOnError: true,
      }).then((r) => r.data);
    },
    onSuccess: (invite) => cache.upsertInvite(invite),
  });

  return {
    invites,
    isLoading,
    isFetching,
    isError,
    refetch,
    refresh,
    ...cache,
    updateInvite: updateMutation.mutateAsync,
    isUpdatingInvite: updateMutation.isPending,
  };
}

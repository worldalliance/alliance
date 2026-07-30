import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  OnetimeInviteDto,
  userApproveOnetimeInvite,
  userDeleteOnetimeInvite,
  userGetOnetimeInvitesOverview,
  userRejectOnetimeInvite,
  userUpdateOnetimeInvite,
} from "../client";
import { queryKeys } from "./queryKeys";

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

  const upsertInvite = useCallback(
    (invite: OnetimeInviteDto) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(QUERY_KEY, (old) => {
        if (old?.some((existing) => existing.id === invite.id)) {
          return old.map((existing) =>
            existing.id === invite.id ? invite : existing,
          );
        }
        return [invite, ...(old ?? [])];
      });
    },
    [queryClient],
  );

  const removeInvite = useCallback(
    (inviteId: number) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(QUERY_KEY, (old) =>
        old ? old.filter((invite) => invite.id !== inviteId) : [],
      );
    },
    [queryClient],
  );

  const approveMutation = useMutation({
    mutationFn: (inviteId: number) =>
      userApproveOnetimeInvite({ path: { inviteId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: (invite) => upsertInvite(invite),
  });

  const rejectMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userRejectOnetimeInvite({ path: { inviteId }, throwOnError: true });
      return inviteId;
    },
    onSuccess: (inviteId) => removeInvite(inviteId),
  });

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
    onSuccess: (invite) => upsertInvite(invite),
  });

  const deleteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userDeleteOnetimeInvite({ path: { inviteId }, throwOnError: true });
      return inviteId;
    },
    onSuccess: (inviteId) => removeInvite(inviteId),
  });

  return {
    invites,
    isLoading,
    isFetching,
    isError,
    refetch,
    refresh,
    upsertInvite,
    removeInvite,
    approveInvite: approveMutation.mutateAsync,
    updateInvite: updateMutation.mutateAsync,
    isUpdatingInvite: updateMutation.isPending,
    rejectInvite: rejectMutation.mutateAsync,
    deleteInvite: deleteMutation.mutateAsync,
  };
}

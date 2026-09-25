import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  OnetimeInviteDto,
  userApproveOnetimeInvite,
  userDeleteOnetimeInvite,
  userRejectOnetimeInvite,
} from "../client";

/**
 * Cache helpers and the approve/reject/delete mutations shared by every cached
 * list of one-time invites, each writing its result into the list at `queryKey`.
 */
export function useOnetimeInviteCache(queryKey: QueryKey) {
  const queryClient = useQueryClient();

  const upsertInvite = useCallback(
    (invite: OnetimeInviteDto) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(queryKey, (old) => {
        if (old?.some((existing) => existing.id === invite.id)) {
          return old.map((existing) =>
            existing.id === invite.id ? invite : existing,
          );
        }
        return [invite, ...(old ?? [])];
      });
    },
    [queryClient, queryKey],
  );

  const removeInvite = useCallback(
    (inviteId: number) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(queryKey, (old) =>
        old ? old.filter((invite) => invite.id !== inviteId) : [],
      );
    },
    [queryClient, queryKey],
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

  const deleteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userDeleteOnetimeInvite({ path: { inviteId }, throwOnError: true });
      return inviteId;
    },
    onSuccess: (inviteId) => removeInvite(inviteId),
  });

  return {
    upsertInvite,
    removeInvite,
    approveInvite: approveMutation.mutateAsync,
    rejectInvite: rejectMutation.mutateAsync,
    deleteInvite: deleteMutation.mutateAsync,
  };
}

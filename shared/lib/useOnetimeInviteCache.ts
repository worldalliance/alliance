import {
  hashKey,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  userOnetimeInviteApproveOnetimeInvite,
  userOnetimeInviteCreateOnetimeInvite,
  userOnetimeInviteDeleteOnetimeInvite,
  userOnetimeInviteRejectOnetimeInvite,
} from "../client";
import { queryKeys } from "./queryKeys";

/**
 * Cache helpers and the create/approve/reject/delete mutations shared by every
 * cached list of one-time invites, each writing its result into the list at
 * `queryKey` and refetching the other cached lists.
 */
export function useOnetimeInviteCache(queryKey: QueryKey) {
  const queryClient = useQueryClient();

  const invalidateOtherLists = useCallback(() => {
    const ownHash = hashKey(queryKey);
    for (const listKey of [
      queryKeys.onetimeInvitesOverview(),
      queryKeys.communityOnetimeInvitesAll(),
    ]) {
      void queryClient.invalidateQueries({
        queryKey: listKey,
        predicate: (query) => query.queryHash !== ownHash,
      });
    }
  }, [queryClient, queryKey]);

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
      invalidateOtherLists();
    },
    [queryClient, queryKey, invalidateOtherLists],
  );

  const removeInvite = useCallback(
    (inviteId: number) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(queryKey, (old) =>
        old ? old.filter((invite) => invite.id !== inviteId) : [],
      );
      invalidateOtherLists();
    },
    [queryClient, queryKey, invalidateOtherLists],
  );

  const createMutation = useMutation({
    mutationFn: (body: CreateOnetimeInviteDto) =>
      userOnetimeInviteCreateOnetimeInvite({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: (invite) => upsertInvite(invite),
  });

  const approveMutation = useMutation({
    mutationFn: (inviteId: number) =>
      userOnetimeInviteApproveOnetimeInvite({
        path: { inviteId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (invite) => upsertInvite(invite),
  });

  const rejectMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userOnetimeInviteRejectOnetimeInvite({
        path: { inviteId },
        throwOnError: true,
      });
      return inviteId;
    },
    onSuccess: (inviteId) => removeInvite(inviteId),
  });

  const deleteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userOnetimeInviteDeleteOnetimeInvite({
        path: { inviteId },
        throwOnError: true,
      });
      return inviteId;
    },
    onSuccess: (inviteId) => removeInvite(inviteId),
  });

  return {
    upsertInvite,
    removeInvite,
    createInvite: createMutation.mutateAsync,
    isCreatingInvite: createMutation.isPending,
    approveInvite: approveMutation.mutateAsync,
    rejectInvite: rejectMutation.mutateAsync,
    deleteInvite: deleteMutation.mutateAsync,
  };
}

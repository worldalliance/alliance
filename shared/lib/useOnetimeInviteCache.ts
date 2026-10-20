import {
  hashKey,
  type Query,
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

// Merged rather than swapped: approve answers without the invite's community,
// which the cached copy still holds; a cleared group arrives as null.
const replacingInvite =
  (invite: OnetimeInviteDto) => (old: OnetimeInviteDto[]) =>
    old.map((existing) =>
      existing.id === invite.id ? { ...existing, ...invite } : existing,
    );

const rejectingInvite = (inviteId: number) => (old: OnetimeInviteDto[]) =>
  old.map((invite) =>
    invite.id === inviteId
      ? { ...invite, status: "request_rejected" as const }
      : invite,
  );

const removingInvite = (inviteId: number) => (old: OnetimeInviteDto[]) =>
  old.filter((invite) => invite.id !== inviteId);

/**
 * Cache helpers and the create/approve/reject/delete mutations shared by every
 * cached list of one-time invites, each writing its result into the list at
 * `queryKey` and updating the other lists, which can hold the same invite.
 */
export function useOnetimeInviteCache(queryKey: QueryKey) {
  const queryClient = useQueryClient();

  const upsertInvite = useCallback(
    (invite: OnetimeInviteDto) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(queryKey, (old) => {
        if (old?.some((existing) => existing.id === invite.id)) {
          return replacingInvite(invite)(old);
        }
        return [invite, ...(old ?? [])];
      });
    },
    [queryClient, queryKey],
  );

  const removeInvite = useCallback(
    (inviteId: number) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(queryKey, (old) =>
        old ? removingInvite(inviteId)(old) : [],
      );
    },
    [queryClient, queryKey],
  );

  // A list another screen holds is patched before it is refetched, so it shows
  // the result on its next mount rather than only after that refetch lands. A
  // group's list keeps only that group's invites, so an edit that moves an
  // invite drops it from the list it left.
  const updateOtherLists = useCallback(
    (patch: (old: OnetimeInviteDto[]) => OnetimeInviteDto[] = (old) => old) => {
      const own = hashKey(queryKey);
      const overview = queryKeys.onetimeInvitesOverview();
      const groupLists = queryKeys.communityOnetimeInvitesAll();
      for (const list of [overview, groupLists]) {
        const filters = {
          queryKey: list,
          predicate: (query: Query) => query.queryHash !== own,
        };
        for (const [key, old] of queryClient.getQueriesData<OnetimeInviteDto[]>(
          filters,
        )) {
          if (!old) continue;
          const patched = patch(old);
          queryClient.setQueryData(
            key,
            list === groupLists
              ? patched.filter((invite) => invite.community?.id === key[1])
              : patched,
          );
        }
        void queryClient.invalidateQueries(filters);
      }
    },
    [queryClient, queryKey],
  );

  const applyInvite = useCallback(
    (invite: OnetimeInviteDto) => {
      upsertInvite(invite);
      updateOtherLists(replacingInvite(invite));
    },
    [upsertInvite, updateOtherLists],
  );

  const createMutation = useMutation({
    mutationFn: (body: CreateOnetimeInviteDto) =>
      userOnetimeInviteCreateOnetimeInvite({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: (invite) => {
      upsertInvite(invite);
      updateOtherLists();
    },
  });

  const approveMutation = useMutation({
    mutationFn: (inviteId: number) =>
      userOnetimeInviteApproveOnetimeInvite({
        path: { inviteId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (invite) => applyInvite(invite),
  });

  const rejectMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userOnetimeInviteRejectOnetimeInvite({
        path: { inviteId },
        throwOnError: true,
      });
      return inviteId;
    },
    onSuccess: (inviteId) => {
      queryClient.setQueryData<OnetimeInviteDto[]>(
        queryKey,
        (old) => old && rejectingInvite(inviteId)(old),
      );
      updateOtherLists(rejectingInvite(inviteId));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await userOnetimeInviteDeleteOnetimeInvite({
        path: { inviteId },
        throwOnError: true,
      });
      return inviteId;
    },
    onSuccess: (inviteId) => {
      removeInvite(inviteId);
      updateOtherLists(removingInvite(inviteId));
    },
  });

  return {
    applyInvite,
    createInvite: createMutation.mutateAsync,
    isCreatingInvite: createMutation.isPending,
    approveInvite: approveMutation.mutateAsync,
    rejectInvite: rejectMutation.mutateAsync,
    deleteInvite: deleteMutation.mutateAsync,
  };
}

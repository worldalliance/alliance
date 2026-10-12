import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  communityAcceptCommunityInvite,
  communityGetIncomingCommunityInvitesForUser,
  communityRejectCommunityInvite,
  type CommunityInviteDto,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";

/** The current user's incoming group invites, and accepting or declining one.
 * Both writes throw when refused. Accepting moves the user into the invite's
 * group, so it also refreshes their groups and the public groups. */
export function useIncomingCommunityInvites() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.incomingCommunityInvites();

  const query = useQuery({
    queryKey,
    queryFn: () =>
      communityGetIncomingCommunityInvitesForUser({ throwOnError: true }).then(
        (res) => res.data,
      ),
  });
  const { data: invites, isFetching, refetch } = query;

  const incomingCommunityInvitesById = useMemo(
    () => new Map((invites ?? []).map((invite) => [invite.id, invite])),
    [invites],
  );

  const pendingCommunityInvites = useMemo(
    () =>
      (invites ?? []).filter((invite) => invite.status === "invitee_pending"),
    [invites],
  );

  const storeStatus = async (
    inviteId: number,
    status: CommunityInviteDto["status"],
  ) => {
    // A refetch in flight would land the invite back as pending.
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<CommunityInviteDto[]>(queryKey, (old) =>
      old?.map((invite) =>
        invite.id === inviteId ? { ...invite, status } : invite,
      ),
    );
  };

  const { mutateAsync: acceptCommunityInvite, isPending: accepting } =
    useMutation({
      mutationFn: (inviteId: number) =>
        communityAcceptCommunityInvite({
          path: { inviteId },
          throwOnError: true,
        }),
      onSuccess: async (_, inviteId) => {
        await storeStatus(inviteId, "invitee_accepted");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.myCommunities(),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.publicCommunities(),
          }),
        ]);
      },
    });

  const { mutateAsync: declineCommunityInvite, isPending: declining } =
    useMutation({
      mutationFn: (inviteId: number) =>
        communityRejectCommunityInvite({
          path: { inviteId },
          throwOnError: true,
        }),
      onSuccess: (_, inviteId) => storeStatus(inviteId, "invitee_rejected"),
    });

  return {
    incomingCommunityInvitesById,
    pendingCommunityInvites,
    didFail: failedToLoad(query),
    isFetching,
    refetch,
    acceptCommunityInvite,
    declineCommunityInvite,
    isAnswering: accepting || declining,
  };
}

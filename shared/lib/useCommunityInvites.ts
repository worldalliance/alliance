import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  communityCreateCommunityInvite,
  communityDeleteCommunityInvite,
  communityGetCommunityInvites,
  type CommunityInviteDto,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";

/** A community's invites to current members, including members' requests
 * awaiting a leader, with create and delete writing into the same cache. */
export function useCommunityInvites(communityId: number) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.communityInvites(communityId);

  // A list fetch in flight may have read the list before the write, so it is
  // cancelled before the write and restarted after it. With no list loaded,
  // the write alone would read as the whole list, so the list is refetched.
  const writeList = async (
    update: (old: CommunityInviteDto[]) => CommunityInviteDto[],
  ) => {
    const wasFetching = queryClient.isFetching({ queryKey }) > 0;
    await queryClient.cancelQueries({ queryKey });
    const old = queryClient.getQueryData<CommunityInviteDto[]>(queryKey);
    if (old) queryClient.setQueryData(queryKey, update(old));
    if (wasFetching || !old) void queryClient.invalidateQueries({ queryKey });
  };

  const query = useQuery({
    queryKey,
    queryFn: () =>
      communityGetCommunityInvites({
        path: { communityId },
        throwOnError: true,
      }).then((res) => res.data),
  });
  const { data: invites = [], isLoading, isFetching, isError, refetch } = query;

  const createMutation = useMutation({
    mutationFn: (invitedUserId: number) =>
      communityCreateCommunityInvite({
        body: { invitedUserId, communityId },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: (invite) =>
      writeList((old) => [
        invite,
        ...old.filter((existing) => existing.id !== invite.id),
      ]),
  });

  const deleteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      await communityDeleteCommunityInvite({
        path: { inviteId },
        throwOnError: true,
      });
      return inviteId;
    },
    onSuccess: (inviteId) =>
      writeList((old) => old.filter((invite) => invite.id !== inviteId)),
  });

  return {
    invites,
    isLoading,
    isFetching,
    isError,
    didFail: failedToLoad(query),
    refetch,
    createInvite: createMutation.mutateAsync,
    deleteInvite: deleteMutation.mutateAsync,
  };
}

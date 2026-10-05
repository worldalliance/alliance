import {
  type AssignGroupsDto,
  communityAddLeaderAdmin,
  communityAddMemberAdmin,
  communityCreateCommunityAdmin,
  communityDeleteAdmin,
  type CommunityDto,
  communityGetCommunitiesAdmin,
  communityRemoveLeaderAdmin,
  communityRemoveMemberAdmin,
  communityUpdate,
  type CreateCommunityDto,
  type UpdateCommunityDto,
  userAssignGroupsAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePatchQueryData } from "./usePatchQueryData";

const communitiesQuery = queryOptions({
  queryKey: queryKeys.communitiesAdmin(),
  queryFn: () =>
    communityGetCommunitiesAdmin({ throwOnError: true }).then((r) => r.data),
});

export function useCommunitiesAdmin() {
  return useQuery(communitiesQuery);
}

function usePutCommunity() {
  const setCommunities = usePatchQueryData(communitiesQuery.queryKey);
  return (community: CommunityDto) =>
    setCommunities((prev) =>
      prev.map((c) => (c.id === community.id ? community : c)),
    );
}

export function useCreateCommunityAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const setCommunities = usePatchQueryData(communitiesQuery.queryKey);
  return useMutation({
    mutationFn: (body: CreateCommunityDto) =>
      communityCreateCommunityAdmin({ body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: async (created) => {
      // A refetch that landed before this response may already list it.
      await setCommunities((prev) => [
        ...prev.filter((c) => c.id !== created.id),
        created,
      ]);
      onSuccess();
    },
    onError,
  });
}

export function useAssignGroupsAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignGroupsDto) =>
      userAssignGroupsAdmin({ body, throwOnError: true }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: communitiesQuery.queryKey }),
  });
}

export function useUpdateCommunityAdmin(params: {
  onSuccess: (updated: CommunityDto) => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const putCommunity = usePutCommunity();
  return useMutation({
    mutationFn: ({
      communityId,
      body,
    }: {
      communityId: number;
      body: UpdateCommunityDto;
    }) =>
      communityUpdate({ path: { communityId }, body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: async (updated) => {
      await putCommunity(updated);
      onSuccess(updated);
    },
    onError,
  });
}

export enum MembershipChange {
  AddMember = "add-member",
  RemoveMember = "remove-member",
  AddLeader = "add-leader",
  RemoveLeader = "remove-leader",
}

const membershipEndpoints: Record<
  MembershipChange,
  typeof communityAddMemberAdmin
> = {
  [MembershipChange.AddMember]: communityAddMemberAdmin,
  [MembershipChange.RemoveMember]: communityRemoveMemberAdmin,
  [MembershipChange.AddLeader]: communityAddLeaderAdmin,
  [MembershipChange.RemoveLeader]: communityRemoveLeaderAdmin,
};

export function useChangeCommunityMembershipAdmin() {
  const putCommunity = usePutCommunity();
  return useMutation({
    mutationFn: ({
      change,
      communityId,
      userId,
    }: {
      change: MembershipChange;
      communityId: number;
      userId: number;
    }) =>
      membershipEndpoints[change]({
        path: { communityId },
        body: { userId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: putCommunity,
  });
}

export function useDeleteCommunityAdmin(params: {
  onSuccess: () => void;
  onError: (err: Error) => void;
}) {
  const { onSuccess, onError } = params;
  const setCommunities = usePatchQueryData(communitiesQuery.queryKey);
  return useMutation({
    mutationFn: (communityId: number) =>
      communityDeleteAdmin({ path: { communityId }, throwOnError: true }),
    onSuccess: async (_, communityId) => {
      onSuccess();
      await setCommunities((prev) => prev.filter((c) => c.id !== communityId));
    },
    onError,
  });
}

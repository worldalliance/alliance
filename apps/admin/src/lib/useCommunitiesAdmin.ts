import {
  type AssignGroupsDto,
  communityCreateCommunityAdmin,
  communityGetCommunitiesAdmin,
  type CreateCommunityDto,
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

import {
  type AssignGroupsDto,
  communityGetCommunitiesAdmin,
  userAssignGroupsAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

const communitiesQuery = queryOptions({
  queryKey: queryKeys.communitiesAdmin(),
  queryFn: () =>
    communityGetCommunitiesAdmin({ throwOnError: true }).then((r) => r.data),
});

export function useCommunitiesAdmin() {
  return useQuery(communitiesQuery);
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

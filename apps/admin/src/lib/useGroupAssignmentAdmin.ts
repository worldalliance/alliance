import {
  type AssignGroupsDto,
  userGroupAssignmentAssignGroupsAdmin,
  userGroupAssignmentGetGroupAssignmentMembersAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useInvalidateCommunities } from "./useCommunitiesAdmin";
import { usePatchQueryData } from "./usePatchQueryData";

const groupAssignmentMembersQuery = queryOptions({
  queryKey: queryKeys.groupAssignmentMembersAdmin(),
  queryFn: () =>
    userGroupAssignmentGetGroupAssignmentMembersAdmin({
      throwOnError: true,
    }).then((r) => r.data),
});

export function useGroupAssignmentMembersAdmin() {
  return useQuery(groupAssignmentMembersQuery);
}

export function useAssignGroupsAdmin() {
  const queryClient = useQueryClient();
  const setMembers = usePatchQueryData(groupAssignmentMembersQuery.queryKey);
  const invalidateCommunities = useInvalidateCommunities();
  return useMutation({
    mutationFn: (body: AssignGroupsDto) =>
      userGroupAssignmentAssignGroupsAdmin({ body, throwOnError: true }),
    onSuccess: (_, body) => {
      const assigned = new Set(body.assignments.map(({ userId }) => userId));
      return setMembers((prev) =>
        prev.filter((member) => !assigned.has(member.id)),
      );
    },
    // A batch that fails part-way through the server's writes, or whose
    // response is lost, can leave some of it assigned.
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: groupAssignmentMembersQuery.queryKey,
      }),
    onSettled: invalidateCommunities,
  });
}

import {
  contractSuspendContractAdmin,
  type UpdateUserRolesAdminDto,
  userUpdateUserRolesAdmin,
  userUserDetailAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { loaderPrefetchStaleTime } from "./queryClient";
import { useStoreQueryData } from "./usePatchQueryData";

/** The member query, for a route loader to start before the page mounts. */
export const userDetailQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.userDetailAdmin(userId),
    queryFn: () =>
      userUserDetailAdmin({ path: { id: userId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    staleTime: loaderPrefetchStaleTime,
  });

/** One member's admin detail and the writes that change it. `refresh`
 * rejects when the refetch fails, so a caller that just wrote elsewhere can
 * say the page is stale. */
export function useUserDetailAdmin(userId: number) {
  const storeQueryData = useStoreQueryData();
  const options = userDetailQuery(userId);
  const { queryKey } = options;
  const query = useQuery(options);
  const { addUserToTag, removeUserFromTag } = useTagsAdmin({ enabled: false });

  const refresh = () => query.refetch({ throwOnError: true });

  const updateRoles = useMutation({
    mutationFn: (body: UpdateUserRolesAdminDto) =>
      userUpdateUserRolesAdmin({
        path: { id: userId },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (user) => storeQueryData(queryKey, user),
  });

  const suspendContract = useMutation({
    mutationFn: () =>
      contractSuspendContractAdmin({ path: { userId }, throwOnError: true }),
    // A failed refetch leaves the member cached; it doesn't undo the write.
    onSuccess: () => query.refetch(),
  });

  const setTagMembership = useMutation({
    mutationFn: ({ tagId, member }: { tagId: string; member: boolean }) =>
      (member ? addUserToTag : removeUserFromTag).mutateAsync({
        tagId,
        body: { userId },
      }),
    // A patch would cancel a refetch already in flight, such as a
    // suspension's, and drop what it was loading; a refetch replaces it.
    onSuccess: () => query.refetch(),
  });

  return { query, refresh, updateRoles, suspendContract, setTagMembership };
}

import {
  contractSuspendContractAdmin,
  type UpdateUserRolesAdminDto,
  userUpdateUserRolesAdmin,
  userUserDetailAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useStoreQueryData } from "./usePatchQueryData";

/** The member query, for a route loader to start before the page mounts. */
export const userDetailQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.userDetailAdmin(userId),
    queryFn: () =>
      userUserDetailAdmin({ path: { id: userId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    // Long enough that the page mounting just after the loader's prefetch
    // doesn't load the member again; the loader itself always fetches.
    staleTime: milliseconds({ seconds: 10 }),
  });

/** One member's admin detail and the writes that change it. `refresh`
 * rejects when the refetch fails, so a caller that just wrote elsewhere can
 * say the page is stale. */
export function useUserDetailAdmin(userId: number) {
  const storeQueryData = useStoreQueryData();
  const options = userDetailQuery(userId);
  const { queryKey } = options;
  const query = useQuery(options);

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

  return { query, refresh, updateRoles, suspendContract };
}

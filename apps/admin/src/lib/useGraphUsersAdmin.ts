import { userListForGraphAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useGraphUsersAdmin(params?: {
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.graphUsersAdmin(),
    queryFn: () =>
      userListForGraphAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
    ...params,
  });
}

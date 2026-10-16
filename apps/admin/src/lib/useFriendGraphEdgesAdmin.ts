import { userGetFriendGraphEdgesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useFriendGraphEdgesAdmin(params?: {
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.friendGraphEdgesAdmin(),
    queryFn: () =>
      userGetFriendGraphEdgesAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
    ...params,
  });
}

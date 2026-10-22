import { userOnetimeInviteGetOnetimeInviteGraphEdgesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useOnetimeInviteGraphEdgesAdmin(params?: {
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.onetimeInviteGraphEdgesAdmin(),
    queryFn: () =>
      userOnetimeInviteGetOnetimeInviteGraphEdgesAdmin({
        throwOnError: true,
      }).then((response) => response.data),
    ...params,
  });
}

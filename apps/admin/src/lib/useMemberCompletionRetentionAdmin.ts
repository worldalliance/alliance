import { analyticsGetMemberCompletionRetentionAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useMemberCompletionRetentionAdmin() {
  return useQuery({
    queryKey: queryKeys.memberCompletionRetentionAdmin(),
    queryFn: () =>
      analyticsGetMemberCompletionRetentionAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

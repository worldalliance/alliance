import { analyticsGetMissedActionsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useMissedActionsAdmin() {
  return useQuery({
    queryKey: queryKeys.missedActionsAdmin(),
    queryFn: () =>
      analyticsGetMissedActionsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

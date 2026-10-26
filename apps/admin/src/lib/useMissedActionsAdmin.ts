import { analyticsGetMissedActionsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useMissedActionsAdmin(options: { enabled: boolean }) {
  return useQuery({
    queryKey: queryKeys.missedActionsAdmin(),
    queryFn: () =>
      analyticsGetMissedActionsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    enabled: options.enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

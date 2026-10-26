import { analyticsGetTimeToChurnSamplesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useTimeToChurnSamplesAdmin() {
  return useQuery({
    queryKey: queryKeys.timeToChurnSamplesAdmin(),
    queryFn: () =>
      analyticsGetTimeToChurnSamplesAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

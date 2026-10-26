import { analyticsGetAggregateStatsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useAggregateStatsAdmin() {
  return useQuery({
    queryKey: queryKeys.aggregateStatsAdmin(),
    queryFn: () =>
      analyticsGetAggregateStatsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

import {
  analyticsGetActionStatsAdmin,
  analyticsRecalculateActionStatsAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useActionStats() {
  const queryClient = useQueryClient();

  const stats = useQuery({
    queryKey: queryKeys.actionStatsAdmin(),
    queryFn: () =>
      analyticsGetActionStatsAdmin({ throwOnError: true }).then((r) => r.data),
  });

  const recalculate = useMutation({
    mutationFn: () =>
      analyticsRecalculateActionStatsAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: async (data) => {
      // A refetch started before the recalculation would land stale stats
      // over these.
      await queryClient.cancelQueries({
        queryKey: queryKeys.actionStatsAdmin(),
      });
      queryClient.setQueryData(queryKeys.actionStatsAdmin(), data);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.actionCompletionCurvesAdminAll(),
      });
    },
  });

  return { stats, recalculate };
}

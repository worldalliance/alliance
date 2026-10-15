import { analyticsGetActionCompletionCurvesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  keepPreviousData,
  type QueryClient,
  useQuery,
} from "@tanstack/react-query";

export type GranularityMode = "daily" | "hourly";

export function useActionCompletionCurvesAdmin(granularity: GranularityMode) {
  return useQuery({
    queryKey: queryKeys.actionCompletionCurvesAdmin(granularity),
    // Always fetch all curves - needed to compute the average line
    queryFn: () =>
      analyticsGetActionCompletionCurvesAdmin({
        query: { granularity },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export const invalidateActionCompletionCurvesAdmin = (
  queryClient: QueryClient,
): void =>
  void queryClient.invalidateQueries({
    queryKey: queryKeys.actionCompletionCurvesAdminAll(),
  });

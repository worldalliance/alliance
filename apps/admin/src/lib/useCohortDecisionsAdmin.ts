import { cohortDecisionsListForActionAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useCohortDecisionsAdmin(actionId: number) {
  return useQuery({
    queryKey: queryKeys.actionCohortDecisionsAdmin(actionId),
    queryFn: () =>
      cohortDecisionsListForActionAdmin({
        path: { actionId },
        throwOnError: true,
      }).then((res) => res.data),
  });
}

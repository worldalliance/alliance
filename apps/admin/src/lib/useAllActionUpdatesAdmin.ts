import { actionUpdatesAllUpdatesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useAllActionUpdatesAdmin() {
  return useQuery({
    queryKey: queryKeys.actionUpdatesAllAdmin(),
    queryFn: () =>
      actionUpdatesAllUpdatesAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

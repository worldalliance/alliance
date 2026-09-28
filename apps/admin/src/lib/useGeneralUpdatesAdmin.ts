import { actionsAllGeneralUpdatesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const QUERY_KEY = queryKeys.generalUpdatesAdmin();

export function useGeneralUpdatesAdmin() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      actionsAllGeneralUpdatesAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

export function useInvalidateGeneralUpdatesAdmin(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    [queryClient],
  );
}

import { contractAllAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export function useContractsAdmin() {
  return useQuery({
    queryKey: queryKeys.contractsAdmin(),
    queryFn: () => contractAllAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

export function useInvalidateContractsAdmin(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.contractsAdmin() }),
    [queryClient],
  );
}

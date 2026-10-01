import { contractAllAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useContractsAdmin() {
  return useQuery({
    queryKey: queryKeys.contractsAdmin(),
    queryFn: () => contractAllAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

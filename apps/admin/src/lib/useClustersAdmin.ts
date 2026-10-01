import { clusterListAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useClustersAdmin() {
  return useQuery({
    queryKey: queryKeys.clustersAdmin(),
    queryFn: () => clusterListAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

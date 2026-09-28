import { contractAllAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions } from "@tanstack/react-query";

export const contractsAdminQuery = queryOptions({
  queryKey: queryKeys.contractsAdmin(),
  queryFn: () => contractAllAdmin({ throwOnError: true }).then((r) => r.data),
});

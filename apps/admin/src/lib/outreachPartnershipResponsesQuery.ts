import { actionPartnershipsFindAllResponsesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions } from "@tanstack/react-query";

export const outreachPartnershipResponsesQuery = queryOptions({
  queryKey: queryKeys.outreachPartnershipResponsesAdmin(),
  queryFn: () =>
    actionPartnershipsFindAllResponsesAdmin({ throwOnError: true }).then(
      (r) => r.data,
    ),
});

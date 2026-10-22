import { analyticsGetContractStatusHistoryAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useContractStatusHistoryAdmin(range: {
  start: string;
  end: string;
}) {
  return useQuery({
    queryKey: queryKeys.contractStatusHistoryAdmin(range),
    queryFn: () =>
      analyticsGetContractStatusHistoryAdmin({
        query: { startDate: range.start, endDate: range.end },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

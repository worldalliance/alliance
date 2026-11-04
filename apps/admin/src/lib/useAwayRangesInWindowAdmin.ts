import { userAwayRangeGetAwayRangesInWindowAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useAwayRangesInWindowAdmin(
  window: { from: Date; to: Date },
  { keepPrevious = false }: { keepPrevious?: boolean } = {},
) {
  const from = window.from.toISOString();
  const to = window.to.toISOString();
  return useQuery({
    queryKey: queryKeys.awayRangesInWindowAdmin(from, to),
    queryFn: () =>
      userAwayRangeGetAwayRangesInWindowAdmin({
        query: { from, to },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

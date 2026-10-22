import { analyticsGetDailyStatsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

/** `start` and `end` are date-input values the caller has already validated. */
export function useDailyStatsAdmin(range: { start: string; end: string }) {
  return useQuery({
    queryKey: queryKeys.dailyStatsAdmin(range),
    queryFn: () =>
      analyticsGetDailyStatsAdmin({
        query: {
          date: new Date(range.start).toISOString(),
          endDate: new Date(range.end).toISOString(),
        },
        throwOnError: true,
      }).then((r) =>
        [...r.data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      ),
  });
}

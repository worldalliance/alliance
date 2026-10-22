import {
  analyticsGetTimeSpentPerUserTotalAdmin,
  type TimeSpentForUserDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

const byUserId = (times: TimeSpentForUserDto[]): Record<number, number> =>
  Object.fromEntries(times.map((time) => [time.userId, time.timeSpent]));

export function useTimeSpentPerUserTotalAdmin() {
  return useQuery({
    queryKey: queryKeys.timeSpentPerUserTotalAdmin(),
    queryFn: () =>
      analyticsGetTimeSpentPerUserTotalAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    select: byUserId,
  });
}

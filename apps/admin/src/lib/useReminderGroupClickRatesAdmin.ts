import { analyticsGetReminderGroupClickRatesAdmin } from "@alliance/shared/client";
import type { ReminderGroupClickRatePointDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

type ReminderGroupClickRatePoint = Omit<
  ReminderGroupClickRatePointDto,
  "date"
> & { date: Date };

export function useReminderGroupClickRatesAdmin() {
  return useQuery({
    queryKey: queryKeys.reminderGroupClickRatesAdmin(),
    queryFn: () =>
      analyticsGetReminderGroupClickRatesAdmin({ throwOnError: true }).then(
        (r) =>
          r.data.map(
            (point): ReminderGroupClickRatePoint => ({
              ...point,
              date: new Date(point.date),
            }),
          ),
      ),
  });
}

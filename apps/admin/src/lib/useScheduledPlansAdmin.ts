import { actionsScheduledPlansAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

export function useScheduledPlansAdmin() {
  return useQuery({
    queryKey: queryKeys.scheduledPlansAdmin(),
    queryFn: () => {
      const now = Date.now();
      return actionsScheduledPlansAdmin({
        query: {
          rangeStart: new Date(now).toISOString(),
          rangeEnd: new Date(now + milliseconds({ days: 7 })).toISOString(),
        },
        throwOnError: true,
      }).then((r) => r.data);
    },
  });
}

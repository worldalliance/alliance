import { eventLogFindAllAdmin } from "@alliance/shared/client";
import type { EventType } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";

const EVENTS_PER_PAGE = 50;

export function useEventLogAdmin(eventType: EventType | "") {
  return usePaginatedQuery({
    queryKey: (page) =>
      queryKeys.eventLogAdmin(page, EVENTS_PER_PAGE, eventType),
    queryFn: (page) =>
      eventLogFindAllAdmin({
        query: {
          page,
          limit: EVENTS_PER_PAGE,
          ...(eventType ? { eventType } : {}),
        },
        throwOnError: true,
      }).then((response) => response.data),
  });
}

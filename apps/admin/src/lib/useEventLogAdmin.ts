import { eventLogFindAllAdmin } from "@alliance/shared/client";
import type { EventType } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const EVENTS_PER_PAGE = 50;

/** One page of the event log, keeping the previous page's rows on screen while it loads. */
export function useEventLogAdmin(page: number, eventType: EventType | "") {
  return useQuery({
    queryKey: queryKeys.eventLogAdmin(page, EVENTS_PER_PAGE, eventType),
    queryFn: () =>
      eventLogFindAllAdmin({
        query: {
          page,
          limit: EVENTS_PER_PAGE,
          ...(eventType ? { eventType } : {}),
        },
        throwOnError: true,
      }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });
}

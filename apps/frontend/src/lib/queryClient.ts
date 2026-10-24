import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { QueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: milliseconds({ days: 1 }),
      retry: retryUnlessRefused(3),
    },
  },
});

// Each is read by components that mount at different points of one page load,
// after the tasks route prefetches it or as later sections render; staying
// fresh that long keeps the later ones from refetching what just arrived.
for (const queryKey of [
  queryKeys.actions(),
  queryKeys.generalUpdatesUnread(),
  queryKeys.globalFeedAll(),
  queryKeys.notificationsLists(),
]) {
  queryClient.setQueryDefaults(queryKey, {
    staleTime: milliseconds({ seconds: 10 }),
  });
}

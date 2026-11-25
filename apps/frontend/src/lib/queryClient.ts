import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { HOME_UPDATES_LIMIT } from "@alliance/shared/lib/useActionUpdates";
import {
  loaderPrefetchStaleTime,
  queryClient,
} from "@alliance/sharedweb/lib/queryClient";
import { milliseconds } from "date-fns";

// The navbar bell and the project updates mount at different points of one page
// load; staying fresh that long keeps the later one from refetching.
queryClient.setQueryDefaults(queryKeys.notificationsLists(), {
  staleTime: milliseconds({ seconds: 10 }),
});

// The tasks route prefetches these, and the page and navbar read them after.
// The ["actions"] prefix also covers the unread general updates.
for (const queryKey of [
  queryKeys.actions(),
  queryKeys.actionUpdatesRecent(HOME_UPDATES_LIMIT),
]) {
  queryClient.setQueryDefaults(queryKey, {
    staleTime: loaderPrefetchStaleTime,
  });
}

export { queryClient };

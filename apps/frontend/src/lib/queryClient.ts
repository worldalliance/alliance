import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryClient } from "@alliance/sharedweb/lib/queryClient";
import { milliseconds } from "date-fns";

// The navbar bell and the updates row mount at different points of one page
// load; staying fresh that long keeps the later one from refetching.
queryClient.setQueryDefaults(queryKeys.notificationsLists(), {
  staleTime: milliseconds({ seconds: 10 }),
});

export { queryClient };

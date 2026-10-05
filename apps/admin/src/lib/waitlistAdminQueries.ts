import { queryKeys } from "@alliance/shared/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";

/** A tag write changes both the entries' tags and the tags' counts. */
export const invalidateTagQueries = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.waitlistEntriesAdminAll(),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlistTagsAdmin() }),
  ]);

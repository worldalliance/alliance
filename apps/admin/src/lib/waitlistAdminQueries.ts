import {
  waitlistAdminFindCohortsAdmin,
  waitlistAdminFindLinksAdmin,
  waitlistAdminFindTagsAdmin,
  waitlistEmailAdminFindTemplatesAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { type QueryClient, queryOptions } from "@tanstack/react-query";

export const waitlistLinksLoadFailed = "Unable to load waitlist links.";

export const waitlistLinksQuery = queryOptions({
  queryKey: queryKeys.waitlistLinksAdmin(),
  queryFn: () =>
    waitlistAdminFindLinksAdmin({ throwOnError: true }).then((r) => r.data),
});

export const waitlistTagsQuery = queryOptions({
  queryKey: queryKeys.waitlistTagsAdmin(),
  queryFn: () =>
    waitlistAdminFindTagsAdmin({ throwOnError: true }).then((r) => r.data),
});

export const waitlistCohortsQuery = queryOptions({
  queryKey: queryKeys.waitlistCohortsAdmin(),
  queryFn: () =>
    waitlistAdminFindCohortsAdmin({ throwOnError: true }).then((r) => r.data),
});

export const waitlistEmailTemplatesQuery = queryOptions({
  queryKey: queryKeys.waitlistEmailTemplatesAdmin(),
  queryFn: () =>
    waitlistEmailAdminFindTemplatesAdmin({ throwOnError: true }).then(
      (r) => r.data,
    ),
});

/** A tag write changes both the entries' tags and the tags' counts. */
export const invalidateTagQueries = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.waitlistEntriesAdminAll(),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlistTagsAdmin() }),
  ]);

import {
  campaignFindAllAdmin,
  waitlistAdminFindLinksAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions } from "@tanstack/react-query";

export const campaignsLoadFailed = "Unable to load organizations.";
export const waitlistLinksLoadFailed = "Unable to load waitlist links.";

export const campaignsQuery = queryOptions({
  queryKey: queryKeys.campaignsAdmin(),
  queryFn: () =>
    campaignFindAllAdmin({ throwOnError: true }).then((r) => r.data),
});

export const waitlistLinksQuery = queryOptions({
  queryKey: queryKeys.waitlistLinksAdmin(),
  queryFn: () =>
    waitlistAdminFindLinksAdmin({ throwOnError: true }).then((r) => r.data),
});

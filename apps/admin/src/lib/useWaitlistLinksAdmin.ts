import { waitlistAdminFindLinksAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export const waitlistLinksLoadFailed = "Unable to load waitlist links.";

export function useWaitlistLinksAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistLinksAdmin(),
    queryFn: () =>
      waitlistAdminFindLinksAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

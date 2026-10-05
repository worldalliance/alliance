import { waitlistAdminFindCohortsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useWaitlistCohortsAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistCohortsAdmin(),
    queryFn: () =>
      waitlistAdminFindCohortsAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

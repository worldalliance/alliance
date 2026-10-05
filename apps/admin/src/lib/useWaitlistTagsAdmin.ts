import { waitlistAdminFindTagsAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useWaitlistTagsAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistTagsAdmin(),
    queryFn: () =>
      waitlistAdminFindTagsAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

import { waitlistEmailAdminFindTemplatesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";

export function useWaitlistEmailTemplatesAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistEmailTemplatesAdmin(),
    queryFn: () =>
      waitlistEmailAdminFindTemplatesAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

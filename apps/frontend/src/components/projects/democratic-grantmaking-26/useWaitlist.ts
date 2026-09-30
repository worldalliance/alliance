import { waitlistCount } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { useQuery } from "@tanstack/react-query";

export function useWaitlistCount() {
  return useQuery({
    queryKey: queryKeys.waitlistCount(),
    queryFn: () =>
      waitlistCount({ throwOnError: true }).then((res) => res.data.waiting),
    retry: retryUnlessRefused(1),
  });
}

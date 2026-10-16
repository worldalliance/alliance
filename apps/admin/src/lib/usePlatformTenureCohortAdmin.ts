import { analyticsGetPlatformTenureCohortAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";

export function usePlatformTenureCohortAdmin(weeksOnPlatform: number | null) {
  return useQuery({
    queryKey: queryKeys.platformTenureCohortAdmin(weeksOnPlatform),
    queryFn:
      weeksOnPlatform === null
        ? skipToken
        : () =>
            analyticsGetPlatformTenureCohortAdmin({
              query: { weeksOnPlatform },
              throwOnError: true,
            }).then((r) => r.data),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.state.status === "error" ? undefined : previous,
  });
}

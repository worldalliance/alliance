import { analyticsGetPlatformTenureCohortAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";
import { keepPreviousUnlessFailed } from "./keepPreviousUnlessFailed";

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
    placeholderData: keepPreviousUnlessFailed,
  });
}

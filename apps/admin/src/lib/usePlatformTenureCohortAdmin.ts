import { analyticsGetPlatformTenureCohortAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousUnlessFailed } from "./keepPreviousUnlessFailed";

export function usePlatformTenureCohortAdmin(weeksOnPlatform: number) {
  return useQuery({
    queryKey: queryKeys.platformTenureCohortAdmin(weeksOnPlatform),
    queryFn: () =>
      analyticsGetPlatformTenureCohortAdmin({
        query: { weeksOnPlatform },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousUnlessFailed,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

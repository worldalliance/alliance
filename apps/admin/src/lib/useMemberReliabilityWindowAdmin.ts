import { analyticsGetMemberReliabilityWindowAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousUnlessFailed } from "./keepPreviousUnlessFailed";

export function useMemberReliabilityWindowAdmin(weeks: number) {
  return useQuery({
    queryKey: queryKeys.memberReliabilityWindowAdmin(weeks),
    queryFn: () =>
      analyticsGetMemberReliabilityWindowAdmin({
        query: { weeks },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousUnlessFailed,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

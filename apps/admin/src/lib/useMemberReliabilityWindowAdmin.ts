import { analyticsGetMemberReliabilityWindowAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";
import { keepPreviousUnlessFailed } from "./keepPreviousUnlessFailed";

export function useMemberReliabilityWindowAdmin(weeks: number | null) {
  return useQuery({
    queryKey: queryKeys.memberReliabilityWindowAdmin(weeks),
    queryFn:
      weeks === null
        ? skipToken
        : () =>
            analyticsGetMemberReliabilityWindowAdmin({
              query: { weeks },
              throwOnError: true,
            }).then((r) => r.data),
    placeholderData: keepPreviousUnlessFailed,
  });
}

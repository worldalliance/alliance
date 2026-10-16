import { analyticsGetInviteFunnelAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useInviteFunnelAdmin(range: { start: string; end: string }) {
  return useQuery({
    queryKey: queryKeys.inviteFunnelAdmin(range),
    queryFn: () =>
      analyticsGetInviteFunnelAdmin({
        query: { startDate: range.start, endDate: range.end },
        throwOnError: true,
      }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

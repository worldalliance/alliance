import {
  userGetOnetimeInviteMemberStatsAdmin,
  userGetOnetimeInvitesAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";
import { useQuery } from "@tanstack/react-query";

const INVITES_PER_PAGE = 50;

export function useOnetimeInvitesAdmin() {
  return usePaginatedQuery({
    queryKey: (page) => queryKeys.onetimeInvitesAdmin(page, INVITES_PER_PAGE),
    queryFn: (page) =>
      userGetOnetimeInvitesAdmin({
        query: { page, limit: INVITES_PER_PAGE },
        throwOnError: true,
      }).then((response) => response.data),
  });
}

export function useOnetimeInviteMemberStatsAdmin() {
  return useQuery({
    queryKey: queryKeys.onetimeInviteMemberStatsAdmin(),
    queryFn: () =>
      userGetOnetimeInviteMemberStatsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
}

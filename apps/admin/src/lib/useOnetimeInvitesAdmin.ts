import {
  userOnetimeInviteCreateOnetimeInvite,
  userOnetimeInviteGetOnetimeInviteMemberStatsAdmin,
  userOnetimeInviteGetOnetimeInvitesAdmin,
} from "@alliance/shared/client";
import type { CreateOnetimeInviteDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const INVITES_PER_PAGE = 50;

export function useOnetimeInvitesAdmin() {
  return usePaginatedQuery({
    queryKey: (page) => queryKeys.onetimeInvitesAdmin(page, INVITES_PER_PAGE),
    queryFn: (page) =>
      userOnetimeInviteGetOnetimeInvitesAdmin({
        query: { page, limit: INVITES_PER_PAGE },
        throwOnError: true,
      }).then((response) => response.data),
  });
}

export function useOnetimeInviteMemberStatsAdmin() {
  return useQuery({
    queryKey: queryKeys.onetimeInviteMemberStatsAdmin(),
    queryFn: () =>
      userOnetimeInviteGetOnetimeInviteMemberStatsAdmin({
        throwOnError: true,
      }).then((response) => response.data),
  });
}

export function useCreateOnetimeInviteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOnetimeInviteDto) =>
      userOnetimeInviteCreateOnetimeInvite({ body, throwOnError: true }).then(
        (response) => response.data,
      ),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.onetimeInvitesAdminAll(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.onetimeInviteMemberStatsAdmin(),
        }),
      ]),
  });
}

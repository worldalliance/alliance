import {
  actionsGetCommunityMemberInfoAdmin,
  communityGetMemberContactInfoAdmin,
  type CommunityUserInfoDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { contactInfoByUserId } from "@alliance/shared/lib/useCommunityMemberContactInfo";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const progressOf = (info: CommunityUserInfoDto) => ({
  actionSummaries: [...info.actions].reverse(),
  userActionRelations: Object.fromEntries(
    info.users.map(({ userId, relations }) => [userId, relations]),
  ),
});

/** A group's member progress (most recent actions first) and contact info,
 * plus `refresh` for after its membership changes. */
export function useCommunityMemberInfoAdmin(communityId: number | null) {
  const queryClient = useQueryClient();

  const progress = useQuery({
    queryKey: queryKeys.communityMemberInfoAdmin(communityId),
    queryFn:
      communityId === null
        ? skipToken
        : () =>
            actionsGetCommunityMemberInfoAdmin({
              path: { communityId },
              throwOnError: true,
            }).then((r) => r.data),
    select: progressOf,
  });

  const contactInfo = useQuery({
    queryKey: queryKeys.communityMemberContactInfoAdmin(communityId),
    queryFn:
      communityId === null
        ? skipToken
        : () =>
            communityGetMemberContactInfoAdmin({
              path: { communityId },
              throwOnError: true,
            }).then((r) => r.data),
    select: contactInfoByUserId,
  });

  const refresh = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.communityMemberInfoAdminAll(communityId),
      }),
    [queryClient, communityId],
  );

  return { progress, contactInfo, refresh };
}

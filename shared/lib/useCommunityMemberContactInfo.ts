import { skipToken, useQuery } from "@tanstack/react-query";
import { keyBy } from "es-toolkit";
import { communityGetMemberContactInfo } from "../client";
import type { CommunityMemberContactInfoDto } from "../client/types.gen";
import { queryKeys } from "./queryKeys";

const byUserId = (list: CommunityMemberContactInfoDto[]) =>
  keyBy(list, (info) => info.id);

/** Members' contact info keyed by user id; only a community's leaders may
 * read it, so nothing is requested unless `amLeader`. */
export function useCommunityMemberContactInfo({
  communityId,
  amLeader,
}: {
  communityId: number | undefined;
  amLeader: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.communityMemberContactInfo(communityId ?? null),
    queryFn:
      communityId === undefined || !amLeader
        ? skipToken
        : () =>
            communityGetMemberContactInfo({
              path: { communityId },
              throwOnError: true,
            }).then((res) => res.data),
    select: byUserId,
  });
}

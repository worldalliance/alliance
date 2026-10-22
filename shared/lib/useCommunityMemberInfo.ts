import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { actionsGetCommunityMemberInfo } from "../client";
import { queryKeys } from "./queryKeys";
import { useOnNextDeadline } from "./useOnNextDeadline";

export function useCommunityMemberInfo({
  communityId,
  userId,
}: {
  communityId: number | undefined;
  userId: number | undefined;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.communityMemberInfo(communityId, userId),
    queryFn:
      communityId === undefined
        ? skipToken
        : () =>
            actionsGetCommunityMemberInfo({ path: { communityId } }).then(
              (res) => res.data ?? null,
            ),
    // "Next task due" depends on the server's request-time `now` and on member
    // completion state; mobile's default staleTime is 5 minutes.
    staleTime: 0,
  });

  useOnNextDeadline(
    query.data?.actions,
    useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.communityMemberInfo(communityId, userId),
      });
    }, [queryClient, communityId, userId]),
  );

  return query;
}

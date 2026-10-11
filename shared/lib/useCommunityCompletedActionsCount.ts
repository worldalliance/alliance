import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { actionsCommunityCompletedActionsCount } from "../client";
import { queryKeys } from "./queryKeys";
import { useOnNextDeadline } from "./useOnNextDeadline";

/** (member, action) pairs among a community's current members whose latest
 * completion or withdrawal is a completion; refetched as each of `actions`'
 * member-action deadlines passes. */
export function useCommunityCompletedActionsCount({
  communityId,
  actions,
}: {
  communityId: number | undefined;
  actions: { memberActionDeadline?: number | null }[] | undefined;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.communityCompletedActionsCount(communityId ?? null),
    queryFn:
      communityId === undefined
        ? skipToken
        : () =>
            actionsCommunityCompletedActionsCount({
              query: { communityId },
              throwOnError: true,
            }).then((res) => res.data.completedCount),
  });

  useOnNextDeadline(
    actions,
    useCallback(() => {
      if (communityId === undefined) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.communityCompletedActionsCount(communityId),
      });
    }, [queryClient, communityId]),
  );

  return query;
}

import { actionFeedHomeFeed } from "@alliance/shared/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { buildFeedPage, useFeedQuery } from "./feedHelpers";

export type UseHomeFeedProps = {
  comments?: boolean;
  limit?: number;
};

const QUERY_KEY_ROOT = "useHomeFeed";

// Surface a just-completed action / follow-up in the user's own feed.
// resetQueries (not invalidate) avoids refetching every loaded page of the
// paginated feed.
export function useResetHomeFeed(): () => void {
  const queryClient = useQueryClient();
  return useCallback(
    () => void queryClient.resetQueries({ queryKey: [QUERY_KEY_ROOT] }),
    [queryClient],
  );
}

const useHomeFeed = (props: UseHomeFeedProps = {}) => {
  const limit = props.limit ?? 20;
  const comments = props.comments ?? false;

  return useFeedQuery({
    queryKeyRoot: QUERY_KEY_ROOT,
    queryKey: [QUERY_KEY_ROOT, limit, comments],
    limit,
    fetchPage: async (before) => {
      const resp = await actionFeedHomeFeed({
        query: {
          limit: limit.toString(),
          before: before ?? new Date().toISOString(),
          comments,
        },
      });
      return buildFeedPage(resp.data ?? []);
    },
  });
};

export default useHomeFeed;

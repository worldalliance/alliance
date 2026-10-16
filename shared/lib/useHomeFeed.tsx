import { actionFeedHomeFeed } from "@alliance/shared/client";
import { buildFeedPage, useFeedQuery } from "./feedHelpers";

export type UseHomeFeedProps = {
  comments?: boolean;
  limit?: number;
};

const QUERY_KEY_ROOT = "useHomeFeed";

type ResettableQueryClient = {
  resetQueries: (filters: { queryKey: readonly unknown[] }) => unknown;
};

// Surface a just-completed action / follow-up in the user's own feed.
// resetQueries (not invalidate) avoids refetching every loaded page of the
// paginated feed.
export const resetHomeFeed = (queryClient: ResettableQueryClient) =>
  queryClient.resetQueries({ queryKey: [QUERY_KEY_ROOT] });

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

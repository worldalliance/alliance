import { actionFeedUserFeed } from "@alliance/shared/client";
import { buildFeedPage, useFeedQuery } from "./feedHelpers";

export type UseUserFeedProps = {
  userId: number;
  comments?: boolean;
  limit?: number;
};

const QUERY_KEY_ROOT = "useUserFeed";

const useUserFeed = (props: UseUserFeedProps) => {
  const limit = props.limit ?? 20;
  const comments = props.comments ?? false;

  return useFeedQuery({
    queryKeyRoot: QUERY_KEY_ROOT,
    queryKey: [QUERY_KEY_ROOT, props.userId, limit, comments],
    limit,
    enabled: Boolean(props.userId),
    fetchPage: async (before) => {
      const resp = await actionFeedUserFeed({
        path: { id: props.userId },
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

export default useUserFeed;

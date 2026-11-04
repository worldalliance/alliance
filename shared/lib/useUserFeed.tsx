import { actionFeedUserFeed } from "@alliance/shared/client";
import { useFeedQuery } from "./feedHelpers";

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
    queryKey: [QUERY_KEY_ROOT, props.userId, limit, comments],
    comments,
    limit,
    enabled: Boolean(props.userId),
    fetchItems: ({ before, signal }) =>
      actionFeedUserFeed({
        path: { id: props.userId },
        query: {
          limit: limit.toString(),
          before: before ?? new Date().toISOString(),
          comments,
        },
        throwOnError: true,
        signal,
      }).then((response) => response.data),
  });
};

export default useUserFeed;

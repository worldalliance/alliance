import { queryOptions, useQuery } from "@tanstack/react-query";
import { actionFeedGetGlobalFeed, GlobalFeedItemDto } from "../client";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";

const NO_ITEMS: GlobalFeedItemDto[] = [];

export const globalFeedQuery = (limit: number) =>
  queryOptions({
    queryKey: queryKeys.globalFeed(limit),
    queryFn: ({ signal }) =>
      actionFeedGetGlobalFeed({
        query: { limit },
        throwOnError: true,
        signal,
      }).then((response) => response.data),
  });

const useGlobalFeed = ({ limit = 15 }) => {
  const query = useQuery(globalFeedQuery(limit));
  const didFail = failedToLoad(query);

  return {
    items: query.data ?? NO_ITEMS,
    loading: query.isPending && !didFail,
    failure: didFail
      ? { onRetry: () => void query.refetch(), retrying: query.isFetching }
      : null,
  };
};

export default useGlobalFeed;

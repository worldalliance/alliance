import { queryOptions, useQuery } from "@tanstack/react-query";
import { actionFeedGetGlobalFeed, GlobalFeedItemDto } from "../client";
import { queryKeys } from "./queryKeys";

const NO_ITEMS: GlobalFeedItemDto[] = [];

export const globalFeedQuery = (limit: number) =>
  queryOptions({
    queryKey: queryKeys.globalFeed(limit),
    queryFn: () =>
      actionFeedGetGlobalFeed({ query: { limit }, throwOnError: true }).then(
        (response) => response.data,
      ),
  });

const useGlobalFeed = ({ limit = 15 }) => {
  const { data, isPending, error } = useQuery(globalFeedQuery(limit));

  return {
    items: data ?? NO_ITEMS,
    loading: isPending,
    error,
  };
};

export default useGlobalFeed;

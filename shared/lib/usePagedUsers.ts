import type { ProfileDto } from "@alliance/shared/client";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { useMemo } from "react";
import { USER_LIST_PAGE_SIZE } from "./userList";

export type UserPageQuery = { limit: number; afterId?: number };

/**
 * Paginated users; `afterId` is the last user id from the previous
 * server-ordered page. Pages are `USER_LIST_PAGE_SIZE` so the loading
 * skeleton's clamp matches the first page.
 */
export const usePagedUsers = ({
  queryKey,
  fetchPage,
  enabled,
}: {
  queryKey: QueryKey;
  fetchPage: (query: UserPageQuery) => Promise<{ data?: ProfileDto[] }>;
  enabled: boolean;
}) => {
  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const resp = await fetchPage({
        limit: USER_LIST_PAGE_SIZE,
        afterId: pageParam,
      });
      return resp.data ?? [];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < USER_LIST_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.id,
    enabled,
  });

  const users = useMemo(() => data?.pages.flat() ?? [], [data]);

  return {
    users,
    loading,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
  };
};

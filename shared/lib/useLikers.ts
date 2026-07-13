import {
  likesGetActivityUsers,
  likesGetCommentUsers,
  likesGetPostUsers,
  type ProfileDto,
} from "@alliance/shared/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { USER_LIST_PAGE_SIZE } from "./userList";

export type LikeTargetType = "post" | "comment" | "activity";

type LikersQuery = { limit: number; afterId?: number };
type LikersFetcher = (
  id: number,
  query: LikersQuery,
) => Promise<{ data?: ProfileDto[] }>;

const LIKERS_FETCHERS: Record<LikeTargetType, LikersFetcher> = {
  post: (id, query) => likesGetPostUsers({ path: { id }, query }),
  comment: (id, query) => likesGetCommentUsers({ path: { id }, query }),
  activity: (id, query) => likesGetActivityUsers({ path: { id }, query }),
};

const QUERY_KEY_ROOT = "useLikers";

export type UseLikersProps = {
  targetType: LikeTargetType;
  targetId: number;
  enabled?: boolean;
};

/**
 * Paginated likers for post/comment/activity. `afterId` is the last user id
 * from the previous server-ordered page. Pages are `USER_LIST_PAGE_SIZE` so
 * the loading skeleton's clamp matches the first page.
 */
export const useLikers = ({
  targetType,
  targetId,
  enabled = true,
}: UseLikersProps) => {
  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [QUERY_KEY_ROOT, targetType, targetId],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const resp = await LIKERS_FETCHERS[targetType](targetId, {
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

export default useLikers;

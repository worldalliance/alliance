import { type QueryClient, type QueryKey } from "@tanstack/react-query";
import {
  forumFindAllPosts,
  forumFindPostsByUser,
  type PostDto,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import { forumPostStore, PostFields, selectPost } from "./forumPostStore";
import { queryKeys } from "./queryKeys";
import { useEntityList } from "./useEntityList";

export function invalidateForumPostLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.forumPostListsAll(),
  });
}

function usePostList(params: {
  queryKey: QueryKey;
  carries: readonly PostFields[];
  fetch: (signal: AbortSignal) => Promise<PostDto[]>;
  enabled?: boolean;
  staleTime?: number;
}) {
  const { carries, fetch, ...options } = params;
  return useEntityList({
    ...options,
    store: forumPostStore,
    select: selectPost,
    load: ({ store, signal }) =>
      store.load({ carries, signal, fetch: () => fetch(signal) }),
  });
}

export function useForumPosts() {
  const query = usePostList({
    queryKey: queryKeys.forumPosts(),
    carries: [PostFields.Thread],
    fetch: (signal) =>
      forumFindAllPosts({ throwOnError: true, signal }).then((r) => r.data),
    // Every mount reloads the list; mobile's default staleTime is 5 minutes.
    staleTime: 0,
  });
  const {
    data: posts = NO_POSTS,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = query;

  return {
    posts,
    isLoading,
    isError,
    isFetching,
    didFail: failedToLoad(query),
    refetch,
  };
}

/** Posts `userId` wrote or co-wrote. */
export const useUserForumPosts = (userId: number) =>
  usePostList({
    queryKey: queryKeys.forumPostsByUser(userId),
    carries: [],
    fetch: (signal) =>
      forumFindPostsByUser({
        path: { id: userId },
        throwOnError: true,
        signal,
      }).then((r) => r.data),
    enabled: Boolean(userId),
  });

const NO_POSTS: PostDto[] = [];

import {
  type QueryClient,
  type QueryKey,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  forumFindAllPosts,
  forumFindPostsByUser,
  type PostDto,
} from "../client";
import { failedToLoad } from "./failedToLoad";
import { forumPostStore, PostFields, selectPost } from "./forumPostStore";
import { queryKeys } from "./queryKeys";
import { useStoreState } from "./useStoreState";

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
  const queryClient = useQueryClient();
  const state = useStoreState(forumPostStore);
  const select = useCallback(
    (ids: number[]) => ids.map((id) => selectPost(state, id)),
    [state],
  );
  return useQuery({
    ...options,
    queryFn: async ({ signal }) => {
      const posts = await forumPostStore(queryClient).load({
        carries,
        signal,
        fetch: () => fetch(signal),
      });
      return posts.map(({ id }) => id);
    },
    select,
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

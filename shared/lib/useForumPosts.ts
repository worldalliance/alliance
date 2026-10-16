import { useQuery, type QueryClient } from "@tanstack/react-query";
import { forumFindAllPosts, type PostDto } from "../client";
import { failedToLoad } from "./failedToLoad";
import { queryKeys } from "./queryKeys";

/** Drops a removed post from the cached list, cancelling a reload that may
 * have read it first. */
export async function dropForumPost(queryClient: QueryClient, postId: number) {
  await queryClient.cancelQueries({ queryKey: queryKeys.forumPosts() });
  queryClient.setQueryData<PostDto[]>(queryKeys.forumPosts(), (posts) =>
    posts?.filter((post) => post.id !== postId),
  );
}

export function useForumPosts() {
  const query = useQuery({
    queryKey: queryKeys.forumPosts(),
    queryFn: () =>
      forumFindAllPosts({ throwOnError: true }).then((r) => r.data),
    // Every mount reloads the list; mobile's default staleTime is 5 minutes.
    staleTime: 0,
  });
  const { data: posts = [], isLoading, isError, isFetching, refetch } = query;

  return {
    posts,
    isLoading,
    isError,
    isFetching,
    didFail: failedToLoad(query),
    refetch,
  };
}

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  forumCreatePost,
  forumFindOnePost,
  forumLikePost,
  forumRemovePost,
  forumUnlikePost,
  forumUpdatePost,
  type CreatePostDto,
  type PostDto,
  type UpdatePostDto,
} from "../client";
import { queryKeys } from "./queryKeys";

/** One forum post and its writes. An undefined `postId` fetches nothing, for
 * the create form; `update` and `remove` throw then. `refetchOnMount:
 * "always"` makes `isFetchedAfterMount` turn true whatever the client's
 * staleTime. */
export function useForumPost(
  postId: string | undefined,
  {
    userId,
    refetchOnMount,
  }: { userId?: number; refetchOnMount?: "always" } = {},
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.forumPost(postId);

  const {
    data: post = null,
    isLoading,
    isFetchedAfterMount,
    error,
  } = useQuery({
    queryKey,
    queryFn: postId
      ? () =>
          forumFindOnePost({ path: { id: postId } }).then(
            (res) => res.data ?? null,
          )
      : skipToken,
    refetchOnMount,
  });

  const { mutateAsync: toggleLike } = useMutation({
    mutationFn: async (previous: PostDto) => {
      const options = { path: { id: previous.id } };
      if (previous.likedByMe) await forumUnlikePost(options);
      else await forumLikePost(options);
    },
    onMutate: (previous: PostDto) => {
      queryClient.setQueryData<PostDto | null>(queryKey, {
        ...previous,
        likedByMe: !previous.likedByMe,
        likeCount: Math.max(
          0,
          (previous.likeCount ?? 0) + (previous.likedByMe ? -1 : 1),
        ),
      });
    },
    onError: (_err, previous) => {
      queryClient.setQueryData<PostDto | null>(queryKey, previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleLike = useCallback(async () => {
    if (!post || !userId) return;
    await toggleLike(post);
  }, [post, userId, toggleLike]);

  // A created post is left uncached: the create response lacks the action and
  // tags the post page shows, so that page loads it instead.
  const { mutateAsync: create } = useMutation({
    mutationFn: (body: CreatePostDto) =>
      forumCreatePost({ body, throwOnError: true }).then((r) => r.data),
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: (body: UpdatePostDto) => {
      if (!postId) throw new Error("No post to update");
      return forumUpdatePost({
        path: { id: Number(postId) },
        body,
        throwOnError: true,
      }).then((r) => r.data);
    },
    onSuccess: async (saved) => {
      const savedKey = queryKeys.forumPost(String(saved.id));
      // A refetch in flight would land the old post back over the save.
      await queryClient.cancelQueries({ queryKey: savedKey });
      queryClient.setQueryData(savedKey, saved);
    },
  });

  const { mutateAsync: remove, isSuccess: removed } = useMutation({
    mutationFn: async () => {
      if (!postId) throw new Error("No post to remove");
      await forumRemovePost({
        path: { id: Number(postId) },
        throwOnError: true,
      });
    },
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, null);
    },
  });

  return {
    post,
    isLoading,
    isFetchedAfterMount,
    error,
    handleLike,
    create,
    update,
    remove,
    removed,
  };
}

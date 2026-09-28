import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  forumFindOnePost,
  forumLikePost,
  forumUnlikePost,
  type PostDto,
} from "../client";
import { queryKeys } from "./queryKeys";

export function useForumPost(
  postId: string | undefined,
  userId: number | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.forumPost(postId);

  const {
    data: post = null,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: postId
      ? () =>
          forumFindOnePost({ path: { id: postId } }).then(
            (res) => res.data ?? null,
          )
      : skipToken,
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

  return { post, isLoading, error, handleLike };
}

import {
  CommentDto,
  forumLikeComment,
  forumUnlikeComment,
} from "@alliance/shared/client";
import { updateCommentInTree } from "@alliance/shared/lib/commentTree";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

interface UseCommentLikeMutationOptions {
  userId: number | undefined;
  setComments: (update: (prev: CommentDto[]) => CommentDto[]) => void;
  fetchComments: () => void;
}

export function useCommentLikeMutation({
  userId,
  setComments,
  fetchComments,
}: UseCommentLikeMutationOptions) {
  const mutation = useMutation({
    mutationFn: async ({
      replyId,
      unlike,
    }: {
      replyId: number;
      unlike: boolean;
    }) => {
      if (unlike) {
        await forumUnlikeComment({ path: { id: replyId } });
      } else {
        await forumLikeComment({ path: { id: replyId } });
      }
    },
    onMutate: ({ replyId, unlike }) => {
      if (!userId) return;

      let previousComments: CommentDto[] | null = null;
      setComments((prev) => {
        previousComments = prev;
        return updateCommentInTree({
          comments: prev,
          id: replyId,
          update: (comment) => ({
            ...comment,
            likedByMe: !unlike,
            likesCount: Math.max(0, comment.likesCount + (unlike ? -1 : 1)),
          }),
        });
      });
      return { previousComments };
    },
    onError: (_err, _vars, context) => {
      const previous = context?.previousComments;
      if (previous) setComments(() => previous);
    },
    onSettled: () => {
      fetchComments();
    },
  });

  const { mutateAsync } = mutation;

  const handleLikeReply = useCallback(
    (replyId: number, unlike = false) => {
      return mutateAsync({ replyId, unlike });
    },
    [mutateAsync],
  );

  return handleLikeReply;
}

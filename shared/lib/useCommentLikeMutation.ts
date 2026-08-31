import {
  CommentDto,
  forumLikeComment,
  forumUnlikeComment,
} from "@alliance/shared/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

interface UseCommentLikeMutationOptions {
  userId: number | undefined;
  setComments: (fn: (prev: CommentDto[] | null) => CommentDto[] | null) => void;
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

      const updateRecursively = (items: CommentDto[]): CommentDto[] =>
        items.map((item) => {
          if (item.id === replyId) {
            return {
              ...item,
              likedByMe: !unlike,
              likesCount: Math.max(0, item.likesCount + (unlike ? -1 : 1)),
            };
          }
          if (item.children?.length) {
            return { ...item, children: updateRecursively(item.children) };
          }
          return item;
        });

      let previousComments: CommentDto[] | null = null;
      setComments((prev) => {
        previousComments = prev;
        return prev ? updateRecursively(prev) : prev;
      });
      return { previousComments };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousComments)
        setComments(() => context.previousComments);
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

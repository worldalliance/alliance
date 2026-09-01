import { R } from "@alliance/common/result";
import { CommentDto, forumDeleteComment } from "@alliance/shared/client";
import { omit } from "es-toolkit";
import { useCallback, useEffect, useState } from "react";

const DELETE_FAILED = "Failed to delete reply";

interface UseDeleteCommentInput {
  comments: CommentDto[] | null;
  fetchComments: () => Promise<void>;
}

function isDeleted(comments: CommentDto[], replyId: number): boolean {
  return comments.some(
    (comment) =>
      (comment.id === replyId && comment.deleted) ||
      isDeleted(comment.children ?? [], replyId),
  );
}

// Keyed by the reply the delete was asked of, so the message lands under the
// comment still sitting there rather than at the top of the thread.
export function useDeleteComment({
  comments,
  fetchComments,
}: UseDeleteCommentInput) {
  const [failures, setFailures] = useState<Record<number, string>>({});

  // A delete whose answer never came back still landed on the server, and a
  // reload brings that reply back deleted. The message under it is wrong by
  // then, and a deleted reply has no Delete left to press to clear it.
  useEffect(() => {
    if (!comments) return;
    setFailures((prev) => {
      const stale = Object.keys(prev)
        .map(Number)
        .filter((replyId) => isDeleted(comments, replyId));
      return stale.length > 0 ? omit(prev, stale) : prev;
    });
  }, [comments]);

  const clearDeleteError = useCallback(
    (replyId: number) => setFailures((prev) => omit(prev, [replyId])),
    [],
  );

  const deleteReply = useCallback(
    async (replyId: number) => {
      clearDeleteError(replyId);
      // The generated client leaves its fetch call unguarded, so a request
      // that never reaches the server rejects rather than answering.
      const sent = await R.fromPromise(
        forumDeleteComment({ path: { id: replyId } }),
      );
      if (!sent.ok) {
        console.error("Error deleting reply:", sent.error);
        setFailures((prev) => ({ ...prev, [replyId]: DELETE_FAILED }));
        return;
      }
      await fetchComments();
    },
    [clearDeleteError, fetchComments],
  );

  const deleteErrorFor = useCallback(
    (replyId: number): string | null => failures[replyId] ?? null,
    [failures],
  );

  return { deleteReply, deleteErrorFor, clearDeleteError };
}

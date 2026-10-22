import { ExceptionEvent } from "@alliance/common/analytics";
import { refusalMessage } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  CreateEditableContentDto,
  forumCreateComment,
  forumPinCommentAdmin,
  forumUpdateComment,
} from "@alliance/shared/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { captureException } from "./analytics";
import { updateCommentInTree } from "./commentTree";
import { replyRefusalMessage } from "./replyRefusal";
import { useCommentLikeMutation } from "./useCommentLikeMutation";
import { useDeleteComment } from "./useDeleteComment";
import { useLoadComments } from "./useLoadComments";

const SUBMIT_FAILED = "Failed to submit reply";
const EDIT_FAILED = "Failed to save your edit";

interface UseCommentThreadInput {
  objectId: number;
  type: CommentParentObject;
  initialComments?: CommentDto[];
  userId: number | undefined;
}

interface CreateCommentInput {
  content: CreateEditableContentDto;
  parentId: number | null;
  /** Applies only to a top-level comment. */
  tagId: number | undefined;
}

/** One object's comment thread and every write to it. */
export function useCommentThread({
  objectId,
  type,
  initialComments,
  userId,
}: UseCommentThreadInput) {
  const { setComments, ...thread } = useLoadComments({
    objectId,
    type,
    initialComments,
  });
  const { fetchComments } = thread;
  const { deleteReply, deleteErrorFor, clearDeleteError } = useDeleteComment({
    comments: thread.comments,
    fetchComments,
  });
  const likeComment = useCommentLikeMutation({
    userId,
    setComments,
    fetchComments,
  });

  // A paused write would leave its form spinning offline instead of saying
  // the request failed.
  const { mutateAsync: createComment } = useMutation({
    networkMode: "always",
    mutationFn: async ({
      content,
      parentId,
      tagId,
    }: CreateCommentInput): Promise<Result<CommentDto, string>> => {
      // Mobile configures the client to throw on a refusal, which loses the
      // response the status below is read off.
      const sent = await R.fromPromise(
        forumCreateComment({
          body: {
            parentObjectId: objectId,
            parentId: parentId ?? undefined,
            parentObjectType: type,
            editableContent: content,
            tagId: parentId === null ? tagId : undefined,
          },
          throwOnError: false,
        }),
      );
      if (!sent.ok) {
        console.error("Error posting reply:", sent.error);
        captureException(ExceptionEvent.PostReplyError, sent.error);
        return R.failure(SUBMIT_FAILED);
      }
      const { data, error, response } = sent.value;
      if (!data) {
        // The comment may have been deleted, which a reload shows.
        if (parentId !== null && response.status === 404) void fetchComments();
        return R.failure(
          replyRefusalMessage({ status: response.status, error }),
        );
      }
      // A reload that hangs would hold the composer on a comment already
      // posted.
      void fetchComments();
      return R.success(data);
    },
  });

  const { mutateAsync: saveEdit } = useMutation({
    networkMode: "always",
    mutationFn: async ({
      id,
      content,
    }: {
      id: number;
      content: CreateEditableContentDto;
    }): Promise<Result<void, string>> => {
      const sent = await R.fromPromise(
        forumUpdateComment({
          path: { id },
          body: { editableContent: content },
          throwOnError: false,
        }),
      );
      if (!sent.ok) {
        console.error("Failed to update comment:", sent.error);
        return R.failure(EDIT_FAILED);
      }
      const { error, response } = sent.value;
      if (error) {
        return R.failure(
          refusalMessage({
            status: response.status,
            error,
            fallback: EDIT_FAILED,
            sessionExpired:
              "Your session has expired. Sign in again to save your edit.",
          }),
        );
      }
      setComments((prev) =>
        updateCommentInTree({
          comments: prev,
          id,
          update: (comment) => ({ ...comment, editableContent: content }),
        }),
      );
      return R.success(undefined);
    },
  });

  const updateComment = useCallback(
    (id: number, content: CreateEditableContentDto) =>
      saveEdit({ id, content }),
    [saveEdit],
  );

  const { mutateAsync: pinComment } = useMutation({
    networkMode: "always",
    mutationFn: async (id: number) => {
      await forumPinCommentAdmin({ path: { id } });
    },
    onSuccess: () => {
      void fetchComments();
    },
  });

  return {
    ...thread,
    createComment,
    updateComment,
    pinComment,
    likeComment,
    deleteReply,
    deleteErrorFor,
    clearDeleteError,
  };
}

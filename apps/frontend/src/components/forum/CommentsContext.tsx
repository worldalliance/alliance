import { ExceptionEvent } from "@alliance/common/analytics";
import { errorMessage } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  CreateCommentDto,
  CreateEditableContentDto,
  forumCreateComment,
  forumDeleteComment,
  forumPinCommentAdmin,
  forumUpdateComment,
  PostTagDto,
  UserDto,
} from "@alliance/shared/client";
import { captureException } from "@alliance/shared/lib/analytics";
import { TagFilter } from "@alliance/shared/lib/commentTags";
import { updateCommentInTree } from "@alliance/shared/lib/commentTree";
import { useCommentLikeMutation } from "@alliance/shared/lib/useCommentLikeMutation";
import { useLoadComments } from "@alliance/shared/lib/useLoadComments";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../../lib/AuthContext";

interface CommentsContextValue {
  user?: UserDto;
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  handleSubmitReply: (
    content: CreateEditableContentDto,
    onSuccess?: () => void,
  ) => Promise<void>;
  handleDeleteReply: (id: number) => Promise<void>;
  onUpdateReply: (
    id: number,
    content: CreateEditableContentDto,
  ) => Promise<Result<void, string>>;
  submitErrorFor: (parentId: number | null) => string | null;
  clearSubmitError: () => void;
  onLikeReply: (id: number, unlike?: boolean) => Promise<unknown>;
  onPinReply: (id: number) => Promise<void>;
  newlyAddedReplies: Set<number>;
  highlightedReplyId: number | null;
  expertIds: number[];
  expertLabel?: string;
  showClusterTags?: boolean;
  compact?: boolean;
  showUserBadges?: boolean;
  tags: readonly PostTagDto[];
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

export function useCommentsContext(): CommentsContextValue {
  const ctx = useContext(CommentsContext);
  if (!ctx) {
    throw new Error(
      "useCommentsContext must be used within a CommentsProvider",
    );
  }
  return ctx;
}

export interface UseCommentTreeResult {
  comments: CommentDto[] | null;
  error: string | null;
  fetchComments: () => Promise<void>;
  handleSubmitReply: (
    content: CreateEditableContentDto,
    onSuccess?: () => void,
  ) => Promise<void>;
  handleDeleteReply: (id: number) => Promise<void>;
  handleUpdateReply: (
    id: number,
    content: CreateEditableContentDto,
  ) => Promise<Result<void, string>>;
  submitErrorFor: (parentId: number | null) => string | null;
  clearSubmitError: () => void;
  handleLikeReply: (id: number, unlike?: boolean) => Promise<unknown>;
  handlePinReply: (id: number) => Promise<void>;
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  focusComposer: boolean;
  newlyAddedReplies: Set<number>;
  highlightedReplyId: number | null;
  selectedTagId: number | undefined;
  setSelectedTagId: (id: number | undefined) => void;
  tagFilter: TagFilter;
  setTagFilter: (filter: TagFilter) => void;
}

export function useCommentTree(
  objectId: number,
  type: CommentParentObject,
  initialComments?: CommentDto[],
): UseCommentTreeResult {
  const { comments, setComments, error, setError, fetchComments } =
    useLoadComments({ objectId, type, initialComments });
  // Keyed by the form that produced it, so a nested reply's rejection shows
  // under that reply rather than at the top of the thread.
  const [submitError, setSubmitError] = useState<{
    parentId: number | null;
    message: string;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  // A rejection shows only under the form that produced it, so opening any
  // other form drops it. One that landed while its form was closed waits for
  // that form to open again.
  const openReplyForm = useCallback((id: number | null) => {
    setSubmitError((prev) => (prev?.parentId === id ? prev : null));
    setReplyingTo(id);
  }, []);
  // The composer takes the caret when the user asked for it, not when it comes
  // back after a reply posted further down the thread.
  const [focusComposer, setFocusComposer] = useState(true);
  const [selectedTagId, setSelectedTagId] = useState<number | undefined>(
    undefined,
  );
  const [tagFilter, setTagFilter] = useState<TagFilter>(undefined);
  const [newlyAddedReplies, setNewlyAddedReplies] = useState<Set<number>>(
    new Set(),
  );
  const [lastAddedReplyId, setLastAddedReplyId] = useState<number | null>(null);
  const [highlightedReplyId, setHighlightedReplyId] = useState<number | null>(
    null,
  );
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle highlighted reply from URL parameters
  useEffect(() => {
    const replyId = searchParams.get("replyId");
    if (replyId) {
      const replyIdNumber = parseInt(replyId, 10);
      if (!isNaN(replyIdNumber)) {
        setHighlightedReplyId(replyIdNumber);

        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("replyId");
        setSearchParams(newSearchParams, { replace: true });

        setTimeout(() => {
          const replyElement = document.getElementById(
            `reply-${replyIdNumber}`,
          );
          if (replyElement) {
            replyElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 500);

        setTimeout(() => {
          setHighlightedReplyId(null);
        }, 5000);
      }
    }
  }, [searchParams, setSearchParams]);

  // After comments refresh, scroll the newly added reply into view
  useEffect(() => {
    if (!lastAddedReplyId || !comments) return;
    const timeout = setTimeout(() => {
      const el = document.getElementById(`reply-${lastAddedReplyId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setLastAddedReplyId(null);
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [comments, lastAddedReplyId]);

  const handleSubmitReply = useCallback(
    async (contentDto: CreateEditableContentDto, onSuccess?: () => void) => {
      try {
        setSubmitError(null);
        const commentDto: CreateCommentDto = {
          parentObjectId: Number(objectId),
          parentId: replyingTo ?? undefined,
          parentObjectType: type,
          editableContent: contentDto,
          tagId: replyingTo ? undefined : selectedTagId,
        };

        const response = await forumCreateComment({ body: commentDto });

        if (response.error) {
          setSubmitError({
            parentId: replyingTo,
            message: errorMessage({
              error: response.error,
              fallback: "Failed to submit reply",
            }),
          });
          return;
        }

        if (response.data) {
          const newReplyId = response.data.id;

          setNewlyAddedReplies((prev) => new Set(prev).add(newReplyId));
          setLastAddedReplyId(newReplyId);

          setTimeout(() => {
            setNewlyAddedReplies((prev) => {
              const newSet = new Set(prev);
              newSet.delete(newReplyId);
              return newSet;
            });
          }, 3000);

          fetchComments();
          onSuccess?.();
        }

        if (replyingTo) {
          setFocusComposer(false);
        } else {
          setTagFilter(selectedTagId);
        }
      } catch (err) {
        console.error("Error posting reply:", err);
        captureException(ExceptionEvent.PostReplyError, err);
        setSubmitError({
          parentId: replyingTo,
          message: "Failed to submit reply",
        });
      }
    },
    [objectId, type, replyingTo, selectedTagId, fetchComments],
  );

  const handleDeleteReply = useCallback(
    async (replyId: number) => {
      if (window.confirm("Are you sure you want to delete this reply?")) {
        try {
          await forumDeleteComment({ path: { id: replyId } });
          fetchComments();
        } catch (err) {
          console.error("Error deleting reply:", err);
          setError("Failed to delete reply");
        }
      }
    },
    [fetchComments, setError],
  );

  const handleUpdateReply = useCallback(
    async (
      replyId: number,
      content: CreateEditableContentDto,
    ): Promise<Result<void, string>> => {
      const response = await R.fromPromise(
        forumUpdateComment({
          path: { id: replyId },
          body: { editableContent: content },
        }),
      );

      if (!response.ok) {
        console.error("Failed to update comment:", response.error);
        return R.failure("Failed to save your edit");
      }

      if (response.value.error) {
        return R.failure(
          errorMessage({
            error: response.value.error,
            fallback: "Failed to save your edit",
          }),
        );
      }

      setComments((prevComments) =>
        updateCommentInTree({
          comments: prevComments,
          id: replyId,
          update: (comment) => ({
            ...comment,
            editableContent: { ...content, id: -1 },
          }),
        }),
      );

      return R.success(undefined);
    },
    [setComments],
  );

  const { user } = useAuth();

  const handleLikeReply = useCommentLikeMutation({
    userId: user?.id,
    setComments,
    fetchComments,
  });

  const submitErrorFor = useCallback(
    (parentId: number | null) =>
      submitError?.parentId === parentId ? submitError.message : null,
    [submitError],
  );

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  const handlePinReply = useCallback(
    async (replyId: number) => {
      await forumPinCommentAdmin({ path: { id: replyId } });
      fetchComments();
    },
    [fetchComments],
  );

  return {
    comments,
    error,
    fetchComments,
    handleSubmitReply,
    handleDeleteReply,
    handleUpdateReply,
    submitErrorFor,
    clearSubmitError,
    handleLikeReply,
    handlePinReply,
    replyingTo,
    setReplyingTo: openReplyForm,
    focusComposer,
    newlyAddedReplies,
    highlightedReplyId,
    selectedTagId,
    setSelectedTagId,
    tagFilter,
    setTagFilter,
  };
}

interface CommentsProviderProps {
  value: CommentsContextValue;
  children: React.ReactNode;
}

export function CommentsProvider({ value, children }: CommentsProviderProps) {
  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
}

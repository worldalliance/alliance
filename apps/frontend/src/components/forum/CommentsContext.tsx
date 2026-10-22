import { type Result } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  CreateEditableContentDto,
  PostTagDto,
  UserDto,
} from "@alliance/shared/client";
import { TagFilter } from "@alliance/shared/lib/commentTags";
import { useCommentThread } from "@alliance/shared/lib/useCommentThread";
import { milliseconds } from "date-fns";
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
  deleteErrorFor: (replyId: number) => string | null;
  clearDeleteError: (replyId: number) => void;
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
  canRetry: boolean;
  spinning: boolean;
  status: string | null;
  movesReader: boolean;
  deleteErrorFor: (replyId: number) => string | null;
  clearDeleteError: (replyId: number) => void;
  fetchComments: () => Promise<void>;
  retry: () => void;
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
  const { user } = useAuth();
  const {
    comments,
    error,
    canRetry,
    spinning,
    status,
    movesReader,
    fetchComments,
    retry,
    createComment,
    updateComment,
    pinComment,
    likeComment,
    deleteReply,
    deleteErrorFor,
    clearDeleteError,
  } = useCommentThread({ objectId, type, initialComments, userId: user?.id });
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

        setTimeout(
          () => {
            setHighlightedReplyId(null);
          },
          milliseconds({ seconds: 5 }),
        );
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
      setSubmitError(null);
      const created = await createComment({
        content: contentDto,
        parentId: replyingTo,
        tagId: selectedTagId,
      });

      if (!created.ok) {
        setSubmitError({ parentId: replyingTo, message: created.error });
        return;
      }

      const newReplyId = created.value.id;

      setNewlyAddedReplies((prev) => new Set(prev).add(newReplyId));
      setLastAddedReplyId(newReplyId);

      setTimeout(
        () => {
          setNewlyAddedReplies((prev) => {
            const newSet = new Set(prev);
            newSet.delete(newReplyId);
            return newSet;
          });
        },
        milliseconds({ seconds: 3 }),
      );

      onSuccess?.();

      if (replyingTo) {
        setFocusComposer(false);
      } else {
        setTagFilter(selectedTagId);
      }
    },
    [createComment, replyingTo, selectedTagId],
  );

  const handleDeleteReply = useCallback(
    async (replyId: number) => {
      if (
        window.confirm("Are you sure you want to delete this reply?") &&
        (await deleteReply(replyId))
      ) {
        setReplyingTo((id) => (id === replyId ? null : id));
      }
    },
    [deleteReply],
  );

  const submitErrorFor = useCallback(
    (parentId: number | null) =>
      submitError?.parentId === parentId ? submitError.message : null,
    [submitError],
  );

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  return {
    comments,
    error,
    canRetry,
    spinning,
    status,
    movesReader,
    deleteErrorFor,
    clearDeleteError,
    fetchComments,
    retry,
    handleSubmitReply,
    handleDeleteReply,
    handleUpdateReply: updateComment,
    submitErrorFor,
    clearSubmitError,
    handleLikeReply: likeComment,
    handlePinReply: pinComment,
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

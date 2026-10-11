import { errorMessage } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  CreateCommentDto,
  CreateEditableContentDto,
  PostTagDto,
  forumCreateComment,
  forumUpdateComment,
} from "@alliance/shared/client";
import { useCommentFiltering } from "@alliance/shared/lib/commentsFilter";
import { TagFilter } from "@alliance/shared/lib/commentTags";
import {
  collectCommentIds,
  updateCommentInTree,
} from "@alliance/shared/lib/commentTree";
import { commentThreadLanding } from "@alliance/shared/lib/copy";
import { useCommentLikeMutation } from "@alliance/shared/lib/useCommentLikeMutation";
import { useDeleteComment } from "@alliance/shared/lib/useDeleteComment";
import { useLoadComments } from "@alliance/shared/lib/useLoadComments";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { cn } from "@alliance/shared/styles/util";
import { milliseconds } from "date-fns";
import { RefreshCw } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  View,
} from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useAuth } from "../lib/AuthContext";
import { colors } from "../lib/style/colors";
import { useAnnounceOnIos } from "../lib/useAnnounceOnIos";
import { useNotificationsCache } from "../lib/useNotificationsCache";
import { FilterPicker, SortPicker } from "./comments/CommentPickers";
import { NO_TAGS, type SubmitReplyInput } from "./comments/ReplyForm";
import { ReplyItem } from "./comments/ReplyItem";
import { TopLevelComposer } from "./comments/TopLevelComposer";
import InlineError from "./system/InlineError";
import Text from "./system/Text";
import TagChips from "./TagChips";

const NO_EXPERTS: number[] = [];

export interface CommentsProps {
  objectId: number;
  type: CommentParentObject;
  compact?: boolean;
  small?: boolean;
  autofocus?: boolean;
  showForm?: boolean;
  initialComments?: CommentDto[];
  highlightedReplyId?: number | null;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollViewRef | null>;
  repliesAsCards?: boolean;
  qaMode?: boolean;
  expertIds?: number[];
  expertLabel?: string;
  showClusterTags?: boolean;
  tags?: readonly PostTagDto[];
}

export default function Comments({
  objectId,
  type,
  compact,
  small = false,
  autofocus,
  showForm: showFormProp = true,
  initialComments,
  highlightedReplyId,
  scrollViewRef,
  repliesAsCards = false,
  qaMode = false,
  expertIds: expertIdsProp = NO_EXPERTS,
  expertLabel,
  showClusterTags = false,
  tags = NO_TAGS,
}: CommentsProps) {
  const expertIds = useMemo(
    () => (qaMode ? expertIdsProp : []),
    [qaMode, expertIdsProp],
  );
  const { user } = useAuth();
  const { markCachedReadByContent } = useNotificationsCache();
  const isPostComments = type === "post";
  const activeQaMode = isPostComments && qaMode;
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | undefined>(
    undefined,
  );
  const [tagFilter, setTagFilter] = useState<TagFilter>(undefined);
  const [newlyAddedReplies, setNewlyAddedReplies] = useState<Set<number>>(
    new Set(),
  );
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const {
    comments,
    setComments,
    error,
    canRetry,
    spinning,
    status,
    movesReader,
    fetchComments,
    retry,
  } = useLoadComments({ objectId, type, initialComments });
  useAnnounceOnIos(status);
  const thread = useRef<ComponentRef<typeof View>>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!movesReader) moved.current = false;
  }, [movesReader]);

  // The retry control unmounts with the row that carries the message, so a
  // press that works leaves the reader's cursor on nothing. The event lands
  // only on a view the UI thread has framed, so it goes out from the anchor's
  // own layout, and every layout after leaves the cursor where the first put
  // it.
  const landReader = useCallback(() => {
    if (moved.current || !thread.current) return;
    moved.current = true;
    AccessibilityInfo.sendAccessibilityEvent(thread.current, "focus");
  }, []);
  const { deleteReply, deleteErrorFor, clearDeleteError } = useDeleteComment({
    comments,
    fetchComments,
  });
  // Keyed by the form that produced it, so a nested reply's rejection shows
  // under that reply rather than at the top of the thread.
  const [submitError, setSubmitError] = useState<{
    parentId: number | null;
    message: string;
  } | null>(null);
  // A rejection shows only under the form that produced it, so opening any
  // other form drops it. One that landed while its form was closed waits for
  // that form to open again.
  const openReplyForm = useCallback((id: number | null) => {
    setSubmitError((prev) => (prev?.parentId === id ? prev : null));
    setReplyingTo(id);
  }, []);
  const [showForm, setShowForm] = useState(showFormProp);
  const [isComposing, setIsComposing] = useState(!!autofocus);
  // The composer takes the keyboard when the user opened it, not when it comes
  // back after a reply posted further down the thread.
  const [focusComposer, setFocusComposer] = useState(!!autofocus);

  useEffect(() => {
    setShowForm(showFormProp);
  }, [showFormProp]);

  useEffect(() => {
    if (highlightedReplyId) {
      setHighlightedId(highlightedReplyId);
      const timeout = setTimeout(
        () => setHighlightedId(null),
        milliseconds({ seconds: 5 }),
      );
      return () => clearTimeout(timeout);
    }
    return;
  }, [highlightedReplyId]);

  const handleSubmitReply = useCallback(
    async ({ content, parentId, onSuccess }: SubmitReplyInput) => {
      try {
        setSubmitError(null);
        const commentDto: CreateCommentDto = {
          parentObjectId: Number(objectId),
          parentId: parentId ?? undefined,
          parentObjectType: type,
          editableContent: content,
          tagId: parentId ? undefined : selectedTagId,
        };

        const response = await forumCreateComment({ body: commentDto });

        if (response.error) {
          setSubmitError({
            parentId,
            message: errorMessage({
              error: response.error,
              fallback: "Failed to submit reply",
            }),
          });
          return;
        }

        if (response.data) {
          setNewlyAddedReplies((prev) => {
            const next = new Set(prev);
            next.add(response.data!.id);
            return next;
          });
          setTimeout(
            () => {
              setNewlyAddedReplies((prev) => {
                const next = new Set(prev);
                next.delete(response.data!.id);
                return next;
              });
            },
            milliseconds({ seconds: 3 }),
          );
        }

        await fetchComments();
        onSuccess();
        openReplyForm(null);
        if (!parentId) {
          setTagFilter(selectedTagId);
          setSelectedTagId(undefined);
          setIsComposing(false);
        } else {
          setFocusComposer(false);
        }
      } catch (err) {
        console.error("Error posting reply:", err);
        setSubmitError({
          parentId,
          message: "Failed to submit reply",
        });
      }
    },
    [fetchComments, objectId, openReplyForm, selectedTagId, type],
  );

  const handleDeleteReply = useCallback(
    (replyId: number) => {
      Alert.alert(
        "Delete Reply",
        "Are you sure you want to delete this reply?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteReply(replyId),
          },
        ],
      );
    },
    [deleteReply],
  );

  const handleUpdateReply = useCallback(
    async (
      replyId: number,
      content: CreateEditableContentDto,
    ): Promise<Result<void, string>> => {
      const saved = await R.fromPromiseFn(async () => {
        const response = await forumUpdateComment({
          path: { id: replyId },
          body: {
            editableContent: content,
          },
        });
        return response.error;
      });

      if (!saved.ok) {
        console.error("Failed to update comment:", saved.error);
        return R.failure("Failed to save your edit");
      }

      if (saved.value) {
        return R.failure(
          errorMessage({
            error: saved.value,
            fallback: "Failed to save your edit",
          }),
        );
      }

      setComments((prevComments) =>
        updateCommentInTree({
          comments: prevComments,
          id: replyId,
          update: (comment) => ({ ...comment, editableContent: content }),
        }),
      );

      return R.success(undefined);
    },
    [setComments],
  );

  const submitErrorFor = useCallback(
    (parentId: number | null) =>
      submitError?.parentId === parentId ? submitError.message : null,
    [submitError],
  );

  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  const handleLikeReply = useCommentLikeMutation({
    userId: user?.id,
    setComments,
    fetchComments,
  });

  const {
    topLevelComments,
    filteredComments,
    filterOptions,
    commentFilter,
    setCommentFilter,
    commentCounts,
    sortOptions,
    commentSort,
    changeSort,
    tagCounts,
  } = useCommentFiltering({
    comments,
    user,
    showClusterTags,
    isPostComments,
    activeQaMode,
    expertIds,
    tags,
    tagFilter,
  });
  const sortedComments = comments ? filteredComments : null;

  const commentIds = useMemo(
    () => collectCommentIds(comments ?? []),
    [comments],
  );

  useMarkUnreadContentRead({
    contentType: "forum_reply",
    contentIds: commentIds,
    enabled: !!user && commentIds.length > 0,
    onMarked: markCachedReadByContent,
  });

  return (
    <View className="gap-y-3">
      {user && showForm ? (
        <TopLevelComposer
          replyingTo={replyingTo}
          isComposing={isComposing}
          setIsComposing={setIsComposing}
          focusComposer={focusComposer}
          setFocusComposer={setFocusComposer}
          objectId={objectId}
          error={submitErrorFor(null)}
          onDismissError={clearSubmitError}
          tags={isPostComments ? tags : NO_TAGS}
          selectedTagId={selectedTagId}
          setSelectedTagId={setSelectedTagId}
          onSubmit={handleSubmitReply}
        />
      ) : !user && !compact ? (
        <View className="py-6 bg-zinc-50 rounded border border-zinc-100">
          <Text className="text-zinc-600 text-center">
            Please log in to post a reply.
          </Text>
        </View>
      ) : null}

      <InlineError message={error}>
        {canRetry ? (
          <TouchableOpacity
            onPress={retry}
            accessibilityRole="button"
            accessibilityState={{ busy: spinning }}
            accessibilityLabel="Try loading the comments again"
            hitSlop={8}
          >
            {spinning ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <RefreshCw size={14} color={colors.error} />
            )}
          </TouchableOpacity>
        ) : null}
      </InlineError>

      {/* accessibilityState busy has no iOS trait behind it, so the spinner
          alone reaches nobody who cannot see it. Android reads the line here
          and iOS off the announcement above, so this stays off screen. */}
      <View
        accessibilityLiveRegion="polite"
        style={{ position: "absolute", left: -9999 }}
      >
        <Text>{status ?? ""}</Text>
      </View>

      {isPostComments && topLevelComments.length > 0 && (
        <View className="flex-row items-center justify-between">
          <FilterPicker
            value={commentFilter}
            options={filterOptions}
            counts={commentCounts}
            onChange={setCommentFilter}
          />
          <SortPicker
            value={commentSort}
            options={sortOptions}
            onChange={changeSort}
          />
        </View>
      )}

      {isPostComments && tags.length > 0 && topLevelComments.length > 0 && (
        <TagChips
          tags={tags}
          selected={tagFilter}
          onSelect={setTagFilter}
          counts={tagCounts}
        />
      )}

      {sortedComments ? (
        // Empty it drops out of the flow, so the gap above keeps no row for
        // it, and keeps a point of frame, since Android will not stop on an
        // anchor lying outside its parent's bounds.
        <View
          className={cn(
            "gap-y-3",
            sortedComments.length === 0 && "absolute w-px h-px",
          )}
        >
          {/* Naming the thread itself would fold every comment in it into one
              element, so the cursor lands here instead, first so the swipe
              after it goes into the thread rather than past it. A named element
              is a stop every reader swipes through, so it goes up only once a
              press has earned it and stays up from there: taking out the
              element the cursor sits on drops the cursor to the top of the
              screen. */}
          {movesReader ? (
            <View
              ref={thread}
              onLayout={landReader}
              accessible
              accessibilityLabel={commentThreadLanding({
                shown: sortedComments.length,
                total: topLevelComments.length,
              })}
              collapsable={false}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 1,
                height: 1,
              }}
            />
          ) : null}
          {sortedComments.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              compact={compact}
              small={small}
              autofocus={autofocus}
              objectId={objectId}
              repliesAsCards={repliesAsCards}
              replyingTo={replyingTo}
              setReplyingTo={openReplyForm}
              highlightedId={highlightedId}
              scrollViewRef={scrollViewRef}
              newlyAddedReplies={newlyAddedReplies}
              user={user}
              expertIds={expertIds}
              expertLabel={expertLabel}
              showClusterTags={showClusterTags}
              tags={tags}
              onSubmitReply={handleSubmitReply}
              onUpdateReply={handleUpdateReply}
              submitErrorFor={submitErrorFor}
              clearSubmitError={clearSubmitError}
              deleteErrorFor={deleteErrorFor}
              clearDeleteError={clearDeleteError}
              onDeleteReply={handleDeleteReply}
              onLikeReply={handleLikeReply}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

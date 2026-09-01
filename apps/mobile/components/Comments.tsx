import { errorMessage } from "@alliance/common/errorMessage";
import { withCount } from "@alliance/common/plural";
import { R, type Result } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  CreateCommentDto,
  CreateEditableContentDto,
  NotificationDto,
  PostTagDto,
  UserDto,
  forumCreateComment,
  forumDeleteComment,
  forumUpdateComment,
} from "@alliance/shared/client";
import {
  CommentFilter,
  CommentSort,
  commentFilterLabels,
  getCommentFilterOptions,
  getSortOptions,
  matchesCommentFilter,
  sortComments,
  sortLabels,
  useCommentFilterData,
} from "@alliance/shared/lib/commentsFilter";
import {
  TagFilter,
  countCommentsByTag,
  matchesTagFilter,
} from "@alliance/shared/lib/commentTags";
import { updateCommentInTree } from "@alliance/shared/lib/commentTree";
import { uploadDraftAttachments } from "@alliance/shared/lib/uploadAttachments";
import { useCommentLikeMutation } from "@alliance/shared/lib/useCommentLikeMutation";
import { useLoadComments } from "@alliance/shared/lib/useLoadComments";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ListFilter, Pin } from "lucide-react-native";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useAuth } from "../lib/AuthContext";
import { colors } from "../lib/style/colors";
import BottomSheetOptionPicker from "./BottomSheetOptionPicker";
import EditableContentForm from "./EditableContentForm";
import EditableContentRenderer from "./EditableContentRenderer";
import { LikeActionButton } from "./LikeFooter";
import LikeSummary from "./LikeSummary";
import ProfileImage from "./ProfileImage";
import Text from "./system/Text";
import TagChips from "./TagChips";
import UserDisplayName from "./UserDisplayName";

const NO_TAGS: readonly PostTagDto[] = [];
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

const shouldShowComment = (comment: CommentDto) => {
  return !comment.deleted || (comment.children?.length ?? 0) > 0;
};

const collectCommentIds = (comments: CommentDto[]): number[] => {
  const ids: number[] = [];
  for (const comment of comments) {
    ids.push(comment.id);
    if (comment.children?.length) {
      ids.push(...collectCommentIds(comment.children));
    }
  }
  return ids;
};

const SortPicker = ({
  value,
  options,
  onChange,
}: {
  value: CommentSort;
  options: CommentSort[];
  onChange: (sort: CommentSort) => void;
}) => {
  const [open, setOpen] = useState(false);
  const pickerOptions = useMemo(
    () => options.map((sort) => ({ value: sort, label: sortLabels[sort] })),
    [options],
  );
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        className="flex-row items-center gap-x-1 px-2 py-1"
      >
        <Text className="text-sm text-zinc-600">{sortLabels[value]}</Text>
        <ArrowUpDown size={14} color={colors.text.tertiary} />
      </TouchableOpacity>
      <BottomSheetOptionPicker
        visible={open}
        onClose={() => setOpen(false)}
        title="Sort by"
        options={pickerOptions}
        value={value}
        onSelect={onChange}
      />
    </>
  );
};

const FilterPicker = ({
  value,
  options,
  counts,
  onChange,
}: {
  value: CommentFilter;
  options: CommentFilter[];
  counts: Record<CommentFilter, number>;
  onChange: (filter: CommentFilter) => void;
}) => {
  const [open, setOpen] = useState(false);
  const pickerOptions = useMemo(
    () =>
      options.map((filter) => ({
        value: filter,
        label: `${commentFilterLabels[filter]} (${counts[filter] ?? 0})`,
      })),
    [options, counts],
  );
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        className="flex-row items-center gap-x-1 px-2 py-1"
      >
        <ListFilter size={14} color={colors.text.tertiary} />
        <Text className="text-sm text-zinc-600">
          {commentFilterLabels[value]} ({counts[value] ?? 0})
        </Text>
      </TouchableOpacity>
      <BottomSheetOptionPicker
        visible={open}
        onClose={() => setOpen(false)}
        title="Filter"
        options={pickerOptions}
        value={value}
        onSelect={onChange}
      />
    </>
  );
};

type SubmitReplyInput = {
  content: CreateEditableContentDto;
  parentId: number | null;
  onSuccess: () => void;
};

type SubmitReply = (input: SubmitReplyInput) => void | Promise<void>;

type ReplyFormProps = {
  parentId: number | null;
  content: CreateEditableContentDto;
  setContent: Dispatch<SetStateAction<CreateEditableContentDto>>;
  onCancel?: () => void;
  autofocus?: boolean;
  objectId: number;
  error?: string | null;
  onDismissError?: () => void;
  tags?: readonly PostTagDto[];
  selectedTagId?: number;
  setSelectedTagId?: (id: number | undefined) => void;
  onSubmit: SubmitReply;
  focusOnMount: boolean;
};

const ReplyForm = ({
  parentId,
  content,
  setContent,
  onCancel,
  autofocus,
  focusOnMount,
  objectId,
  error,
  onDismissError,
  tags = NO_TAGS,
  selectedTagId,
  setSelectedTagId,
  onSubmit,
}: ReplyFormProps) => {
  const needsTag = parentId === null && tags.length > 0;
  const expanded = autofocus || parentId !== null;
  // Local, so posting one comment leaves every other composer live.
  const [isPosting, setIsPosting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const post = async () => {
    onDismissError?.();
    setUploadError(null);
    setIsPosting(true);
    try {
      const uploaded = await uploadDraftAttachments({
        sources: content.attachments,
        setAttachments: (update) =>
          setContent((prev) => ({
            ...prev,
            attachments: update(prev.attachments),
          })),
      });
      if (!uploaded.ok) {
        setUploadError(uploaded.error);
        return;
      }
      await onSubmit({
        content: { ...content, attachments: uploaded.value },
        parentId,
        onSuccess: () => setContent({ body: "", attachments: [] }),
      });
    } finally {
      setIsPosting(false);
    }
  };

  // EditableContentForm hides its Cancel button when onCancel is undefined.
  const handleCancel = onCancel
    ? () => {
        onDismissError?.();
        onCancel();
      }
    : undefined;

  return (
    <View className="p-2 bg-zinc-100 rounded">
      {needsTag && (
        <View className="mb-3">
          <Text className="text-sm text-zinc-500 mb-1.5">
            Pick a tag for your comment
          </Text>
          <TagChips
            tags={tags}
            disabled={isPosting}
            selected={selectedTagId}
            onSelect={(value) => setSelectedTagId?.(value ?? undefined)}
          />
        </View>
      )}
      <EditableContentForm
        value={content}
        onChange={(next) => {
          onDismissError?.();
          setUploadError(null);
          setContent(next);
        }}
        placeholder="Add a comment..."
        expanded={expanded}
        autoFocus={focusOnMount}
        draftKey={`reply-${parentId ?? "root"}-${objectId}`}
        onSubmit={() => void post()}
        onCancel={handleCancel}
        submitLabel="Post"
        isSubmitting={isPosting}
        submitDisabled={needsTag && selectedTagId === undefined}
      />
      {(uploadError ?? error) && (
        <Text className="mt-2 text-sm text-red-500">
          {uploadError ?? error}
        </Text>
      )}
    </View>
  );
};

type TopLevelComposerProps = {
  replyingTo: number | null;
  isComposing: boolean;
  setIsComposing: (composing: boolean) => void;
  focusComposer: boolean;
  setFocusComposer: (focus: boolean) => void;
  objectId: number;
  error?: string | null;
  onDismissError?: () => void;
  tags: readonly PostTagDto[];
  selectedTagId?: number;
  setSelectedTagId: (id: number | undefined) => void;
  onSubmit: SubmitReply;
};

/**
 * The thread's own composer. The draft lives here rather than beside the
 * comment tree, so a keystroke re-renders the form and nothing else.
 */
const TopLevelComposer = ({
  replyingTo,
  isComposing,
  setIsComposing,
  focusComposer,
  setFocusComposer,
  objectId,
  error,
  onDismissError,
  tags,
  selectedTagId,
  setSelectedTagId,
  onSubmit,
}: TopLevelComposerProps) => {
  const [content, setContent] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });

  if (replyingTo) return null;

  if (!isComposing) {
    return (
      <TouchableOpacity
        onPress={() => {
          setIsComposing(true);
          setFocusComposer(true);
        }}
        activeOpacity={0.7}
        className="p-3 bg-zinc-100 rounded"
      >
        <Text className="text-zinc-500">Add a comment...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <ReplyForm
      parentId={null}
      content={content}
      setContent={setContent}
      autofocus
      focusOnMount={focusComposer}
      onCancel={() => setIsComposing(false)}
      objectId={objectId}
      error={error}
      onDismissError={onDismissError}
      tags={tags}
      selectedTagId={selectedTagId}
      setSelectedTagId={setSelectedTagId}
      onSubmit={onSubmit}
    />
  );
};

type ReplyItemSharedProps = {
  compact?: boolean;
  small?: boolean;
  autofocus?: boolean;
  objectId: number;
  repliesAsCards: boolean;
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  highlightedId: number | null;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollViewRef | null>;
  newlyAddedReplies: Set<number>;
  user: UserDto | undefined;
  expertIds: number[];
  expertLabel?: string;
  showClusterTags: boolean;
  tags: readonly PostTagDto[];
  onSubmitReply: SubmitReply;
  onUpdateReply: (
    replyId: number,
    content: CreateEditableContentDto,
  ) => Promise<Result<void, string>>;
  submitErrorFor: (parentId: number | null) => string | null;
  clearSubmitError: () => void;
  onDeleteReply: (replyId: number) => void;
  onLikeReply: (replyId: number, unlike?: boolean) => Promise<unknown>;
};

type ReplyItemProps = ReplyItemSharedProps & {
  reply: CommentDto;
  depth?: number;
};

const ReplyItem = memo(function ReplyItemView({
  reply,
  depth = 0,
  ...shared
}: ReplyItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>({
    body: reply.editableContent.body ?? "",
    attachments: reply.editableContent.attachments ?? [],
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [nestedDraft, setNestedDraft] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });
  const viewRef = useRef<View>(null);
  const maxDepth = 6;
  const canNest = depth < maxDepth;
  const isReplyingToThis = shared.replyingTo === reply.id;
  const hasChildren = (reply.children?.length ?? 0) > 0;
  const isHighlighted = shared.highlightedId === reply.id;
  const tag = shared.tags.find((candidate) => candidate.id === reply.tagId);
  const isNewlyAdded = shared.newlyAddedReplies.has(reply.id);
  const metaTextClass = shared.small ? "text-xs" : "text-sm";
  const actionTextClass = shared.small
    ? "text-xs text-zinc-500"
    : "text-sm text-zinc-500";
  const deleteTextClass = shared.small
    ? "text-xs text-red-600"
    : "text-sm text-red-600";
  const containerSpacing = shared.repliesAsCards
    ? depth === 0
      ? "p-3"
      : "p-2"
    : "py-1";
  const containerBorder = shared.repliesAsCards ? "border border-zinc-200" : "";
  const containerBg = shared.repliesAsCards
    ? isNewlyAdded
      ? "bg-green/10"
      : "bg-white"
    : isNewlyAdded
      ? "bg-green/10"
      : "";

  useEffect(() => {
    if (isEditing) return;
    setEditContent({
      body: reply.editableContent.body ?? "",
      attachments: reply.editableContent.attachments ?? [],
    });
  }, [
    isEditing,
    reply.editableContent.body,
    reply.editableContent.attachments,
  ]);

  const saveEdit = async () => {
    setIsSavingEdit(true);
    try {
      const uploaded = await uploadDraftAttachments({
        sources: editContent.attachments,
        setAttachments: (update) =>
          setEditContent((prev) => ({
            ...prev,
            attachments: update(prev.attachments),
          })),
      });
      if (!uploaded.ok) {
        setEditError(uploaded.error);
        return;
      }
      R.match(
        await shared.onUpdateReply(reply.id, {
          ...editContent,
          attachments: uploaded.value,
        }),
        {
          success: () => setIsEditing(false),
          failure: setEditError,
        },
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    if (!isHighlighted || !viewRef.current || !shared.scrollViewRef?.current)
      return;
    const timer = setTimeout(() => {
      if (!viewRef.current || !shared.scrollViewRef?.current) return;
      viewRef.current.measureInWindow((_x, y) => {
        shared.scrollViewRef!.current?.scrollTo({
          y: Math.max(0, y - 80),
          animated: true,
        });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [isHighlighted, shared.scrollViewRef]);

  return (
    <View
      ref={viewRef}
      collapsable={false}
      style={{ marginLeft: Math.min(depth * 12, maxDepth * 12) }}
      className={cn(
        shared.repliesAsCards && "rounded",
        containerBorder,
        containerBg,
        containerSpacing,
        isHighlighted && "bg-blue-50",
      )}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-x-2 flex-1 flex-wrap">
          <ProfileImage pfp={reply.author.profilePicture} size="small" />
          <UserDisplayName
            name={reply.author.displayName}
            staff={reply.author.staff}
            ambassador={reply.author.ambassador}
            grouplead={reply.author.isCommunityLeader}
            expert={shared.expertIds.includes(reply.author.id)}
            expertLabel={shared.expertLabel}
            cluster={shared.showClusterTags ? reply.author.cluster : null}
            sameClusterAsViewer={
              !!reply.author.cluster &&
              reply.author.cluster.id === shared.user?.clusterId
            }
            small={shared.small}
          />
          <Text className={cn("text-zinc-500", metaTextClass)}>
            {formatTime(new Date(reply.createdAt), { addSuffix: true })}
          </Text>
          {tag && (
            <View className="bg-zinc-200 rounded-full px-2 py-0.5">
              <Text className="text-xs text-zinc-700">{tag.name}</Text>
            </View>
          )}
          {hasChildren && isCollapsed && (
            <Text className={cn("text-zinc-500", metaTextClass)}>
              {withCount(reply.children?.length ?? 0, "reply")} hidden
            </Text>
          )}
        </View>
        {reply.pinned && <Pin size={12} color={colors.text.tertiary} />}
      </View>

      <View className="mt-2">
        {isEditing ? (
          <View className="gap-y-2">
            <EditableContentForm
              isSubmitting={isSavingEdit}
              value={editContent}
              onChange={setEditContent}
              className="bg-zinc-100 rounded overflow-visible"
              placeholder="Edit your reply..."
              expanded
              draftKey={`edit-reply-${reply.id}`}
              onSubmit={() => {
                setEditError(null);
                void saveEdit();
              }}
              onCancel={() => {
                setEditContent({
                  body: reply.editableContent.body ?? "",
                  attachments: reply.editableContent.attachments ?? [],
                });
                setEditError(null);
                setIsEditing(false);
              }}
            />
            {editError && (
              <Text className="text-sm text-red-500">{editError}</Text>
            )}
          </View>
        ) : (
          <EditableContentRenderer
            content={reply.editableContent}
            deleted={reply.deleted}
            collapsed={isCollapsed}
            small={shared.small}
          />
        )}
      </View>

      {!isEditing && (
        <View className="mt-2">
          <LikeSummary
            likeTargetType="comment"
            likeTargetId={reply.id}
            liked={reply.likedByMe ?? false}
            likesCount={reply.likesCount}
            likers={reply.likes}
            className="mb-1.5"
          />
          <View className="flex-row items-center gap-x-3">
            <LikeActionButton
              compact
              liked={reply.likedByMe ?? false}
              onLike={
                shared.user
                  ? () => shared.onLikeReply(reply.id, reply.likedByMe ?? false)
                  : undefined
              }
            />
            {shared.user && canNest && (
              <TouchableOpacity
                onPress={() =>
                  shared.setReplyingTo(isReplyingToThis ? null : reply.id)
                }
                activeOpacity={0.7}
              >
                {!isReplyingToThis ? (
                  <Text className={actionTextClass}>Reply</Text>
                ) : null}
              </TouchableOpacity>
            )}
            {shared.user &&
              reply.author.id === shared.user.id &&
              !reply.deleted && (
                <View className="flex-row items-center gap-x-3">
                  <TouchableOpacity
                    onPress={() => setIsEditing(true)}
                    activeOpacity={0.7}
                  >
                    <Text className={actionTextClass}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => shared.onDeleteReply(reply.id)}
                    activeOpacity={0.7}
                  >
                    <Text className={deleteTextClass}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            {hasChildren && depth === 0 && (
              <TouchableOpacity
                onPress={() => setIsCollapsed(!isCollapsed)}
                activeOpacity={0.7}
              >
                <Text className={actionTextClass}>
                  {isCollapsed ? "Show replies" : "Hide replies"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {shared.user && isReplyingToThis && !isCollapsed && (
        <View className="mt-3">
          <ReplyForm
            parentId={reply.id}
            content={nestedDraft}
            setContent={setNestedDraft}
            onCancel={() => shared.setReplyingTo(null)}
            autofocus={shared.autofocus}
            focusOnMount
            objectId={shared.objectId}
            error={shared.submitErrorFor(reply.id)}
            onDismissError={shared.clearSubmitError}
            onSubmit={shared.onSubmitReply}
          />
        </View>
      )}

      {hasChildren && !isCollapsed && (
        <View className="mt-3 gap-y-3">
          {reply.children?.filter(shouldShowComment).map((childReply) => (
            <ReplyItem
              key={childReply.id}
              reply={childReply}
              depth={depth + 1}
              {...shared}
            />
          ))}
        </View>
      )}
    </View>
  );
});

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
  const queryClient = useQueryClient();
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
  const { comments, setComments, error, setError, fetchComments } =
    useLoadComments({ objectId, type, initialComments });
  // Keyed by the form that produced it, so a nested reply's rejection shows
  // under that reply rather than at the top of the thread.
  const [submitError, setSubmitError] = useState<{
    parentId: number | null;
    message: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(showFormProp);
  const [isComposing, setIsComposing] = useState(!!autofocus);
  // The composer takes the keyboard when the user opened it, not when it comes
  // back after a reply posted further down the thread.
  const [focusComposer, setFocusComposer] = useState(!!autofocus);

  // useAuth() is hydrated before this mounts in the common case, so the initializer
  // picks the right default without needing an effect to react to late-arriving user data.
  const [commentFilter, setCommentFilter] = useState<CommentFilter>(
    CommentFilter.All,
  );
  const [commentSort, setCommentSort] = useState<CommentSort>(
    showClusterTags && user?.clusterId != null
      ? CommentSort.SameCluster
      : CommentSort.Newest,
  );
  const [randomSeed, setRandomSeed] = useState(() => String(Math.random()));
  const handleSortChange = useCallback((sort: CommentSort) => {
    setCommentSort(sort);
    if (sort === CommentSort.Random) setRandomSeed(String(Math.random()));
  }, []);

  useEffect(() => {
    setShowForm(showFormProp);
  }, [showFormProp]);

  useEffect(() => {
    if (highlightedReplyId) {
      setHighlightedId(highlightedReplyId);
      const timeout = setTimeout(() => setHighlightedId(null), 5000);
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
          setTimeout(() => {
            setNewlyAddedReplies((prev) => {
              const next = new Set(prev);
              next.delete(response.data!.id);
              return next;
            });
          }, 3000);
        }

        await fetchComments();
        onSuccess();
        setReplyingTo(null);
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
    [fetchComments, objectId, selectedTagId, type],
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
            onPress: async () => {
              try {
                await forumDeleteComment({ path: { id: replyId } });
                await fetchComments();
              } catch (err) {
                console.error("Error deleting reply:", err);
                setError("Failed to delete reply");
              }
            },
          },
        ],
      );
    },
    [fetchComments, setError],
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

  const { friendIdSet, groupMemberIdSet } = useCommentFilterData({
    enabled: !!user && isPostComments,
    userId: user?.id,
  });

  const topLevelComments = useMemo(
    () => (comments ?? []).filter(shouldShowComment),
    [comments],
  );

  const hasMineComments = useMemo(
    () =>
      !!user &&
      topLevelComments.some((comment) => comment.author.id === user.id),
    [topLevelComments, user],
  );

  const hasSameGroup = showClusterTags && user?.clusterId != null;

  const filterOptions = useMemo(
    () =>
      getCommentFilterOptions({
        activeQaMode,
        hasMineComments,
        hasSameGroup,
      }),
    [activeQaMode, hasMineComments, hasSameGroup],
  );

  const sortOptions = useMemo(
    () => getSortOptions({ hasSameGroup }),
    [hasSameGroup],
  );

  useEffect(() => {
    if (!filterOptions.includes(commentFilter)) {
      setCommentFilter(CommentFilter.All);
    }
  }, [filterOptions, commentFilter]);

  useEffect(() => {
    if (!sortOptions.includes(commentSort)) {
      setCommentSort(CommentSort.Newest);
    }
  }, [sortOptions, commentSort]);

  const filterContext = useMemo(
    () => ({
      userId: user?.id,
      userClusterId: user?.clusterId,
      expertIds,
      friendIdSet,
      groupMemberIdSet,
    }),
    [user?.id, user?.clusterId, expertIds, friendIdSet, groupMemberIdSet],
  );

  const commentCounts = useMemo(() => {
    const counts = {} as Record<CommentFilter, number>;
    for (const filter of filterOptions) {
      counts[filter] = topLevelComments.filter((comment) =>
        matchesCommentFilter(comment, filter, filterContext),
      ).length;
    }
    return counts;
  }, [filterOptions, topLevelComments, filterContext]);

  const filterMatchedComments = useMemo(
    () =>
      topLevelComments.filter((comment) =>
        matchesCommentFilter(comment, commentFilter, filterContext),
      ),
    [topLevelComments, commentFilter, filterContext],
  );

  const tagCounts = useMemo(
    () => countCommentsByTag(filterMatchedComments, tags),
    [filterMatchedComments, tags],
  );

  const sortedComments = useMemo(() => {
    if (!comments) return null;
    return sortComments(
      filterMatchedComments.filter((comment) =>
        matchesTagFilter(comment, tagFilter),
      ),
      commentSort,
      { randomSeed, userClusterId: user?.clusterId },
    );
  }, [
    comments,
    filterMatchedComments,
    commentSort,
    randomSeed,
    tagFilter,
    user?.clusterId,
  ]);

  const commentIds = useMemo(
    () => collectCommentIds(comments ?? []),
    [comments],
  );

  useMarkUnreadContentRead({
    contentType: "forum_reply",
    contentIds: commentIds,
    enabled: !!user && commentIds.length > 0,
    onMarked: (contentType, contentIds) => {
      const ids = new Set(contentIds);
      const readAt = new Date().toISOString();
      queryClient.setQueryData(
        ["notifications"],
        (
          oldData:
            | {
                data?: NotificationDto[];
              }
            | undefined,
        ) => {
          if (!oldData || !Array.isArray(oldData.data)) {
            return oldData;
          }

          return {
            ...oldData,
            data: oldData.data.map((notification) => {
              if (
                notification.readAt ||
                notification.contentType !== contentType ||
                typeof notification.contentId !== "number" ||
                !ids.has(notification.contentId)
              ) {
                return notification;
              }

              return { ...notification, readAt };
            }),
          };
        },
      );
    },
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

      {error && <Text className="text-red-500">{error}</Text>}

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
            onChange={handleSortChange}
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

      {sortedComments && sortedComments.length > 0 ? (
        <View className="gap-y-3">
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
              setReplyingTo={setReplyingTo}
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
              onDeleteReply={handleDeleteReply}
              onLikeReply={handleLikeReply}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

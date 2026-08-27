import { errorMessage } from "@alliance/common/errorMessage";
import { withCount } from "@alliance/common/plural";
import { R, type Result } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  CreateCommentDto,
  CreateEditableContentDto,
  NotificationDto,
  UserDto,
  forumCreateComment,
  forumDeleteComment,
  forumFindCommentsForAction,
  forumFindCommentsForActivity,
  forumFindCommentsForPost,
  forumUpdateComment,
  imagesUploadImage,
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
import { useCommentLikeMutation } from "@alliance/shared/lib/useCommentLikeMutation";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ListFilter, Pin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import UserDisplayName from "./UserDisplayName";

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
}

const uploadAttachments = async (attachments: string[]) => {
  const uploads = await Promise.all(
    attachments.map(async (file) => {
      if (file.startsWith("data:")) {
        const res = await imagesUploadImage({ body: { file } });
        return res.data?.key;
      }
      return file;
    }),
  );
  return uploads.filter((key): key is string => Boolean(key));
};

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

type ReplyFormProps = {
  parentId: number | null;
  content: CreateEditableContentDto;
  setContent: (next: CreateEditableContentDto) => void;
  onCancel?: () => void;
  autofocus?: boolean;
  objectId: number;
  isSubmitting: boolean;
  error?: string | null;
  onDismissError?: () => void;
  onSubmit: (
    content: CreateEditableContentDto,
    parentId?: number | null,
  ) => void;
};

const ReplyForm = ({
  parentId,
  content,
  setContent,
  onCancel,
  autofocus,
  objectId,
  isSubmitting,
  error,
  onDismissError,
  onSubmit,
}: ReplyFormProps) => {
  // EditableContentForm hides its Cancel button when onCancel is undefined.
  const handleCancel = onCancel
    ? () => {
        onDismissError?.();
        onCancel();
      }
    : undefined;

  return (
    <View className="p-2 bg-zinc-100 rounded">
      <EditableContentForm
        value={content}
        onChange={(next) => {
          onDismissError?.();
          setContent(next);
        }}
        placeholder="Add a comment..."
        expanded={autofocus || parentId !== null}
        draftKey={`reply-${parentId ?? "root"}-${objectId}`}
        onSubmit={() => onSubmit(content, parentId)}
        onCancel={handleCancel}
        submitLabel="Post"
        isSubmitting={isSubmitting}
      />
      {error && <Text className="mt-2 text-sm text-red-500">{error}</Text>}
    </View>
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
  nestedDraft: CreateEditableContentDto;
  setNestedDraft: (next: CreateEditableContentDto) => void;
  isSubmitting: boolean;
  highlightedId: number | null;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollViewRef | null>;
  newlyAddedReplies: Set<number>;
  user: UserDto | undefined;
  expertIds: number[];
  expertLabel?: string;
  showClusterTags: boolean;
  onSubmitReply: (
    content: CreateEditableContentDto,
    parentId?: number | null,
  ) => void;
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

const ReplyItem = ({ reply, depth = 0, ...shared }: ReplyItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>({
    body: reply.editableContent.body ?? "",
    attachments: reply.editableContent.attachments ?? [],
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const viewRef = useRef<View>(null);
  const maxDepth = 6;
  const canNest = depth < maxDepth;
  const isReplyingToThis = shared.replyingTo === reply.id;
  const hasChildren = (reply.children?.length ?? 0) > 0;
  const isHighlighted = shared.highlightedId === reply.id;
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
              isSubmitting={shared.isSubmitting}
              value={editContent}
              onChange={setEditContent}
              className="bg-zinc-100 rounded overflow-visible"
              placeholder="Edit your reply..."
              expanded
              draftKey={`edit-reply-${reply.id}`}
              onSubmit={() => {
                setEditError(null);
                void shared
                  .onUpdateReply(reply.id, editContent)
                  .then((result) =>
                    R.match(result, {
                      success: () => setIsEditing(false),
                      failure: setEditError,
                    }),
                  );
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
            content={shared.nestedDraft}
            setContent={shared.setNestedDraft}
            onCancel={() => shared.setReplyingTo(null)}
            autofocus={shared.autofocus}
            objectId={shared.objectId}
            isSubmitting={shared.isSubmitting}
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
};

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
  expertIds: expertIdsProp = [],
  expertLabel,
  showClusterTags = false,
}: CommentsProps) {
  const expertIds = useMemo(
    () => (qaMode ? expertIdsProp : []),
    [qaMode, expertIdsProp],
  );
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isPostComments = type === "post";
  const activeQaMode = isPostComments && qaMode;
  const [editableContent, setEditableContent] =
    useState<CreateEditableContentDto>({ body: "", attachments: [] });
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedReplies, setNewlyAddedReplies] = useState<Set<number>>(
    new Set(),
  );
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentDto[] | null>(
    initialComments ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  // Keyed by the form that produced it, so a nested reply's rejection shows
  // under that reply rather than at the top of the thread.
  const [submitError, setSubmitError] = useState<{
    parentId: number | null;
    message: string;
  } | null>(null);
  const [nestedDraft, setNestedDraft] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });
  const [showForm, setShowForm] = useState(showFormProp);
  const [isComposing, setIsComposing] = useState(!!autofocus);

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

  const fetchComments = useCallback(async () => {
    let response;
    if (type === "post") {
      response = await forumFindCommentsForPost({
        path: { id: objectId.toString() },
      });
    } else if (type === "activity") {
      response = await forumFindCommentsForActivity({
        path: { id: objectId.toString() },
      });
    } else {
      response = await forumFindCommentsForAction({
        path: { id: objectId.toString() },
      });
    }
    setComments(response.data ?? null);
  }, [objectId, type]);

  useEffect(() => {
    if (initialComments) {
      setComments(initialComments);
      return;
    }
    fetchComments();
  }, [initialComments, fetchComments]);

  useEffect(() => {
    if (highlightedReplyId) {
      setHighlightedId(highlightedReplyId);
      const timeout = setTimeout(() => setHighlightedId(null), 5000);
      return () => clearTimeout(timeout);
    }
    return;
  }, [highlightedReplyId]);

  const handleSubmitReply = useCallback(
    async (contentDto: CreateEditableContentDto, parentId?: number | null) => {
      try {
        setIsSubmitting(true);
        setSubmitError(null);
        const attachmentKeys = await uploadAttachments(
          contentDto.attachments ?? [],
        );
        const commentDto: CreateCommentDto = {
          parentObjectId: Number(objectId),
          parentId: parentId ?? undefined,
          parentObjectType: type,
          editableContent: {
            body: contentDto.body,
            attachments: attachmentKeys,
          },
        };

        const response = await forumCreateComment({ body: commentDto });

        if (response.error) {
          setSubmitError({
            parentId: parentId ?? null,
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
        setEditableContent({ body: "", attachments: [] });
        setNestedDraft({ body: "", attachments: [] });
        setReplyingTo(null);
        setIsComposing(false);
      } catch (err) {
        console.error("Error posting reply:", err);
        setSubmitError({
          parentId: parentId ?? null,
          message: "Failed to submit reply",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchComments, objectId, type],
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
    [fetchComments],
  );

  const handleUpdateReply = useCallback(
    async (
      replyId: number,
      content: CreateEditableContentDto,
    ): Promise<Result<void, string>> => {
      const saved = await R.fromPromiseFn(async () => {
        const attachmentKeys = await uploadAttachments(
          content.attachments ?? [],
        );
        const response = await forumUpdateComment({
          path: { id: replyId },
          body: {
            editableContent: {
              body: content.body,
              attachments: attachmentKeys,
            },
          },
        });
        return { attachmentKeys, error: response.error };
      });

      if (!saved.ok) {
        console.error("Failed to update comment:", saved.error);
        return R.failure("Failed to save your edit");
      }

      if (saved.value.error) {
        return R.failure(
          errorMessage({
            error: saved.value.error,
            fallback: "Failed to save your edit",
          }),
        );
      }

      const { attachmentKeys } = saved.value;

      setComments((prevComments) => {
        if (!prevComments) return null;

        const updateRecursively = (items: CommentDto[]): CommentDto[] => {
          return items.map((item) => {
            if (item.id === replyId) {
              return {
                ...item,
                editableContent: {
                  body: content.body,
                  attachments: attachmentKeys,
                },
              };
            }
            if (item.children) {
              return {
                ...item,
                children: updateRecursively(item.children),
              };
            }
            return item;
          });
        };

        return updateRecursively(prevComments);
      });

      return R.success(undefined);
    },
    [],
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

  const sortedComments = useMemo(() => {
    if (!comments) return null;
    return sortComments(
      topLevelComments.filter((comment) =>
        matchesCommentFilter(comment, commentFilter, filterContext),
      ),
      commentSort,
      { randomSeed, userClusterId: user?.clusterId },
    );
  }, [
    comments,
    topLevelComments,
    commentFilter,
    commentSort,
    filterContext,
    randomSeed,
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
      {user && !replyingTo && showForm ? (
        isComposing ? (
          <ReplyForm
            parentId={null}
            content={editableContent}
            setContent={setEditableContent}
            autofocus
            onCancel={() => setIsComposing(false)}
            objectId={objectId}
            isSubmitting={isSubmitting}
            error={submitErrorFor(null)}
            onDismissError={clearSubmitError}
            onSubmit={handleSubmitReply}
          />
        ) : (
          <TouchableOpacity
            onPress={() => setIsComposing(true)}
            activeOpacity={0.7}
            className="p-3 bg-zinc-100 rounded"
          >
            <Text className="text-zinc-500">Add a comment...</Text>
          </TouchableOpacity>
        )
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
              nestedDraft={nestedDraft}
              setNestedDraft={setNestedDraft}
              isSubmitting={isSubmitting}
              highlightedId={highlightedId}
              scrollViewRef={scrollViewRef}
              newlyAddedReplies={newlyAddedReplies}
              user={user}
              expertIds={expertIds}
              expertLabel={expertLabel}
              showClusterTags={showClusterTags}
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

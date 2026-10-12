import { withCount } from "@alliance/common/plural";
import { R, type Result } from "@alliance/common/result";
import {
  CommentDto,
  CreateEditableContentDto,
  PostTagDto,
  UserDto,
} from "@alliance/shared/client";
import { isCommentShown } from "@alliance/shared/lib/commentsFilter";
import { canReplyAtDepth } from "@alliance/shared/lib/commentTree";
import { uploadDraftAttachments } from "@alliance/shared/lib/uploadAttachments";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { Pin, X } from "lucide-react-native";
import { memo, useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { colors } from "../../lib/style/colors";
import EditableContentForm from "../EditableContentForm";
import EditableContentRenderer from "../EditableContentRenderer";
import { LikeActionButton } from "../LikeFooter";
import LikeSummary from "../LikeSummary";
import ProfileImage from "../ProfileImage";
import InlineError from "../system/InlineError";
import Text from "../system/Text";
import UserDisplayName from "../UserDisplayName";
import { ReplyForm, type SubmitReply } from "./ReplyForm";

const INDENT_PX = 12;
const MAX_INDENT_PX = 72;

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
  deleteErrorFor: (replyId: number) => string | null;
  clearDeleteError: (replyId: number) => void;
  onDeleteReply: (replyId: number) => void;
  onLikeReply: (replyId: number, unlike?: boolean) => Promise<unknown>;
};

type ReplyItemProps = ReplyItemSharedProps & {
  reply: CommentDto;
  depth?: number;
};

export const ReplyItem = memo(function ReplyItemView({
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
  const deleteError = shared.deleteErrorFor(reply.id);
  const viewRef = useRef<View>(null);
  const canNest = canReplyAtDepth(depth);
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
      style={{ marginLeft: Math.min(depth * INDENT_PX, MAX_INDENT_PX) }}
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
            <InlineError message={editError} />
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
          {!reply.deleted && (
            <LikeSummary
              likeTargetType="comment"
              likeTargetId={reply.id}
              liked={reply.likedByMe ?? false}
              likesCount={reply.likesCount}
              likers={reply.likes}
              className="mb-1.5"
            />
          )}
          <View className="flex-row items-center gap-x-3">
            {!reply.deleted && (
              <LikeActionButton
                compact
                liked={reply.likedByMe ?? false}
                onLike={
                  shared.user
                    ? () =>
                        shared.onLikeReply(reply.id, reply.likedByMe ?? false)
                    : undefined
                }
              />
            )}
            {shared.user && canNest && !reply.deleted && (
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

      <InlineError message={deleteError} className="mt-2">
        <TouchableOpacity
          onPress={() => shared.clearDeleteError(reply.id)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss this message"
          hitSlop={8}
        >
          <X size={14} color={colors.error} />
        </TouchableOpacity>
      </InlineError>

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
          {reply.children
            ?.filter((child) => isCommentShown(child, shared.replyingTo))
            .map((childReply) => (
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

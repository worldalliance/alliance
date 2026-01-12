import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import {
  CommentDto,
  CommentParentObject,
  CreateCommentDto,
  CreateEditableContentDto,
  UserDto,
  forumCreateComment,
  forumDeleteComment,
  forumFindCommentsForAction,
  forumFindCommentsForActivity,
  forumFindCommentsForPost,
  forumLikeComment,
  forumUnlikeComment,
  forumUpdateComment,
  imagesUploadImage,
} from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { Pin } from "lucide-react-native";
import { useAuth } from "../lib/AuthContext";
import EditableContentForm from "./EditableContentForm";
import EditableContentRenderer from "./EditableContentRenderer";
import LikeButton from "./LikeButton";
import ProfileImage from "./ProfileImage";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Text from "./system/Text";
import { colors } from "../lib/style/colors";

export interface CommentsProps {
  objectId: number;
  type: CommentParentObject;
  compact?: boolean;
  homeStyle?: boolean;
  autofocus?: boolean;
  showForm?: boolean;
  initialComments?: CommentDto[];
  highlightedReplyId?: number | null;
}

const renderAvatar = (user: CommentDto["author"]) => {
  return <ProfileImage pfp={user.profilePicture} size="small" />;
};

const uploadAttachments = async (attachments: string[]) => {
  const uploads = await Promise.all(
    attachments.map(async (file) => {
      if (file.startsWith("data:")) {
        const res = await imagesUploadImage({ body: { file } });
        return res.data?.key;
      }
      return file;
    })
  );
  return uploads.filter((key): key is string => Boolean(key));
};

const shouldShowComment = (comment: CommentDto) => {
  return !comment.deleted || (comment.children?.length ?? 0) > 0;
};

type ReplyFormProps = {
  parentId: number | null;
  content: CreateEditableContentDto;
  setContent: (next: CreateEditableContentDto) => void;
  onCancel?: () => void;
  compact?: boolean;
  autofocus?: boolean;
  objectId: number;
  isSubmitting: boolean;
  onSubmit: (
    content: CreateEditableContentDto,
    parentId?: number | null
  ) => void;
};

const ReplyForm = ({
  parentId,
  content,
  setContent,
  onCancel,
  compact,
  autofocus,
  objectId,
  isSubmitting,
  onSubmit,
}: ReplyFormProps) => {
  const canSubmit =
    content.body.trim() !== "" || (content.attachments?.length ?? 0) > 0;
  return (
    <View
      className={`border border-zinc-200 rounded ${
        compact ? "p-2" : "p-3"
      } bg-white`}
    >
      <EditableContentForm
        value={content}
        onChange={setContent}
        placeholder="Add a comment..."
        expanded={autofocus || parentId !== null}
        draftKey={`reply-${parentId ?? "root"}-${objectId}`}
      />
      <View className="flex-row justify-end gap-x-2 mt-3">
        {onCancel && (
          <Button
            color={ButtonColor.Light}
            size={ButtonSize.Small}
            title="Cancel"
            onPress={onCancel}
          />
        )}
        <Button
          color={ButtonColor.Black}
          size={ButtonSize.Small}
          title={isSubmitting ? "Posting..." : "Post Comment"}
          onPress={() => onSubmit(content, parentId)}
          disabled={!canSubmit || isSubmitting}
        />
      </View>
    </View>
  );
};

type ReplyItemSharedProps = {
  compact?: boolean;
  homeStyle?: boolean;
  autofocus?: boolean;
  objectId: number;
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  nestedDraft: CreateEditableContentDto;
  setNestedDraft: (next: CreateEditableContentDto) => void;
  isSubmitting: boolean;
  highlightedId: number | null;
  newlyAddedReplies: Set<number>;
  user: UserDto | undefined;
  onSubmitReply: (
    content: CreateEditableContentDto,
    parentId?: number | null
  ) => void;
  onUpdateReply: (
    replyId: number,
    content: CreateEditableContentDto
  ) => Promise<void>;
  onDeleteReply: (replyId: number) => void;
  onLikeReply: (replyId: number, unlike?: boolean) => void;
};

type ReplyItemProps = ReplyItemSharedProps & {
  reply: CommentDto;
  depth?: number;
};

const ReplyItem = ({ reply, depth = 0, ...shared }: ReplyItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>({
    body: reply.editableContent.body ?? "",
    attachments: reply.editableContent.attachments ?? [],
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const maxDepth = 6;
  const canNest = depth < maxDepth;
  const isReplyingToThis = shared.replyingTo === reply.id;
  const hasChildren = (reply.children?.length ?? 0) > 0;
  const isHighlighted = shared.highlightedId === reply.id;
  const isNewlyAdded = shared.newlyAddedReplies.has(reply.id);
  const containerSpacing = depth === 0 ? "p-3" : "p-2";
  const containerBorder = shared.homeStyle ? "" : "border border-zinc-200";
  const containerBg = isNewlyAdded ? "bg-green/10" : "bg-white";

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

  return (
    <View
      style={{ marginLeft: Math.min(depth * 12, maxDepth * 12) }}
      className={`rounded ${containerBorder} ${containerBg} ${containerSpacing} ${
        isHighlighted ? "border-l-2 border-blue-500" : ""
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-x-2">
          {renderAvatar(reply.author)}
          <Text className="text-xs text-zinc-500">
            <Text className="font-medium text-zinc-700">
              {reply.author.displayName}
            </Text>
            {` ${formatTime(new Date(reply.createdAt), {
              addSuffix: true,
            })}`}
          </Text>
          {hasChildren && isCollapsed && (
            <Text className="text-xs text-zinc-500">
              {reply.children?.length ?? 0}{" "}
              {reply.children?.length === 1 ? "reply" : "replies"} hidden
            </Text>
          )}
        </View>
        {reply.pinned && <Pin size={12} color={colors.text.tertiary} />}
      </View>

      <View className="mt-2">
        {isEditing ? (
          <View className="gap-y-2">
            <EditableContentForm
              value={editContent}
              onChange={setEditContent}
              placeholder="Edit your reply..."
              expanded
              draftKey={`edit-reply-${reply.id}`}
            />
            <View className="flex-row justify-end gap-x-2">
              <Button
                color={ButtonColor.Light}
                size={ButtonSize.Small}
                title="Cancel"
                onPress={() => {
                  setEditContent({
                    body: reply.editableContent.body ?? "",
                    attachments: reply.editableContent.attachments ?? [],
                  });
                  setIsEditing(false);
                }}
              />
              <Button
                color={ButtonColor.Black}
                size={ButtonSize.Small}
                title="Save"
                onPress={async () => {
                  await shared.onUpdateReply(reply.id, editContent);
                  setIsEditing(false);
                }}
                disabled={
                  editContent.body.trim() === "" &&
                  editContent.attachments.length === 0
                }
              />
            </View>
          </View>
        ) : (
          <EditableContentRenderer
            content={reply.editableContent}
            deleted={reply.deleted}
            collapsed={isCollapsed}
          />
        )}
      </View>

      {!isEditing && (
        <View className="flex-row items-center gap-x-3 mt-2">
          <LikeButton
            liked={reply.likes.some((like) => like.id === shared.user?.id)}
            likes={reply.likes.length}
            onPress={
              shared.user
                ? () =>
                    shared.onLikeReply(
                      reply.id,
                      reply.likes.some((like) => like.id === shared.user?.id)
                    )
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
              <Text className="text-xs text-zinc-500">
                {isReplyingToThis ? "Cancel reply" : "Reply"}
              </Text>
            </TouchableOpacity>
          )}
          {shared.user &&
            reply.author.id === shared.user.id &&
            !reply.deleted && (
              <View className="flex-row items-center gap-x-2">
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                >
                  <Text className="text-xs text-zinc-500">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => shared.onDeleteReply(reply.id)}
                  activeOpacity={0.7}
                >
                  <Text className="text-xs text-red-600">Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          {hasChildren && depth === 0 && (
            <TouchableOpacity
              onPress={() => setIsCollapsed(!isCollapsed)}
              activeOpacity={0.7}
            >
              <Text className="text-xs text-zinc-500">
                {isCollapsed ? "Show replies" : "Hide replies"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {shared.user && isReplyingToThis && !isCollapsed && (
        <View className="mt-3">
          <ReplyForm
            parentId={reply.id}
            content={shared.nestedDraft}
            setContent={shared.setNestedDraft}
            onCancel={() => shared.setReplyingTo(null)}
            compact={shared.compact}
            autofocus={shared.autofocus}
            objectId={shared.objectId}
            isSubmitting={shared.isSubmitting}
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
  homeStyle,
  autofocus,
  showForm = true,
  initialComments,
  highlightedReplyId,
}: CommentsProps) {
  const { user } = useAuth();
  const [editableContent, setEditableContent] =
    useState<CreateEditableContentDto>({ body: "", attachments: [] });
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedReplies, setNewlyAddedReplies] = useState<Set<number>>(
    new Set()
  );
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentDto[] | null>(
    initialComments ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [nestedDraft, setNestedDraft] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });

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
        const attachmentKeys = await uploadAttachments(
          contentDto.attachments ?? []
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
        setError(null);
      } catch (err) {
        console.error("Error posting reply:", err);
        setError("Failed to submit reply");
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchComments, objectId, type]
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
        ]
      );
    },
    [fetchComments]
  );

  const handleUpdateReply = useCallback(
    async (replyId: number, content: CreateEditableContentDto) => {
      const attachmentKeys = await uploadAttachments(content.attachments ?? []);
      await forumUpdateComment({
        path: { id: replyId },
        body: {
          editableContent: {
            body: content.body,
            attachments: attachmentKeys,
          },
        },
      });

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
    },
    []
  );

  const handleLikeReply = useCallback(
    async (replyId: number, unlike = false) => {
      if (unlike) {
        await forumUnlikeComment({ path: { id: replyId } });
      } else {
        await forumLikeComment({ path: { id: replyId } });
      }
      fetchComments();
    },
    [fetchComments]
  );

  const sortedComments = useMemo(() => {
    if (!comments) return null;
    return [...comments]
      .filter(shouldShowComment)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [comments]);

  return (
    <View className="gap-y-3">
      {user && !replyingTo && showForm ? (
        <ReplyForm
          parentId={null}
          content={editableContent}
          setContent={setEditableContent}
          compact={compact}
          autofocus={autofocus}
          objectId={objectId}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmitReply}
        />
      ) : !user && !compact ? (
        <View className="py-6 bg-zinc-50 rounded border border-zinc-200">
          <Text className="text-zinc-600 text-center">
            Please log in to post a reply.
          </Text>
        </View>
      ) : null}

      {error && <Text className="text-red-500">{error}</Text>}

      {sortedComments && sortedComments.length > 0 ? (
        <View className="gap-y-3">
          {sortedComments.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              compact={compact}
              homeStyle={homeStyle}
              autofocus={autofocus}
              objectId={objectId}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              nestedDraft={nestedDraft}
              setNestedDraft={setNestedDraft}
              isSubmitting={isSubmitting}
              highlightedId={highlightedId}
              newlyAddedReplies={newlyAddedReplies}
              user={user}
              onSubmitReply={handleSubmitReply}
              onUpdateReply={handleUpdateReply}
              onDeleteReply={handleDeleteReply}
              onLikeReply={handleLikeReply}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

import { CommentDto } from "@alliance/shared/client";
import { countAllReplies } from "@alliance/shared/lib/commentsFilter";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import ClusterTag from "@alliance/sharedweb/ui/ClusterTag";
import EditableContentForm from "@alliance/sharedweb/ui/EditableContentForm";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import PinnedIcon from "@alliance/sharedweb/ui/icons/PinnedIcon";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link, href } from "react-router";
import { useCommentEditing } from "../../hooks/useCommentEditing";
import { LikeActionButton } from "../LikeFooter";
import LikeSummary from "../LikeSummary";
import CommentActionsMenu from "./CommentActionsMenu";
import { useCommentsContext } from "./CommentsContext";
import ReplyForm from "./ReplyForm";

const INDENT_PX = 40;

export interface ReplyComponentProps {
  reply: CommentDto;
  depth?: number;
}

interface ReplyContentProps {
  reply: CommentDto;
  canNest: boolean;
  isReplyingToThis: boolean;
  hasChildren: boolean;
  isCollapsed?: boolean;
  isHighlighted: boolean;
  isCollapsible?: boolean;
  onToggleCollapse?: () => void;
}

const ReplyContent = ({
  reply,
  canNest,
  isReplyingToThis,
  hasChildren,
  isCollapsed = false,
  isHighlighted,
  isCollapsible = false,
  onToggleCollapse,
}: ReplyContentProps) => {
  const ctx = useCommentsContext();
  const {
    user,
    compact = false,
    expertIds = [],
    expertLabel,
    showClusterTags = false,
  } = ctx;
  const isExpert = expertIds.includes(reply.author.id);
  const editing = useCommentEditing(reply, ctx.onUpdateReply);

  return (
    <div className={cn("flex", compact ? "gap-x-2" : "gap-x-2.5", "relative")}>
      {isHighlighted && (
        <div className="absolute -left-4 top-0 bottom-0 w-[3px] bg-blue-500 rounded" />
      )}
      <Link
        to={href("/member/:id", { id: reply.author.id.toString() })}
        className="flex-shrink-0 pt-1"
      >
        <AvatarProfile
          pfp={reply.author.profilePicture}
          size={compact ? "small" : "medium"}
        />
      </Link>
      <div className="flex-1">
        <div className="flex justify-between items-center overflow-visible">
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="inline *:mr-2">
              <Link
                to={href("/member/:id", { id: reply.author.id.toString() })}
                className="text-zinc-800 font-medium inline"
              >
                <UserDisplayName
                  staff={ctx.showUserBadges && reply.author.staff}
                  ambassador={ctx.showUserBadges && reply.author.ambassador}
                  grouplead={
                    ctx.showUserBadges && reply.author.isCommunityLeader
                  }
                  expert={isExpert}
                  expertLabel={expertLabel}
                >
                  {reply.author.displayName}
                </UserDisplayName>
                {showClusterTags && reply.author.cluster && (
                  <ClusterTag
                    name={reply.author.cluster.displayName}
                    sameAsViewer={reply.author.cluster.id === user?.clusterId}
                    className="ml-1"
                  />
                )}
              </Link>
              <span className="text-zinc-500 text-sm">
                {formatDistanceToNow(new Date(reply.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {isCollapsible && onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className={cn(
                  "text-black cursor-pointer transition-transform duration-200",
                  isCollapsed ? "-rotate-90" : "rotate-0",
                )}
                aria-label={isCollapsed ? "Expand" : "Collapse"}
              >
                <ChevronDown size={18} />
              </button>
            )}
            {hasChildren && isCollapsed && reply.children !== undefined && (
              <span className="text-xs bg-zinc-200 px-2 py-1 -my-1 rounded">
                {countAllReplies(reply.children)}{" "}
                {countAllReplies(reply.children) === 1 ? "reply" : "replies"}{" "}
                hidden
              </span>
            )}
          </div>
          {reply.pinned && <PinnedIcon size="small" />}
        </div>

        <div className="text-base mb-1">
          {!editing.isEditing && (
            <EditableContentRenderer
              content={reply.editableContent}
              collapsed={isCollapsed}
              deleted={reply.deleted}
            />
          )}
        </div>

        {editing.isEditing ? (
          <div className="rounded p-3 bg-zinc-100">
            <EditableContentForm
              value={{
                body: editing.editContent,
                attachments: editing.editAttachments,
              }}
              onChange={(val) => {
                editing.setEditContent(val.body);
                editing.setEditAttachments(val.attachments);
              }}
              placeholder="Edit your reply..."
            />
            <div className="flex gap-2 mt-2 justify-end items-center">
              <span className="text-sm text-zinc-500">
                Drag an image to attach
              </span>
              <button
                onClick={editing.saveEdit}
                disabled={editing.isUpdating || !editing.editContent.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editing.isUpdating ? "Saving..." : "Save"}
              </button>
              <button
                onClick={editing.cancelEdit}
                disabled={editing.isUpdating}
                className="px-3 py-1 bg-zinc-300 text-zinc-700 text-sm rounded hover:bg-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            <LikeSummary
              likeTargetType="comment"
              likeTargetId={reply.id}
              liked={reply.likedByMe ?? false}
              likesCount={reply.likesCount}
              likers={reply.likes}
              className="mb-1.5"
            />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <LikeActionButton
                  compact
                  liked={reply.likedByMe ?? false}
                  onLike={() =>
                    ctx.onLikeReply(reply.id, reply.likedByMe ?? false)
                  }
                />
                {user && canNest && (
                  <button
                    onClick={() => {
                      ctx.setReplyingTo(reply.id);
                      if (isCollapsed && onToggleCollapse) {
                        onToggleCollapse();
                      }
                    }}
                    className="text-zinc-500 hover:text-zinc-700 hover:underline text-sm"
                  >
                    {!isReplyingToThis && "Reply"}
                  </button>
                )}
              </div>
              {!reply.deleted && (
                <CommentActionsMenu
                  replyId={reply.id}
                  isOwner={!!user && reply.author.id === user.id}
                  isAdmin={!!user?.admin}
                  isPinned={reply.pinned}
                  onEdit={editing.startEdit}
                  onDelete={ctx.handleDeleteReply}
                  onPin={ctx.onPinReply}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ReplyComponent = ({ reply, depth = 0 }: ReplyComponentProps) => {
  const ctx = useCommentsContext();
  const maxDepth = 10;
  const canNest = depth < maxDepth;
  const isReplyingToThis = ctx.replyingTo === reply.id;
  const hasChildren = reply.children ? reply.children.length > 0 : false;
  const isNewlyAdded = ctx.newlyAddedReplies.has(reply.id);
  const isHighlighted = ctx.highlightedReplyId === reply.id;
  const isTopLevel = depth === 0;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [nestedDraft, setNestedDraft] = useState<{
    body: string;
    attachments: string[];
  }>({ body: "", attachments: [] });

  const newReplyClass = isNewlyAdded ? "!bg-green/10" : "";

  const filteredChildren = (reply.children ?? []).filter(
    (child) => !child.deleted || child.children?.length,
  );

  const renderChildren = () => {
    if (!hasChildren || (isTopLevel && isCollapsed)) return null;
    if (reply.children === undefined) return null;

    return (
      <div>
        {filteredChildren.map((childReply) => (
          <div key={childReply.id}>
            <div
              className={cn(
                ctx.compact ? "my-3" : "my-3 sm:my-4",
                "-mx-2 sm:-mx-4",
              )}
            />
            <ReplyComponent reply={childReply} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  };

  const replyForm =
    ctx.user && isReplyingToThis && !(isTopLevel && isCollapsed) ? (
      <ReplyForm
        parentId={reply.id}
        onCancel={() => ctx.setReplyingTo(null)}
        editableContent={nestedDraft}
        setEditableContent={setNestedDraft}
        onSubmit={ctx.handleSubmitReply}
        isSubmitting={ctx.isSubmitting}
        className={isTopLevel ? "mt-3" : undefined}
        setReplyingTo={ctx.setReplyingTo}
        compact={ctx.compact}
        startExpanded={true}
      />
    ) : null;

  const isCollapsible =
    hasChildren ||
    reply.editableContent.body.includes("\n") ||
    reply.editableContent.body.length > 100 ||
    reply.editableContent.attachments.length > 0;

  const replyContent = (
    <ReplyContent
      reply={reply}
      canNest={canNest}
      isReplyingToThis={isReplyingToThis}
      hasChildren={hasChildren}
      isCollapsed={isTopLevel ? isCollapsed : undefined}
      isHighlighted={isHighlighted}
      isCollapsible={isTopLevel && !ctx.compact && isCollapsible}
      onToggleCollapse={
        isTopLevel ? () => setIsCollapsed(!isCollapsed) : undefined
      }
    />
  );

  if (isTopLevel) {
    return (
      <div
        key={reply.id}
        className={cn(
          "!display-block transition-colors duration-1000",
          newReplyClass,
          ctx.compact ? "!p-1 !border-none" : "!py-2 sm:!py-4",
          ctx.user && isReplyingToThis && !isCollapsed && "rounded-b-none",
        )}
      >
        <div id={`reply-${reply.id}`}>{replyContent}</div>
        {replyForm}
        {renderChildren()}
      </div>
    );
  }

  const indent = depth * INDENT_PX;

  return (
    <div>
      <div
        className={cn("rounded border-transparent", newReplyClass)}
        id={`reply-${reply.id}`}
        style={{ marginLeft: indent }}
      >
        {replyContent}
      </div>
      {replyForm && <div style={{ marginLeft: indent }}>{replyForm}</div>}
      {renderChildren()}
    </div>
  );
};

export default ReplyComponent;

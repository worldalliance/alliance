import {
  CommentDto,
  CreateEditableContentDto,
  UserDto,
  forumUpdateComment,
  imagesUploadImage,
} from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import PinnedIcon from "@alliance/shared/ui/icons/PinnedIcon";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { formatDistanceToNow } from "date-fns";
import React, { useEffect, useRef, useState } from "react";
import CommentLikeButton from "../CommentLikeButton";
import UserDisplayName from "../UserDisplayName";
import EditableContentForm from "@alliance/shared/ui/EditableContentForm";
import EditableContentRenderer from "@alliance/shared/ui/EditableContentRenderer";
import ReplyForm from "./ReplyForm";
import { Link, href } from "react-router";

const countAllReplies = (replies: CommentDto[]): number => {
  let count = 0;
  for (const reply of replies) {
    count += 1;
    if (reply.children && reply.children.length > 0) {
      count += countAllReplies(reply.children);
    }
  }
  return count;
};

interface ReplyComponentProps {
  reply: CommentDto;
  depth?: number;
  user?: UserDto;
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  handleSubmitReply: (content: CreateEditableContentDto) => void;
  handleDeleteReply: (id: number) => void;
  onUpdateReply: (id: number, content: CreateEditableContentDto) => void;
  onLikeReply: (id: number, unlike?: boolean) => void;
  isSubmitting: boolean;
  newlyAddedReplies: Set<number>;
  highlightedReplyId: number | null;
  compact?: boolean;
  homeStyle?: boolean;
}

interface ReplyContentProps
  extends Pick<
    ReplyComponentProps,
    | "reply"
    | "user"
    | "setReplyingTo"
    | "handleDeleteReply"
    | "onUpdateReply"
    | "onLikeReply"
    | "compact"
  > {
  canNest: boolean;
  isReplyingToThis: boolean;
  hasChildren: boolean;
  isCollapsed?: boolean;
  isHighlighted: boolean;
}

const ReplyContent: React.FC<ReplyContentProps> = ({
  reply,
  user,
  canNest,
  isReplyingToThis,
  hasChildren,
  isCollapsed = false,
  isHighlighted,
  setReplyingTo,
  handleDeleteReply,
  onUpdateReply,
  onLikeReply,
  compact = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.editableContent.body);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [editAttachments, setEditAttachments] = useState<string[]>(
    reply.editableContent.attachments
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleSaveEdit = async () => {
    setIsUpdating(true);
    try {
      // Upload new base64 images and keep existing keys
      const uploads = await Promise.all(
        editAttachments.map(async (img) => {
          if (img.startsWith("data:")) {
            const res = await imagesUploadImage({ body: { file: img } });
            return res.data?.key;
          }
          return img;
        })
      );
      const attachmentKeys = uploads.filter((key) => key !== undefined);

      await forumUpdateComment({
        path: { id: reply.id },
        body: {
          editableContent: {
            body: editContent.trim(),
            attachments: attachmentKeys,
          },
        },
      });
      console.log("updating reply");
      console.log(attachmentKeys);
      onUpdateReply(reply.id, {
        body: editContent.trim(),
        attachments: attachmentKeys,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update reply:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(reply.editableContent?.body ?? "");
    setEditAttachments(reply.editableContent?.attachments ?? []);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditContent(reply.editableContent?.body ?? "");
    setEditAttachments(reply.editableContent?.attachments ?? []);
    setIsEditing(true);
    setShowDropdown(false);
  };
  return (
    <div className={`flex ${compact ? "gap-x-2" : "gap-x-2.5"} relative`}>
      {/* Blue highlight indicator */}
      {isHighlighted && (
        <div className="absolute -left-4 top-0 bottom-0 w-[3px] bg-blue-500 rounded transition-all duration-1000" />
      )}

      {/* Profile picture column */}
      <Link
        to={href("/member/:id", { id: reply.author.id.toString() })}
        className="flex-shrink-0"
      >
        <div className="hidden sm:inline">
          <ProfileImage
            pfp={reply.author.profilePicture}
            size={compact ? "small" : "medium"}
          />
        </div>
        <div className="inline sm:hidden">
          <ProfileImage
            pfp={reply.author.profilePicture}
            size={compact ? "mini" : "small"}
          />
        </div>
      </Link>

      {/* Content column */}
      <div className="flex-1 ">
        {/* Top row: User name and date with pin icon in top right */}
        <div className="flex justify-between items-center overflow-visible">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
            <Link
              to={href("/member/:id", { id: reply.author.id.toString() })}
              className="text-black font-medium"
            >
              <UserDisplayName
                staff={reply.author.staff}
                grouplead={reply.author.isCommunityLeader}
              >
                {reply.author.displayName}
              </UserDisplayName>
            </Link>
            <span className="text-zinc-500 text-xs sm:text-sm">
              {formatDistanceToNow(new Date(reply.createdAt), {
                addSuffix: true,
              })}
            </span>
            {hasChildren && isCollapsed && reply.children !== undefined && (
              <span className="text-xs bg-gray-200 px-2 py-1 -my-1 rounded">
                {countAllReplies(reply.children)}{" "}
                {countAllReplies(reply.children) === 1 ? "reply" : "replies"}{" "}
                hidden
              </span>
            )}
          </div>
          {reply.pinned && <PinnedIcon size="small" />}
        </div>

        {/* Middle section: Reply content */}
        <div
          className={`${
            compact ? `text-xs sm:text-sm mb-1` : `text-sm sm:text-base mb-2`
          }`}
        >
          {!isEditing && (
            <EditableContentRenderer
              content={reply.editableContent}
              collapsed={isCollapsed}
              deleted={reply.deleted}
            />
          )}
        </div>

        {isEditing ? (
          <div className="rounded p-3 bg-zinc-100">
            <EditableContentForm
              value={{ body: editContent, attachments: editAttachments }}
              onChange={(val) => {
                setEditContent(val.body);
                setEditAttachments(val.attachments);
              }}
              placeholder="Edit your reply..."
            />
            <div className="flex gap-2 mt-2 justify-end items-center">
              <span className="text-sm text-zinc-500">
                Drag an image to attach
              </span>
              <button
                onClick={handleSaveEdit}
                disabled={isUpdating || !editContent.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Bottom row: Likes, reply button, and 3 dots dropdown */
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-1.5 sm:gap-3">
              <CommentLikeButton
                liked={reply.likes.some((like) => like.id === user?.id)}
                likes={reply.likes.length}
                handleLike={() =>
                  onLikeReply(
                    reply.id,
                    reply.likes.some((like) => like.id === user?.id)
                  )
                }
              />
              {user && canNest && (
                <button
                  onClick={() => {
                    setReplyingTo(isReplyingToThis ? null : reply.id);
                  }}
                  className="text-zinc-500 hover:text-zinc-700 hover:underline text-xs sm:text-sm"
                >
                  {!isReplyingToThis && "Reply"}
                </button>
              )}
            </div>
            {user &&
              !isEditing &&
              reply.author.id === user.id &&
              !reply.deleted && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="text-gray-500 hover:text-gray-700 p-1"
                    aria-label="More options"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {showDropdown && (
                    <div className="absolute right-0 bottom-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                      <button
                        onClick={handleStartEdit}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          handleDeleteReply(reply.id);
                          setShowDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

const ReplyComponent = ({
  reply,
  depth = 0,
  user,
  replyingTo,
  setReplyingTo,
  handleSubmitReply,
  handleDeleteReply,
  isSubmitting,
  newlyAddedReplies,
  highlightedReplyId,
  compact,
  onUpdateReply,
  onLikeReply,
  homeStyle = false,
}: ReplyComponentProps) => {
  const handleUpdateReply = async (
    id: number,
    content: CreateEditableContentDto
  ) => {
    if (onUpdateReply) {
      await onUpdateReply(id, content);
    } else {
      try {
        await forumUpdateComment({
          path: { id },
          body: { editableContent: content },
        });
        // Note: We don't update reply.content directly as it won't trigger re-render
        // The parent component should handle state updates
      } catch (error) {
        console.error("Failed to update comment:", error);
        throw error;
      }
    }
  };
  const maxDepth = 10;
  const canNest = depth < maxDepth;
  const isReplyingToThis = replyingTo === reply.id;
  const hasChildren = reply.children ? reply.children.length > 0 : false;
  const isNewlyAdded = newlyAddedReplies.has(reply.id);
  const isHighlighted = highlightedReplyId === reply.id;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [nestedDraft, setNestedDraft] = useState<{
    body: string;
    attachments: string[];
  }>({ body: "", attachments: [] });

  // Common styling classes
  const newReplyClass = isNewlyAdded ? "!bg-green/10" : "";

  // For top-level replies only, render the entire thread in a card
  if (depth === 0) {
    return (
      <div className="relative">
        {/* Collapse/Expand Arrow - absolutely positioned to the left of the card */}
        {hasChildren && !compact && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`absolute  top-6 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer ${
              compact ? "left-0" : "-left-6"
            }`}
            aria-label={isCollapsed ? "Expand replies" : "Collapse replies"}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isCollapsed ? "-rotate-90" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}

        <div className={`border-transparent duration-1000 rounded`}>
          <Card
            key={reply.id}
            className={`!display-block transition-colors duration-1000 ${newReplyClass} ${
              compact ? "!p-1 !border-none" : "!p-2 sm:!p-4"
            } ${user && isReplyingToThis && !isCollapsed && "rounded-b-none"}`}
            flex={false}
            style={homeStyle ? CardStyle.Transparent : CardStyle.White}
          >
            <div id={`reply-${reply.id}`}>
              <ReplyContent
                reply={reply}
                user={user}
                canNest={canNest}
                isReplyingToThis={isReplyingToThis}
                hasChildren={hasChildren}
                isCollapsed={isCollapsed}
                isHighlighted={isHighlighted}
                setReplyingTo={setReplyingTo}
                handleDeleteReply={handleDeleteReply}
                onUpdateReply={handleUpdateReply}
                onLikeReply={onLikeReply}
                compact={compact}
              />
            </div>
            {user && isReplyingToThis && !isCollapsed && (
              <ReplyForm
                parentId={reply.id}
                onCancel={() => setReplyingTo(null)}
                editableContent={nestedDraft}
                setEditableContent={setNestedDraft}
                onSubmit={handleSubmitReply}
                isSubmitting={isSubmitting}
                className="mt-3"
                setReplyingTo={setReplyingTo}
                compact={compact}
                startExpanded={true}
              />
            )}
            {/* Render nested replies within the same card */}
            {hasChildren && !isCollapsed && reply.children !== undefined && (
              <div>
                {reply.children
                  .filter(
                    (childReply) =>
                      !childReply.deleted || childReply.children?.length
                  )
                  .map((childReply) => (
                    <div key={childReply.id}>
                      <div
                        className={`${
                          compact
                            ? "my-3"
                            : "border-t border-zinc-200 my-3 sm:my-4"
                        } -mx-2 sm:-mx-4`}
                      ></div>
                      <div>
                        <ReplyComponent
                          reply={childReply}
                          depth={1}
                          user={user}
                          replyingTo={replyingTo}
                          setReplyingTo={setReplyingTo}
                          handleSubmitReply={handleSubmitReply}
                          handleDeleteReply={handleDeleteReply}
                          isSubmitting={isSubmitting}
                          newlyAddedReplies={newlyAddedReplies}
                          highlightedReplyId={highlightedReplyId}
                          onUpdateReply={onUpdateReply}
                          onLikeReply={onLikeReply}
                          compact={compact}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  const depthClasses = [
    "ml-0 sm:ml-0",
    "ml-4 sm:ml-6",
    "ml-8 sm:ml-12",
    "ml-12 sm:ml-18",
    "ml-16 sm:ml-24",
    "ml-20 sm:ml-30",
    "ml-24 sm:ml-36",
    "ml-28 sm:ml-42",
    "ml-32 sm:ml-48",
    "ml-36 sm:ml-54",
  ];

  // this is bad and we should do something better later
  const indentStyle =
    depthClasses[depth] || depthClasses[depthClasses.length - 1];

  return (
    <div>
      <div
        className={`rounded border-transparent ${newReplyClass} ${indentStyle} duration-1000`}
        id={`reply-${reply.id}`}
      >
        <ReplyContent
          reply={reply}
          user={user}
          canNest={canNest}
          isReplyingToThis={isReplyingToThis}
          hasChildren={hasChildren}
          isHighlighted={isHighlighted}
          setReplyingTo={setReplyingTo}
          handleDeleteReply={handleDeleteReply}
          onUpdateReply={handleUpdateReply}
          onLikeReply={onLikeReply}
          compact={compact}
        />
      </div>
      {user && isReplyingToThis && (
        <div className={`mt-2 ${indentStyle}`}>
          <ReplyForm
            parentId={reply.id}
            onCancel={() => setReplyingTo(null)}
            editableContent={nestedDraft}
            setEditableContent={setNestedDraft}
            onSubmit={handleSubmitReply}
            isSubmitting={isSubmitting}
            setReplyingTo={setReplyingTo}
            compact={compact}
            startExpanded={true}
          />
        </div>
      )}

      {/* Render children */}
      {hasChildren && reply.children !== undefined && (
        <div>
          {reply.children.map((childReply) => (
            <div key={childReply.id}>
              <div
                className={`
                  ${
                    compact ? "my-3" : "border-t border-gray-200 my-3 sm:my-4"
                  } -mx-2 sm:-mx-4
               `}
              ></div>
              <ReplyComponent
                reply={childReply}
                depth={depth + 1}
                user={user}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                handleSubmitReply={handleSubmitReply}
                handleDeleteReply={handleDeleteReply}
                isSubmitting={isSubmitting}
                newlyAddedReplies={newlyAddedReplies}
                highlightedReplyId={highlightedReplyId}
                onUpdateReply={onUpdateReply}
                onLikeReply={onLikeReply}
                compact={compact}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReplyComponent;

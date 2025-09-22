import {
  CommentDto,
  CommentParentObject,
  CreateCommentDto,
  CreateEditableContentDto,
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
import posthog from "posthog-js";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../lib/AuthContext";
import ReplyComponent from "./forum/ReplyComponent";
import ReplyForm from "./forum/ReplyForm";

export interface CommentsProps {
  objectId: number;
  type: CommentParentObject;
  compact?: boolean;
  homeStyle?: boolean; // minimal version for homepage
  autofocus?: boolean;
  showForm?: boolean;
}

const Comments = ({
  objectId,
  type,
  compact,
  homeStyle,
  autofocus,
  showForm = true,
}: CommentsProps) => {
  const [editableContent, setEditableContent] =
    useState<CreateEditableContentDto>({ body: "", attachments: [] });
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newlyAddedReplies, setNewlyAddedReplies] = useState<Set<number>>(
    new Set()
  );
  const [lastAddedReplyId, setLastAddedReplyId] = useState<number | null>(null);
  const [highlightedReplyId, setHighlightedReplyId] = useState<number | null>(
    null
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [comments, setComments] = useState<CommentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    fetchComments();
  }, [fetchComments]);

  // Handle highlighted reply from URL parameters
  useEffect(() => {
    const replyId = searchParams.get("replyId");
    if (replyId) {
      const replyIdNumber = parseInt(replyId, 10);
      if (!isNaN(replyIdNumber)) {
        setHighlightedReplyId(replyIdNumber);

        // Remove the replyId parameter from URL immediately to prevent re-highlighting
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("replyId");
        setSearchParams(newSearchParams, { replace: true });

        // Scroll to the reply after a short delay to ensure it's rendered
        setTimeout(() => {
          const replyElement = document.getElementById(
            `reply-${replyIdNumber}`
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

  const handleSubmitReply = async (contentDto: CreateEditableContentDto) => {
    try {
      setIsSubmitting(true);
      // Upload attachments first (if any) to get keys
      let attachmentKeys: string[] = [];
      if (contentDto.attachments.length > 0) {
        const uploads = await Promise.all(
          contentDto.attachments.map(async (fileB64: string) => {
            if (fileB64.startsWith("data:")) {
              const res = await imagesUploadImage({ body: { file: fileB64 } });
              return res.data as unknown as string; // API returns key
            }
            return fileB64; // already a key
          })
        );
        attachmentKeys = uploads.filter(Boolean);
      }
      const commentDto: CreateCommentDto = {
        parentObjectId: Number(objectId),
        parentId: replyingTo ?? undefined,
        parentObjectType: type,
        editableContent: { body: contentDto.body, attachments: attachmentKeys },
      };

      const response = await forumCreateComment({
        body: commentDto,
      });

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
      }

      setEditableContent({ body: "", attachments: [] });
      setReplyingTo(null);
      setError(null);
    } catch (err) {
      console.error("Error posting reply:", err);
      posthog.capture("error", {
        error: err,
      });
      setError("Failed to submit reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  // After comments refresh, scroll the newly added reply into view
  useEffect(() => {
    if (!lastAddedReplyId || !comments) return;
    // Allow the DOM to paint the new element
    const timeout = setTimeout(() => {
      const el = document.getElementById(`reply-${lastAddedReplyId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setLastAddedReplyId(null);
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [comments, lastAddedReplyId]);

  const handleDeleteReply = async (replyId: number) => {
    if (window.confirm("Are you sure you want to delete this reply?")) {
      try {
        await forumDeleteComment({
          path: { id: replyId },
        });

        // Refresh the post to get updated reply hierarchy
        fetchComments();
      } catch (err) {
        console.error("Error deleting reply:", err);
        setError("Failed to delete reply");
      }
    }
  };

  const handleUpdateReply = async (
    replyId: number,
    content: CreateEditableContentDto
  ) => {
    try {
      await forumUpdateComment({
        path: { id: replyId },
        body: { editableContent: content },
      });

      // Update the comment in the local state to trigger re-render
      setComments((prevComments) => {
        if (!prevComments) return null;

        const updateCommentRecursively = (
          comments: CommentDto[]
        ): CommentDto[] => {
          return comments.map((comment) => {
            if (comment.id === replyId) {
              return { ...comment, editableContent: { ...content, id: -1 } };
            }
            if (comment.children) {
              return {
                ...comment,
                children: updateCommentRecursively(comment.children),
              };
            }
            return comment;
          });
        };

        return updateCommentRecursively(prevComments);
      });
    } catch (error) {
      console.error("Failed to update comment:", error);
      throw error;
    }
  };

  const handleLikeReply = async (replyId: number, unlike = false) => {
    if (unlike) {
      await forumUnlikeComment({
        path: { id: replyId },
      });
    } else {
      await forumLikeComment({
        path: { id: replyId },
      });
    }
    fetchComments();
  };

  return (
    <div>
      {user && !replyingTo && showForm ? (
        <ReplyForm
          parentId={null}
          editableContent={editableContent}
          setEditableContent={setEditableContent}
          onSubmit={handleSubmitReply}
          isSubmitting={isSubmitting}
          setReplyingTo={setReplyingTo}
          compact={compact}
          startExpanded={autofocus}
        />
      ) : !user && !compact ? (
        <div className="text-center py-6 bg-zinc-50 rounded border border-zinc-200">
          <p className="text-zinc-600">
            Please{" "}
            <Link to="/login" className="text-green hover:underline">
              log in
            </Link>{" "}
            to post a reply.
          </p>
        </div>
      ) : null}
      {error && <div className="text-red-500">{error}</div>}
      {comments && comments.length > 0 ? (
        <div className={`${compact ? "mt-3 " : "space-y-2 my-3"}`}>
          {comments
            .filter((comment) => !comment.deleted || comment.children?.length)
            .map((reply) => (
              <ReplyComponent
                key={reply.id}
                reply={reply}
                user={user}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                handleSubmitReply={handleSubmitReply}
                handleDeleteReply={handleDeleteReply}
                isSubmitting={isSubmitting}
                newlyAddedReplies={newlyAddedReplies}
                highlightedReplyId={highlightedReplyId}
                compact={compact}
                onUpdateReply={handleUpdateReply}
                onLikeReply={handleLikeReply}
                homeStyle={homeStyle}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
};

export default Comments;

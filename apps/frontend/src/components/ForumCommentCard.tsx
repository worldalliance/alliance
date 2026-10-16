import { commentPath } from "@alliance/common/commentPath";
import { CommentDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import { MessageCircle } from "lucide-react";
import { useCallback } from "react";
import { Link, href, useNavigate } from "react-router";
import LikeFooter, { LikeBarButton } from "./LikeFooter";

interface ForumCommentCardProps {
  comment: CommentDto;
  postId: number;
  postTitle: string;
  likedByMe: boolean;
  likesCount: number;
  handleLike: () => Promise<unknown>;
}

const ForumCommentCard = ({
  comment,
  postId,
  postTitle,
  likedByMe,
  likesCount,
  handleLike,
}: ForumCommentCardProps) => {
  const navigate = useNavigate();

  const postUrlWithReply = commentPath({
    parentObjectType: "post",
    parentObjectId: postId,
    id: comment.id,
  });

  const handleCardClick = useCallback(() => {
    navigate(postUrlWithReply);
  }, [navigate, postUrlWithReply]);

  const handleReplyClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(postUrlWithReply);
    },
    [navigate, postUrlWithReply],
  );

  const timeSinceCommented = formatTime(new Date(comment.createdAt), {
    addSuffix: true,
  });

  const hasBody =
    !!comment.editableContent.body ||
    comment.editableContent.attachments.length > 0;

  return (
    <div className="flex flex-col bg-white">
      <div
        // Child controls do not open post; keep card hover off there.
        className="block p-4 -m-4 text-[11pt] transition-colors duration-100 flex-1 gap-y-2 bg-white hover:bg-grey-1 [&:has(a:hover)]:bg-white [&:has(button:hover)]:bg-white cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex flex-wrap items-center">
          <Link
            to={href("/member/:id", { id: comment.author.id.toString() })}
            className="inline-flex items-center text-zinc-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <AvatarProfile
              pfp={comment.author.profilePicture}
              size="small"
              className="mr-2 shrink-0"
            />
            <span>{comment.author.displayName}</span>
          </Link>
          <span className="whitespace-pre text-zinc-900">{` commented on `}</span>
          <Link
            to={href("/forum/post/:id", { id: postId.toString() })}
            className="text-green hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {postTitle}
          </Link>
        </div>
        <div>
          {hasBody && (
            <div className="my-3 rounded bg-grey-0 p-4">
              <EditableContentRenderer content={comment.editableContent} />
            </div>
          )}
          <p className="text-zinc-500 mt-1">{timeSinceCommented}</p>
          <LikeFooter
            likeTargetType="comment"
            likeTargetId={comment.id}
            liked={likedByMe}
            likesCount={likesCount}
            likers={comment.likes}
            onLike={handleLike}
          >
            <LikeBarButton
              icon={MessageCircle}
              label="Reply"
              onPress={handleReplyClick}
            />
          </LikeFooter>
        </div>
      </div>
    </div>
  );
};

export default ForumCommentCard;

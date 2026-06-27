import { UserCommentDto } from "@alliance/shared/client";
import { Link, href, useNavigate } from "react-router";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { formatTime } from "@alliance/shared/lib/utils";

export interface ForumActivityCommentCardProps {
  comment: UserCommentDto;
}

const ForumActivityCommentCard = ({
  comment,
}: ForumActivityCommentCardProps) => {
  const url =
    comment.parentObjectType === "post"
      ? `${href("/forum/post/:id", {
          id: comment.parentObjectId.toString(),
        })}?replyId=${comment.id}`
      : comment.parentObjectType === "action"
      ? `${href("/actions/:id", {
          id: comment.parentObjectId.toString(),
        })}?replyId=${comment.id}`
      : null;

  const navigate = useNavigate();

  if (!url) {
    return null;
  }

  return (
    <Link
      to={url}
      className="w-full mb-0 p-4 hover:bg-zinc-50 bg-white space-y-2"
    >
      <EditableContentRenderer content={comment.editableContent} truncated />
      <div className="flex flex-row items-center gap-x-2 text-sm text-zinc-500">
        <AvatarProfile pfp={comment.author.profilePicture} size="small" />
        <span>
          <UserDisplayName
            staff={comment.author.staff}
            ambassador={comment.author.ambassador}
            grouplead={comment.author.isCommunityLeader}
          >
            {comment.author.displayName}
          </UserDisplayName>{" "}
          {`commented ${formatTime(new Date(comment.createdAt), {
            addSuffix: true,
          })} in `}
          <span
            className="!text-green font-medium"
            onClick={() => {
              navigate(
                href("/forum/post/:id", {
                  id: comment.parentObjectId.toString(),
                })
              );
            }}
          >
            {comment.parentTitle}
          </span>
        </span>
      </div>
    </Link>
  );
};

export default ForumActivityCommentCard;

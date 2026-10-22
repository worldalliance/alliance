import { commentPath } from "@alliance/common/commentPath";
import { UserCommentDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { Link } from "react-router";

export interface ForumActivityCommentCardProps {
  comment: UserCommentDto;
}

const ForumActivityCommentCard = ({
  comment,
}: ForumActivityCommentCardProps) => {
  return (
    <Link
      to={commentPath(comment)}
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
          <span className="!text-green font-medium">{comment.parentTitle}</span>
        </span>
      </div>
    </Link>
  );
};

export default ForumActivityCommentCard;

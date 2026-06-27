import { CommentDto, PostDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import PinnedIcon from "@alliance/sharedweb/ui/icons/PinnedIcon";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { MessageCircle } from "lucide-react";
import { Link, href, useNavigate } from "react-router";

export interface ForumListPostProps {
  post: PostDto;
  commentFeature?: CommentDto;
  showReply?: boolean;
  showContentPreview?: boolean;
}

const ForumListPost = ({
  post,
  commentFeature,
  showReply = true,
  showContentPreview = false,
}: ForumListPostProps) => {
  const navigate = useNavigate();

  const lastCommentAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (post.lastComment?.author) {
      navigate(
        href("/member/:id", { id: post.lastComment.author.id.toString() }),
      );
    }
  };

  const isPrivateFuturePost =
    post.visibleAt && new Date(post.visibleAt) > new Date();

  return (
    <Link
      to={href("/forum/post/:id", { id: post.id.toString() })}
      className={cn(
        "w-full mb-0 !gap-y-1 p-4 cursor-pointer",
        isPrivateFuturePost
          ? "bg-sky-50 hover:bg-sky-100/60"
          : "hover:bg-zinc-50 bg-white",
      )}
    >
      <div className="flex flex-col gap-y-0 mb-3">
        <div className="flex flex-row gap-y-1 gap-2 justify-between">
          <div>
            <div className="flex flex-row gap-x-1 items-center">
              {post.pinned && <PinnedIcon size="small" />}
              <p className="text-lg font-medium">{post.title}</p>
              {post.commentCount != null && post.commentCount > 0 && (
                <>
                  <MessageCircle
                    size={14}
                    className="text-zinc-500 ml-1"
                    strokeWidth={2.5}
                  />
                  <span className="text-zinc-500">{post.commentCount}</span>
                </>
              )}
            </div>
            {isPrivateFuturePost && (
              <span className="text-sm text-blue">
                Only you can see this - will be posted{" "}
                {formatTime(new Date(post.visibleAt!), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
        {showContentPreview && (
          <EditableContentRenderer
            content={
              commentFeature
                ? commentFeature.editableContent
                : post.editableContent
            }
            truncated
            className="text-zinc-500"
          />
        )}
      </div>
      <div className="flex flex-row justify-between md:items-end text-sm text-zinc-500 gap-y-1 flex-wrap gap-x-4">
        <div className="flex flex-row items-center">
          {(post.authors?.length ? post.authors : [post.author]).map((a) => (
            <span key={a.id} className="mr-2">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  navigate(href("/member/:id", { id: a.id.toString() }));
                }}
              >
                <AvatarProfile
                  pfp={a.profilePicture}
                  size="small"
                  className="mr-2 -mt-1"
                />
                <UserDisplayName
                  className="text-black"
                  staff={a.staff}
                  ambassador={a.ambassador}
                  grouplead={a.isCommunityLeader}
                >
                  {a.displayName}
                </UserDisplayName>
              </span>
            </span>
          ))}
          <span className="text-sm text-zinc-500 -ml-1">
            posted{" "}
            {`${formatTime(new Date(post.createdAt), {
              addSuffix: true,
            })}`}
          </span>
        </div>

        {post.lastComment && showReply && (
          <div className="flex items-center gap-x-1">
            <span onClick={lastCommentAuthorClick}>
              <UserDisplayName
                staff={post.lastComment.author.staff}
                ambassador={post.lastComment.author.ambassador}
                grouplead={post.lastComment.author.isCommunityLeader}
              >
                {post.lastComment.author.displayName}
              </UserDisplayName>
              {` replied ${formatTime(new Date(post.lastComment.createdAt), {
                addSuffix: true,
              })}`}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default ForumListPost;

import { CommentDto, PostDto } from "@alliance/shared/client";
import PinnedIcon from "@alliance/shared/ui/icons/PinnedIcon";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { Link, href, useNavigate } from "react-router";
import { cx, formatTime } from "@alliance/shared/lib/utils";
import ActivityFeedItem from "./ActivityFeedItem";
import EditableContentRenderer from "@alliance/shared/ui/EditableContentRenderer";
import UserDisplayName from "./UserDisplayName";

export interface ForumListPostProps {
  post: PostDto;
  commentFeature?: CommentDto;
  card?: boolean;
  showAction?: boolean;
  showReply?: boolean;
  showContentPreview?: boolean;
}

const ForumListPost = ({
  post,
  commentFeature,
  card = true,
  showAction = true,
  showReply = true,
  showContentPreview = false,
}: ForumListPostProps) => {
  const navigate = useNavigate();

  const authorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!post.author?.id) return;
    navigate(href("/member/:id", { id: post.author.id.toString() }));
  };

  const lastCommentAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (post.lastComment?.author) {
      navigate(
        href("/member/:id", { id: post.lastComment.author.id.toString() })
      );
    }
  };

  const actionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.action?.id !== undefined) {
      navigate(href("/actions/:id", { id: post.action.id.toString() }));
    }
  };

  const isPrivateFuturePost =
    post.visibleAt && new Date(post.visibleAt) > new Date();

  if (card) {
    return (
      <Link
        to={href("/forum/post/:id", { id: post.id.toString() })}
        className={cx(
          "w-full mb-0 !gap-y-1 p-4  cursor-pointer",
          isPrivateFuturePost
            ? "bg-sky-50 hover:bg-sky-100/60"
            : "hover:bg-zinc-50 bg-white"
        )}
      >
        <div className="flex flex-col gap-y-0 mb-2">
          <div className="flex flex-row gap-y-1 items-center gap-2">
            {post.pinned && <PinnedIcon size="small" />}
            <p className={`text-base`}>{post.title}</p>
            {isPrivateFuturePost && (
              <span className="text-sm text-blue">
                Only you can see this - will be posted{" "}
                {formatTime(new Date(post.visibleAt!), {
                  addSuffix: true,
                })}
              </span>
            )}
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
        <div className="flex flex-col md:flex-row md:justify-between md:items-end text-sm text-zinc-500 gap-y-1 md:gap-y-0">
          <div className="flex flex-row gap-x-1.5 items-center">
            <ProfileImage pfp={post.author.profilePicture} size="small" />
            <p>
              <span onClick={authorClick}>
                <UserDisplayName
                  staff={post.author.staff}
                  grouplead={post.author.isCommunityLeader}
                >
                  {post.author.displayName}
                </UserDisplayName>
              </span>
              <span>
                {` posted ${formatTime(new Date(post.createdAt), {
                  addSuffix: true,
                })}`}
              </span>
            </p>
            {post.action?.name !== undefined && showAction && (
              <p
                onClick={actionClick}
                className="inline-block bg-green/20 text-green hover:bg-green/40 px-3 py-1 rounded-lg text-sm"
              >
                {post.action.name}
              </p>
            )}
          </div>

          {post.lastComment && showReply && (
            <div className="flex items-center gap-x-1">
              <ProfileImage
                pfp={post.lastComment.author.profilePicture}
                size="small"
              />
              <span onClick={lastCommentAuthorClick}>
                <UserDisplayName staff={post.lastComment.author.staff}>
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
  } else {
    return (
      <div
        key={post.id}
        className="flex items-start space-x-3 rounded-md border-zinc-200 hover:bg-zinc-100 px-4 -mx-4 cursor-pointer"
        onClick={() => {
          navigate(
            post.lastComment && showReply
              ? `${href("/forum/post/:id", {
                  id: post.id.toString(),
                })}?replyId=${post.lastComment.id}`
              : href("/forum/post/:id", { id: post.id.toString() })
          );
        }}
      >
        <ActivityFeedItem
          title={post.title}
          content={`${post.lastComment ? "replied" : "posted"} ${formatTime(
            new Date(
              post.lastComment ? post.lastComment.createdAt : post.updatedAt
            ),
            {
              addSuffix: true,
            }
          )}`}
          user={post.lastComment ? post.lastComment.author : post.author}
        />
      </div>
    );
  }
};

export default ForumListPost;

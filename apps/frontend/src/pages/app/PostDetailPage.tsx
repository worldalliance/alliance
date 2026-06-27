import { forumFindOnePost, forumRemovePost } from "@alliance/shared/client";
import { formatFullDateTime } from "@alliance/shared/lib/dateFormatters";
import { usePostLikeMutation } from "@alliance/shared/lib/usePostLikeMutation";
import { formatTime } from "@alliance/shared/lib/utils";
import { CardStyle } from "@alliance/shared/styles/card";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Card from "@alliance/sharedweb/ui/Card";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import PinnedIcon from "@alliance/sharedweb/ui/icons/PinnedIcon";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import React, { useState } from "react";
import { Link, href, useNavigate, useParams } from "react-router";
import Comments from "../../components/Comments";
import LikeFooter from "../../components/LikeFooter";
import { useAuth } from "../../lib/AuthContext";
import { useCIDFromParams } from "../../lib/utils";

const PostDetailPage: React.FC = () => {
  const { id: postId } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useCIDFromParams();

  const {
    data: post = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["forumFindOnePost", postId],
    queryFn: () =>
      forumFindOnePost({ path: { id: postId! } }).then(
        (res) => res.data ?? null,
      ),
    enabled: !!postId,
  });

  const handleDeletePost = async () => {
    if (!post || !amAuthor) {
      return;
    }

    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await forumRemovePost({
          path: { id: post.id },
        });
        navigate(href("/forum"));
      } catch (err) {
        console.error("Error deleting post:", err);
        setError("Failed to delete post");
      }
    }
  };

  const handleLike = usePostLikeMutation({
    postId: Number(postId),
    userId: user?.id,
    getPost: () => post,
    setPost: (updater) => {
      queryClient.setQueryData(
        ["forumFindOnePost", postId],
        (old: typeof post) => (old ? updater(old) : old),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["forumFindOnePost", postId],
      });
    },
  });

  const displayError =
    error || (queryError ? "Failed to load post details" : null);

  if (displayError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {displayError}
        </div>
      </div>
    );
  }

  if (loading || !post) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="absolute inset-0 flex items-center justify-center">
          {loading ? (
            <Spinner size="large" />
          ) : (
            <p className="text-center text-zinc-500">Post not found</p>
          )}
        </div>
      </div>
    );
  }

  const amAuthor =
    post.author.id === user?.id ||
    post.authors?.some((author) => author.id === user?.id);

  return (
    <div className="w-full">
      <div className="container max-w-4xl mx-auto px-2 py-4 md:py-8">
        <div className="relative">
          <Link
            to={href("/forum")}
            className="absolute -left-10 top-[28px] text-link"
            title="Back to Forum"
          >
            <ArrowLeft size={18} />
          </Link>
          {post.visibleAt && new Date(post.visibleAt) > new Date() && (
            <Card style={CardStyle.Alert} className="mb-2 border-none">
              <span className="text-zinc-800">
                Only you can see this post. it is scheduled for{" "}
                {formatFullDateTime(new Date(post.visibleAt))}
              </span>
            </Card>
          )}
          <div className="py-3 sm:pt-6 px-3 sm:px-5 mb-3">
            <div className="flex flex-row items-center justify-between mb-3">
              <h1 className="text-title">
                {post.title}
                {post.pinned && (
                  <PinnedIcon size="large" className="ml-2 -mt-1" />
                )}
              </h1>
            </div>
            <div className="flex flex-row gap-x-2 mb-2 sm:mb-4 mt-1 items-center text-base flex-wrap">
              {(post.authors?.length ? post.authors : [post.author]).map(
                (author) => (
                  <React.Fragment key={author.id}>
                    <Link
                      to={href("/member/:id", {
                        id: author.id.toString(),
                      })}
                      className="flex items-center"
                    >
                      <div className="hidden sm:inline">
                        <AvatarProfile
                          pfp={author.profilePicture}
                          size="small"
                          className="mr-1.5"
                        />
                      </div>
                      <div className="inline sm:hidden">
                        <AvatarProfile
                          pfp={author.profilePicture}
                          size="small"
                          className="mr-1.5"
                        />
                      </div>
                      <UserDisplayName
                        staff={author.staff}
                        ambassador={author.ambassador}
                        grouplead={author.isCommunityLeader}
                      >
                        {author.displayName}
                      </UserDisplayName>
                    </Link>
                  </React.Fragment>
                ),
              )}
              <span className="text-zinc-500">
                {formatTime(new Date(post.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {post.action && (
                <Link
                  to={href("/actions/:id", { id: post.action.id.toString() })}
                  className="inline-block bg-green/20 text-green hover:bg-green/40 px-3 py-1 rounded-lg text-sm"
                >
                  {post.action.name}
                </Link>
              )}
            </div>
            <EditableContentRenderer content={post.editableContent} />
            <LikeFooter
              likeTargetType="post"
              likeTargetId={post.id}
              liked={post.likedByMe ?? false}
              likesCount={post.likeCount ?? 0}
              likers={post.likes}
              onLike={handleLike}
              align="right"
            />
            {amAuthor && (
              <div className="flex items-center gap-x-2 mt-3">
                <Link
                  to={href("/forum/edit/:postId", {
                    postId: post.id.toString(),
                  })}
                  className="px-4 py-2 text-sm bg-zinc-100 text-gray-700 rounded hover:bg-zinc-200"
                >
                  Edit
                </Link>
                <span
                  onClick={handleDeletePost}
                  className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 cursor-pointer"
                >
                  Delete
                </span>
              </div>
            )}
          </div>
        </div>
        <Comments
          objectId={post.id}
          type={"post"}
          qaMode={post.qaMode}
          expertIds={post.qaMode ? (post.expertIds ?? []) : []}
          expertLabel={post.qaMode ? post.expertLabel : undefined}
          showClusterTags={post.showClusterTags}
          className="px-2 md:px-4"
        />
      </div>
    </div>
  );
};

export default PostDetailPage;

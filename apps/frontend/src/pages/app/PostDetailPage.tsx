import {
  forumFindOnePost,
  forumLikePost,
  forumRemovePost,
  forumUnlikePost,
  PostDto,
} from "@alliance/shared/client";
import Card from "@alliance/sharedweb/ui/Card";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import PinnedIcon from "@alliance/sharedweb/ui/icons/PinnedIcon";
import React, { useCallback, useEffect, useState } from "react";
import { Link, href, useNavigate, useParams } from "react-router";
import { setRevalidate } from "../../applayout";
import Comments from "../../components/Comments";
import PostLikeButton from "../../components/PostLikeButton";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import { useAuth } from "../../lib/AuthContext";
import { formatTime } from "@alliance/shared/lib/utils";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useCIDFromParams } from "../../lib/utils";
import { CardStyle } from "@alliance/shared/styles/card";

const PostDetailPage: React.FC = () => {
  const { id: postId } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  useCIDFromParams();

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    try {
      const response = await forumFindOnePost({
        path: { id: postId },
      });
      setPost(response.data ?? null);
      setError(null);
    } catch (err) {
      console.error("Error fetching post details:", err);
      setError("Failed to load post details");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleDeletePost = async () => {
    if (!post || post.author.id !== user?.id) {
      return;
    }

    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await forumRemovePost({
          path: { id: post.id },
        });
        setRevalidate();
        navigate(href("/forum"));
      } catch (err) {
        console.error("Error deleting post:", err);
        setError("Failed to delete post");
      }
    }
  };

  const handleLike = useCallback(async () => {
    if (!post) return;

    if (post.likes?.some((like) => like.id === user?.id)) {
      await forumUnlikePost({
        path: { id: post.id },
      });
    } else {
      await forumLikePost({
        path: { id: post.id },
      });
    }

    fetchPost();
  }, [post, fetchPost, user]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
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

  return (
    <div className="w-full">
      <div className="container max-w-4xl mx-auto px-4 py-4 md:py-8">
        <div className="relative">
          <Link
            to={href("/forum")}
            className="absolute -left-10 top-6 text-blue text-lg"
            title="Back to Forum"
          >
            &larr;
          </Link>
          {post.visibleAt && new Date(post.visibleAt) > new Date() && (
            <Card style={CardStyle.Alert} className="mb-2 border-none">
              <span className="text-zinc-800">
                Only you can see this post. it is scheduled for{" "}
                {new Date(post.visibleAt).toLocaleString()}
              </span>
            </Card>
          )}
          <Card className="py-6 px-5 mb-3" style={CardStyle.White}>
            <div className="flex justify-between items-start">
              <div className="flex flex-row gap-x-1 items-center w-full ">
                {post.pinned && <PinnedIcon size="large" />}
                <h1 className="!text-xl !font-medium -mt-1">{post.title}</h1>
              </div>
            </div>
            <div className="flex flex-row gap-x-2 mb-2 sm:mb-4 mt-1 items-center text-sm sm:text-base">
              <Link
                to={href("/member/:id", { id: post.author.id.toString() })}
                className="flex items-center"
              >
                <div className="hidden sm:inline">
                  <ProfileImage
                    pfp={post.author.profilePicture}
                    size="medium"
                    className="mr-2"
                  />
                </div>
                <div className="inline sm:hidden">
                  <ProfileImage
                    pfp={post.author.profilePicture}
                    size="small"
                    className="mr-2"
                  />
                </div>
                <UserDisplayName
                  staff={post.author.staff}
                  grouplead={post.author.isCommunityLeader}
                >
                  {post.author.displayName}
                </UserDisplayName>
              </Link>
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
            <div className="text-sm sm:text-base">
              <EditableContentRenderer content={post.editableContent} />
            </div>
            <div className="flex items-center mt-2 sm:mt-4 gap-x-1.5 -mb-2">
              <div className="">
                <PostLikeButton
                  liked={
                    post.likes?.some((like) => like.id === user?.id) ?? false
                  }
                  likes={post.likes?.length ?? 0}
                  handleLike={handleLike}
                />
              </div>
              {post.author.id === user?.id && (
                <>
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
                </>
              )}
            </div>
          </Card>
        </div>
        <Comments objectId={post.id} type={"post"} />
      </div>
    </div>
  );
};

export default PostDetailPage;

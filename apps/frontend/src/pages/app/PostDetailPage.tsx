import {
  forumFindOnePost,
  forumLikePost,
  forumRemovePost,
  forumUnlikePost,
  PostDto,
} from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import PinnedIcon from "@alliance/shared/ui/icons/PinnedIcon";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { setRevalidate } from "../../applayout";
import Comments from "../../components/Comments";
import PostLikeButton from "../../components/PostLikeButton";
import UserDisplayName from "../../components/UserDisplayName";
import EditableContentRenderer from "../../components/forum/EditableContentRenderer";
import { useAuth } from "../../lib/AuthContext";
import { formatTime } from "../../lib/utils";

const PostDetailPage: React.FC = () => {
  const { id: postId } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

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
        navigate("/forum");
      } catch (err) {
        console.error("Error deleting post:", err);
        setError("Failed to delete post");
      }
    }
  };

  const handleLike = useCallback(async () => {
    if (!post) return;

    if (post.likes.some((like) => like.id === user?.id)) {
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

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-10 text-gray-500">
          <p>Post not found</p>
          <Link
            to="/forum"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            Return to Forum
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="container max-w-4xl mx-auto px-4 py-4 md:py-8">
        <div className="relative">
          <Link
            to="/forum"
            className="absolute -left-10 top-6 text-blue text-lg"
            title="Back to Forum"
          >
            &larr;
          </Link>
          <Card className="py-6 px-5 mb-3" style={CardStyle.White}>
            <div className="flex justify-between items-start">
              <div className="flex flex-row gap-x-1 items-center w-full ">
                {post.pinned && <PinnedIcon size="large" />}
                <h1 className="!text-xl !font-medium -mt-1">{post.title}</h1>
              </div>
            </div>
            <div className="flex flex-row gap-x-2 mb-4 mt-1 items-center">
              <Link
                to={`/user/${post.author.id}`}
                className="flex items-center"
              >
                <ProfileImage
                  pfp={post.author.profilePicture}
                  size="medium"
                  className="mr-2"
                />
                <UserDisplayName staff={post.author.staff}>
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
                  to={`/actions/${post.action.id}`}
                  className="inline-block bg-green/20 text-green hover:bg-green/40 px-3 py-1 rounded-lg text-sm"
                >
                  {post.action.name}
                </Link>
              )}
            </div>
            <EditableContentRenderer content={post.editableContent} />
            <div className="flex items-center mt-4 gap-x-1.5 -mb-2">
              <div className="">
                <PostLikeButton
                  liked={post.likes.some((like) => like.id === user?.id)}
                  likes={post.likes.length}
                  handleLike={handleLike}
                />
              </div>
              {post.author.id === user?.id && (
                <>
                  <Link
                    to={`/forum/edit/${post.id}`}
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

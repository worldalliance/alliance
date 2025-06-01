import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  PostDto,
  CreateReplyDto,
  ReplyDto,
  Reply,
} from "@alliance/shared/client";
import { useAuth } from "../../lib/AuthContext";
import { formatDistanceToNow } from "date-fns";
import Card from "../../components/system/Card";
import {
  forumCreateReply,
  forumFindOnePost,
  forumRemovePost,
  forumRemoveReply,
} from "@alliance/shared/client";

const PostDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<PostDto | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      try {
        setIsLoading(true);
        const response = await forumFindOnePost({
          path: { id: postId },
        });
        setPost(response.data ?? null);
        setError(null);
      } catch (err) {
        console.error("Error fetching post details:", err);
        setError("Failed to load post details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!postId) {
      return;
    }

    try {
      setIsSubmitting(true);
      const replyDto: CreateReplyDto = {
        content: replyContent,
        postId: Number(postId),
      };

      const response = await forumCreateReply({
        body: replyDto,
      });

      // Update post with new reply
      if (post && response.data) {
        console.log("new reply data", response.data);
        const newReply: ReplyDto = response.data;
        const newReplyI: Reply = {
          ...newReply,
          authorId: newReply.author.id,
          postId: newReply.postId,
        };

        setPost({
          ...post,
          replies: [...(post.replies || []), newReplyI],
          updatedAt: new Date().toISOString(),
        });
      }

      setReplyContent("");
      setError(null);
    } catch (err) {
      console.error("Error posting reply:", err);
      setError("Failed to submit reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post || post.author.email !== user?.email) {
      return;
    }

    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await forumRemovePost({
          path: { id: post.id.toString() },
        });
        navigate("/forum");
      } catch (err) {
        console.error("Error deleting post:", err);
        setError("Failed to delete post");
      }
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!post) {
      return;
    }

    if (window.confirm("Are you sure you want to delete this reply?")) {
      try {
        await forumRemoveReply({
          path: { id: replyId.toString() },
        });

        // Update post with reply removed
        setPost({
          ...post,
          replies: (post.replies || []).filter((reply) => reply.id !== replyId),
        });
      } catch (err) {
        console.error("Error deleting reply:", err);
        setError("Failed to delete reply");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-10">
          <div className="loader">Loading...</div>
        </div>
      </div>
    );
  }

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

  console.log(post.replies);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/forum" className="text-blue-600 hover:underline">
          &larr; Back
        </Link>
      </div>

      {/* Post */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          {post.author.email === user?.email && (
            <div className="space-x-2">
              <Link
                to={`/forum/edit/${post.id}`}
                className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Edit
              </Link>
              <button
                onClick={handleDeletePost}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500">
          <span>
            By{" "}
            <a href={`/user/${post.author.id}`} className="font-semibold">
              {post.author.name}
            </a>
          </span>
          <span className="ml-4">
            {formatDistanceToNow(new Date(post.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        {post.action && (
          <div className="mb-4">
            <Link
              to={`/action/${post.action.id}`}
              className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-sm"
            >
              yeah eyah
            </Link>
          </div>
        )}

        <div className="my-8 whitespace-pre-wrap text-lg">{post.content}</div>
      </div>

      {post.replies.length > 0 ? (
        <>
          <h2 className="text-xl font-semibold mb-4">Replies</h2>
          <div className="space-y-4 mb-8">
            {post.replies.map((reply) => (
              <Card key={reply.id} className="border-l-4 border-gray-300">
                <div className="p-4">
                  <div className="mb-4 whitespace-pre-wrap">
                    {reply.content}
                  </div>

                  <div className="flex justify-between text-sm text-gray-500">
                    <div>
                      Reply by {reply.author?.name || "Unknown user"}
                      <span className="ml-2">
                        {formatDistanceToNow(new Date(reply.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {user && reply.author.email === user.email && (
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {user ? (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium mb-4">Post a Reply</h3>
          <form onSubmit={handleSubmitReply}>
            <textarea
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply here..."
              required
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !replyContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isSubmitting ? "Posting..." : "Post Reply"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            Please{" "}
            <Link to="/login" className="text-blue-600 hover:underline">
              log in
            </Link>{" "}
            to post a reply.
          </p>
        </div>
      )}
    </div>
  );
};

export default PostDetailPage;

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PostDto } from "../../../../shared/client";
import { useAuth } from "../lib/AuthContext";
import { formatDistanceToNow } from "date-fns";
import Card from "./system/Card";
import Button from "./system/Button";
import { forumFindPostsByAction } from "../../../../shared/client";

interface ActionForumPostsProps {
  actionId: string;
}

const ActionForumPosts: React.FC<ActionForumPostsProps> = ({
  actionId,
}: ActionForumPostsProps) => {
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchActionPosts = async () => {
      if (!actionId) return;

      try {
        setIsLoading(true);
        const response = await forumFindPostsByAction({
          path: { actionId },
        });
        setPosts(response.data ?? []);
        setError(null);
      } catch (err) {
        console.error("Error fetching action forum posts:", err);
        setError("Failed to load discussion posts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchActionPosts();
  }, [actionId]);

  const handleCreatePost = () => {
    navigate(`/forum/new?actionId=${actionId}`);
  };

  const handleViewPost = (postId: number) => {
    navigate(`/forum/post/${postId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-sm py-2">{error}</div>;
  }

  return (
    <div className="space-y-4 my-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-xl">Discussion</h2>
        <div>
          {isAuthenticated && (
            <Button
              label="Start Discussion"
              onClick={handleCreatePost}
              className="text-sm"
            />
          )}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-5 text-gray-500">
          <p>No discussions yet for this action.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.slice(0, 3).map((post) => (
            <Card
              key={post.id}
              className="cursor-pointer transition"
              onClick={() => handleViewPost(post.id)}
            >
              <div className="p-3">
                <h3 className="font-medium">{post.title}</h3>
                <div className="text-gray-600 text-sm line-clamp-2 mt-1">
                  {post.content}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>By {post.author?.name || "Unknown user"}</span>
                  <div className="flex space-x-3">
                    <span>{post.replies?.length || 0} replies</span>
                    <span>
                      {formatDistanceToNow(new Date(post.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {posts.length > 3 && (
            <div className="text-center pt-2">
              <Link
                to={`/forum?actionId=${actionId}`}
                className="text-blue-600 hover:underline text-sm"
              >
                View all {posts.length} discussions
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionForumPosts;

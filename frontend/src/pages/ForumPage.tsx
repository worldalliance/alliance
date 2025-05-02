import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Post } from "../client/types.gen";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import Card from "../components/system/Card";
import { forumFindAllPosts } from "../client";
import Button, { ButtonColor } from "../components/system/Button";

const ForumPage: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const response = await forumFindAllPosts();
        setPosts(response.data ?? []);
        setError(null);
      } catch (err) {
        console.error("Error fetching forum posts:", err);
        setError("Failed to load forum posts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const handleCreatePost = () => {
    navigate("/forum/new");
  };

  const handleViewPost = (postId: number) => {
    navigate(`/forum/post/${postId}`);
  };

  return (
    <div className="bg-stone-50 h-[calc(100vh-50px)]">
      <div className="container mx-auto px-4 py-8 ">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold">Alliance Forum</h1>
          {isAuthenticated && (
            <Button
              onClick={handleCreatePost}
              color={ButtonColor.Stone}
              label="Create Post"
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="loader">Loading...</div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>No forum posts yet. Be the first to start a discussion!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="cursor-pointer transition"
                onClick={() => handleViewPost(post.id)}
              >
                <div className="p-4">
                  <h2 className="text-xl font-medium mb-2">{post.title}</h2>
                  <div className="text-gray-600 mb-4 line-clamp-3">
                    {post.content}
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <div>
                      Posted by {post.author?.name || "Unknown user"}
                      {post.action?.name && (
                        <span>
                          {" "}
                          in{" "}
                          <span className="text-blue-600">
                            {post.action.name}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-4">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ForumPage;

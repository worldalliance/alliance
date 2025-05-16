import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PostDto } from "../../../../../shared/client";
import { useAuth } from "../../lib/AuthContext";
import { forumFindAllPosts } from "../../../../../shared/client";
import Button, { ButtonColor } from "../../components/system/Button";
import ForumListPost from "../../components/ForumListPost";

const ForumPage: React.FC = () => {
  const [posts, setPosts] = useState<PostDto[]>([]);
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
    <div className="flex flex-col min-h-screen bg-pagebg items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))] gap-y-3">
        <div className="flex py-4 flex-row justify-between items-center w-full">
          <h1 className="font-sabon text-xl text-left h-fit">Alliance Forum</h1>
          {isAuthenticated && (
            <Button
              onClick={handleCreatePost}
              color={ButtonColor.Blue}
              label="Create Post"
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="loader">Loading...</div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            <p>No forum posts yet. Be the first to start a discussion!</p>
          </div>
        ) : (
          <div className="w-full space-y-2">
            {posts.map((post) => (
              <ForumListPost
                key={post.id}
                post={post}
                handleViewPost={handleViewPost}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForumPage;

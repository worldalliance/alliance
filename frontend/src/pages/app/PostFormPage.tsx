import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CreatePostDto, ActionDto, PostDto } from "../../client/types.gen";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/system/Card";
import {
  actionsFindAll,
  forumCreatePost,
  forumFindOnePost,
  forumUpdatePost,
} from "../../client";

type FormMode = "create" | "edit";

const PostFormPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const mode: FormMode = postId ? "edit" : "create";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [actionId, setActionId] = useState<number | undefined>(undefined);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if not authenticated
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch available actions for the dropdown
        const actionsResponse = await actionsFindAll();
        setActions(actionsResponse.data ?? []);

        if (mode === "edit" && postId) {
          setIsLoading(true);
          const postResponse = await forumFindOnePost({
            path: { id: postId },
          });
          if (postResponse.data) {
            setTitle(postResponse.data.title);
            setContent(postResponse.data.content);
            setActionId(postResponse.data.actionId);
          } else {
            setError("Post not found");
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load required data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, mode, postId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      return;
    }

    try {
      setIsSubmitting(true);
      const postData: CreatePostDto = {
        title,
        content,
        actionId: actionId || undefined,
      };

      let response: { data: PostDto | undefined };

      if (mode === "create") {
        response = await forumCreatePost({
          body: postData,
        });
      } else {
        if (!postId) {
          setError("An error occurred while updating the post");
          console.error("no post id");
          return;
        }
        response = await forumUpdatePost({
          path: { id: postId },
          body: postData,
        });
      }

      if (response.data) {
        navigate(`/forum/post/${response.data.id}`);
      } else {
        setError("An error occurred while updating the post");
        console.error("no post id");
        return;
      }
    } catch (err) {
      console.error("Error saving post:", err);
      setError("Failed to save post");
      setIsSubmitting(false);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/forum" className="text-blue-600 hover:underline">
          &larr; Back to Forum
        </Link>
      </div>

      <Card>
        <div className="p-6">
          <h1 className="text-2xl font-semibold mb-6">
            {mode === "create" ? "Create New Post" : "Edit Post"}
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="title"
                className="block text-gray-700 font-medium mb-2"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter post title"
                required
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="content"
                className="block text-gray-700 font-medium mb-2"
              >
                Content
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your post content here..."
                rows={10}
                required
              />
            </div>

            <div className="mb-6">
              <label
                htmlFor="actionId"
                className="block text-gray-700 font-medium mb-2"
              >
                Associated Action (Optional)
              </label>
              <select
                id="actionId"
                value={actionId || ""}
                onChange={(e) =>
                  setActionId(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {actions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Associating your post with an action will make it visible on
                that action's page.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <Link
                to="/forum"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isSubmitting
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Post"
                    : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default PostFormPage;

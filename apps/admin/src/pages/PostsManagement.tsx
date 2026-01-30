import React, { useEffect, useState } from "react";
import { href, useParams, useNavigate } from "react-router";
import {
  forumGetPostsForAdmin,
  forumUpdatePostAuthors,
  forumUpdatePostExperts,
  userList,
} from "@alliance/shared/client";
import type { PostDto } from "@alliance/shared/client/types.gen";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";

const PostsManagementPage: React.FC = () => {
  const { postId } = useParams();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<PostDto[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserSelectUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [expertSelection, setExpertSelection] = useState<number[]>([]);
  const [authorSelection, setAuthorSelection] = useState<number[]>([]);
  const [qaMode, setQaMode] = useState(false);
  const [expertLabel, setExpertLabel] = useState("");
  const { success, error: pushError } = useToast();

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const response = await forumGetPostsForAdmin();
        setPosts(response.data ?? []);
      } catch (err) {
        console.error("Failed to load posts", err);
        pushError("Failed to load posts");
      } finally {
        setLoading(false);
      }
    };
    void loadPosts();
  }, [pushError]);

  useEffect(() => {
    if (postId && posts.length > 0) {
      const match = posts.find((p) => p.id === Number(postId));
      if (match && selectedPost?.id !== match.id) {
        setSelectedPost(match);
        setExpertSelection(match.expertIds ?? []);
        setAuthorSelection(match.authorIds ?? []);
        setQaMode(match.qaMode ?? false);
        setExpertLabel(match.expertLabel ?? "");
      }
    }
  }, [postId, posts, selectedPost?.id]);

  useEffect(() => {
    setUsersLoading(true);
    userList()
      .then((response) => {
        const rawUsers = response.data ?? [];
        setUsers(
          rawUsers.map((user) => ({
            id: user.id,
            name: user.name ?? `User #${user.id}`,
            profilePicture: user.profilePicture ?? null,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to load users", err);
      })
      .finally(() => setUsersLoading(false));
  }, []);

  const handleSelectPost = (post: PostDto) => {
    setSelectedPost(post);
    setExpertSelection(post.expertIds ?? []);
    setAuthorSelection(post.authorIds ?? []);
    setQaMode(post.qaMode ?? false);
    setExpertLabel(post.expertLabel ?? "");
    navigate(href(`/posts/:postId?`, { postId: post.id.toString() }));
  };

  const handleSave = async () => {
    if (!selectedPost) return;
    setSaving(true);
    try {
      const [expertsResponse, authorsResponse] = await Promise.all([
        forumUpdatePostExperts({
          path: { id: selectedPost.id },
          body: {
            expertIds: expertSelection,
            qaMode,
            expertLabel: expertLabel || undefined,
          },
        }),
        forumUpdatePostAuthors({
          path: { id: selectedPost.id },
          body: {
            authorIds: authorSelection,
          },
        }),
      ]);
      const updatedPost = authorsResponse.data ?? expertsResponse.data;
      if (updatedPost) {
        setSelectedPost(updatedPost);
        setPosts((prev) =>
          prev.map((p) => (p.id === updatedPost!.id ? updatedPost! : p))
        );
        success("Post updated", "Settings saved successfully");
      }
    } catch (err) {
      console.error("Failed to save", err);
      pushError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="p-6 pt-20 flex flex-col gap-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold">Posts Management</h1>
          <p className="text-sm text-zinc-500">
            Configure authors, Q&A mode, and assign experts to forum posts
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card style={CardStyle.White}>
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold text-lg">Posts</h2>
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                {posts.length ? (
                  posts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => handleSelectPost(post)}
                      className={`text-left border rounded px-3 py-2 ${selectedPost?.id === post.id
                        ? "border-blue bg-blue/10"
                        : "border-zinc-200 hover:bg-zinc-50"
                        }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">
                          {post.title}
                        </span>
                        <span className="text-xs text-zinc-500">
                          by {post.author.displayName}
                        </span>
                        {post.qaMode && (
                          <span className="text-xs text-orange-600 font-medium">
                            Q&A Mode Active
                          </span>
                        )}
                        {(post.authorIds?.length ?? 0) > 1 && (
                          <span className="text-xs text-green">
                            {post.authorIds?.length} authors
                          </span>
                        )}
                        {(post.expertIds?.length ?? 0) > 0 && (
                          <span className="text-xs text-blue">
                            {post.expertIds?.length} expert(s) assigned
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No posts found.</p>
                )}
              </div>
            </div>
          </Card>

          <Card style={CardStyle.White}>
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold text-lg">Post Settings</h2>
              {selectedPost ? (
                <>
                  <div className="border-b pb-4">
                    <h3 className="font-medium">{selectedPost.title}</h3>
                    <p className="text-sm text-zinc-500">
                      by {selectedPost.author.displayName}
                    </p>
                  </div>

                  <UserSelect
                    users={users}
                    selectedUserIds={authorSelection}
                    onChange={setAuthorSelection}
                    loading={usersLoading}
                    label="Authors"
                  />
                  <p className="text-xs text-zinc-500 -mt-2">
                    All listed authors will be notified of new comments on this
                    post.
                  </p>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qaMode}
                        onChange={(e) => setQaMode(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300"
                      />
                      <span className="text-sm font-medium">
                        Enable Q&A Mode
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500">
                    When enabled, designated experts will have a special badge
                    on their replies and users can filter comments by
                    answered/unanswered.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Expert Badge Label
                    </label>
                    <input
                      type="text"
                      value={expertLabel}
                      onChange={(e) => setExpertLabel(e.target.value)}
                      placeholder="Expert"
                      className="w-full border border-zinc-300 rounded px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Custom badge label (e.g., &quot;AMA Guest&quot;,
                      &quot;Specialist&quot;). Leave empty for default
                      &quot;Expert&quot;.
                    </p>
                  </div>

                  <UserSelect
                    users={users}
                    selectedUserIds={expertSelection}
                    onChange={setExpertSelection}
                    loading={usersLoading}
                    label="Designated Experts"
                  />

                  <Button
                    type="button"
                    color={ButtonColor.Blue}
                    onClick={handleSave}
                    disabled={saving}
                    className="self-start"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-zinc-500">
                  Select a post from the list to configure settings.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PostsManagementPage;

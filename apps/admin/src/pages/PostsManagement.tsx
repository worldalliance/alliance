import { errorMessage } from "@alliance/common/errorMessage";
import {
  forumGetPostsForAdmin,
  forumUpdatePostAuthorsAdmin,
  forumUpdatePostExpertsAdmin,
  forumUpdatePostTagsAdmin,
  userListAdmin,
} from "@alliance/shared/client";
import type { PostDto } from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { href, useNavigate, useParams } from "react-router";

type TagDraft = { id?: number; name: string };

const toTagDrafts = (post: PostDto): TagDraft[] =>
  (post.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name }));

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
  const [notifyForReplies, setNotifyForReplies] = useState(false);
  const [showClusterTags, setShowClusterTags] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<TagDraft[]>([]);
  const { success, error: pushError, confirm } = useToast();

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
        setNotifyForReplies(match.notifyForReplies ?? false);
        setShowClusterTags(match.showClusterTags ?? false);
        setTagDrafts(toTagDrafts(match));
      }
    }
  }, [postId, posts, selectedPost?.id]);

  useEffect(() => {
    setUsersLoading(true);
    userListAdmin()
      .then((response) => {
        const rawUsers = response.data ?? [];
        setUsers(
          rawUsers.map((user) => ({
            id: user.id,
            name: user.name ?? `User #${user.id}`,
            profilePicture: user.profilePicture ?? null,
          })),
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
    setNotifyForReplies(post.notifyForReplies ?? false);
    setShowClusterTags(post.showClusterTags ?? false);
    setTagDrafts(toTagDrafts(post));
    navigate(href(`/posts/:postId?`, { postId: post.id.toString() }));
  };

  const handleSave = async () => {
    if (!selectedPost) return;
    const tags = tagDrafts
      .map((tag) => ({ ...tag, name: tag.name.trim() }))
      .filter((tag) => tag.name.length > 0);
    if (new Set(tags.map((tag) => tag.name)).size !== tags.length) {
      pushError("Tag names must be unique within a post");
      return;
    }
    const savedTags = toTagDrafts(selectedPost);
    const tagsChanged =
      tags.length !== savedTags.length ||
      tags.some(
        (tag, i) =>
          tag.id !== savedTags[i].id || tag.name !== savedTags[i].name,
      );
    const deletedTags = savedTags.filter(
      (saved) => !tags.some((tag) => tag.id === saved.id),
    );
    if (deletedTags.length > 0) {
      const names = deletedTags.map((tag) => `"${tag.name}"`).join(", ");
      const confirmed = await confirm({
        title: `Delete ${names}?`,
        message: `Comments filed under ${
          deletedTags.length > 1 ? "those tags" : "that tag"
        } lose their label. This cannot be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Keep",
        mode: "fullscreen",
      });
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const expertsResponse = await forumUpdatePostExpertsAdmin({
        path: { id: selectedPost.id },
        body: {
          expertIds: expertSelection,
          qaMode,
          expertLabel: expertLabel || null,
          notifyForReplies,
          showClusterTags,
        },
      });
      const authorsResponse = await forumUpdatePostAuthorsAdmin({
        path: { id: selectedPost.id },
        body: {
          authorIds: authorSelection,
        },
      });
      const tagsResponse = tagsChanged
        ? await forumUpdatePostTagsAdmin({
            path: { id: selectedPost.id },
            body: {
              tags,
              knownTagIds: (selectedPost.tags ?? []).map((tag) => tag.id),
            },
          })
        : undefined;
      const updatedPost =
        tagsResponse?.data ?? authorsResponse.data ?? expertsResponse.data;
      if (updatedPost) {
        setSelectedPost(updatedPost);
        setPosts((prev) =>
          prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
        );
      }
      const failure =
        expertsResponse.error ?? authorsResponse.error ?? tagsResponse?.error;
      if (failure) {
        console.error("Failed to save", failure);
        pushError(
          errorMessage({ error: failure, fallback: "Failed to save settings" }),
        );
        return;
      }
      if (updatedPost) setTagDrafts(toTagDrafts(updatedPost));
      success("Post updated", "Settings saved successfully");
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
      <div className="p-6 pt-10 flex flex-col gap-6 max-w-5xl">
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
              <div className="flex flex-col gap-2  overflow-y-auto">
                {posts.length ? (
                  posts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => handleSelectPost(post)}
                      className={cn(
                        "text-left border rounded px-3 py-2",
                        selectedPost?.id === post.id
                          ? "border-blue bg-blue/10"
                          : "border-zinc-200 hover:bg-zinc-50",
                      )}
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
                        {post.notifyForReplies && (
                          <span className="text-xs text-purple-600 font-medium">
                            Reply Notifications On
                          </span>
                        )}
                        {post.showClusterTags && (
                          <span className="text-xs text-teal-600 font-medium">
                            Cluster Tags On
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

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyForReplies}
                        onChange={(e) => setNotifyForReplies(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300"
                      />
                      <span className="text-sm font-medium">
                        Notify for Replies
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500">
                    When enabled, commenters will receive text/email
                    notifications when someone replies to their comment.
                  </p>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showClusterTags}
                        onChange={(e) => setShowClusterTags(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300"
                      />
                      <span className="text-sm font-medium">
                        Show Cluster Tags
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500">
                    When enabled, each author&apos;s cluster name appears as a
                    tag next to their name on this post. Tags are green when the
                    viewer shares the author&apos;s cluster, grey otherwise.
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

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Comment Tags
                    </label>
                    <div className="flex flex-col gap-2">
                      {tagDrafts.map((tag, index) => (
                        <div
                          key={tag.id ?? `new-${index}`}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={tag.name}
                            onChange={(e) =>
                              setTagDrafts((prev) =>
                                prev.map((draft, i) =>
                                  i === index
                                    ? { ...draft, name: e.target.value }
                                    : draft,
                                ),
                              )
                            }
                            placeholder="Tag name"
                            className="flex-1 border border-zinc-300 rounded px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setTagDrafts((prev) =>
                                prev.filter((_, i) => i !== index),
                              )
                            }
                            aria-label={`Remove tag ${tag.name || index + 1}`}
                            title="Remove tag"
                            className="p-2 text-zinc-500 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setTagDrafts((prev) => [...prev, { name: "" }])
                        }
                        className="flex items-center gap-1 text-sm text-blue self-start cursor-pointer"
                      >
                        <Plus size={16} />
                        Add tag
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Commenters pick exactly one of these when they start a new
                      thread on this post, and readers can filter by them.
                      Deleting a tag on save clears it from the comments that
                      used it.
                    </p>
                  </div>

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

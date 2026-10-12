import {
  CreateEditableContentDto,
  CreatePostDto,
  imagesUploadImage,
} from "@alliance/shared/client";
import { useForumPost } from "@alliance/shared/lib/useForumPost";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import EditableContentForm, {
  clearDraft,
  useDraftStorageKey,
} from "@alliance/sharedweb/ui/EditableContentForm";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import React, { useState } from "react";
import {
  Link,
  href,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useAuth } from "../../lib/AuthContext";

type FormMode = "create" | "edit";

const PostFormPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const mode: FormMode = postId === "new" ? "create" : "edit";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });
  const [scheduledVisibleAt, setScheduledVisibleAt] = useState<string | null>(
    null,
  );
  const [useSchedulePost, setUseSchedulePost] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | undefined>(
    searchParams.get("actionId")
      ? Number(searchParams.get("actionId"))
      : undefined,
  );
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const canSchedulePost = mode === "create" || scheduledVisibleAt !== null;
  const storageKey = useDraftStorageKey(`post-${postId}`);
  const [clearDraftSignal, setClearDraftSignal] = useState(0);

  const {
    post,
    isFetchedAfterMount,
    error: loadError,
    create,
    update,
  } = useForumPost(mode === "edit" ? postId : undefined, {
    refetchOnMount: "always",
  });
  const [filledPostId, setFilledPostId] = useState<number | null>(null);

  // A copy cached by an earlier visit may be stale, and saving a form filled
  // from it would write those stale details back.
  if (post && isFetchedAfterMount && !loadError && filledPostId !== post.id) {
    setFilledPostId(post.id);
    setTitle(post.title);
    setContent(post.editableContent);
    setActionId(post.actionId ?? undefined);
    if (!!post.visibleAt && new Date(post.visibleAt) > new Date()) {
      setScheduledVisibleAt(post.visibleAt);
      setUseSchedulePost(true);
    } else {
      setUseSchedulePost(false);
      setScheduledVisibleAt(null);
    }
  }

  const awaitingPost = mode === "edit" && filledPostId !== post?.id;
  const loadErrorMessage =
    awaitingPost && isFetchedAfterMount
      ? loadError
        ? "Failed to load required data"
        : "Post not found"
      : null;
  const shownError = error ?? loadErrorMessage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      return;
    }

    if (
      useSchedulePost &&
      scheduledVisibleAt &&
      new Date(scheduledVisibleAt) < new Date()
    ) {
      setError("Cannot schedule posts in the past");
      return;
    }

    try {
      setIsSubmitting(true);
      // Upload any new image attachments to get keys
      let attachmentKeys: string[] = [];
      if (content.attachments.length > 0) {
        const uploads = await Promise.all(
          content.attachments.map(async (fileB64) => {
            if (fileB64.startsWith("data:")) {
              const res = await imagesUploadImage({ body: { file: fileB64 } });
              return res.data?.key;
            }
            return fileB64;
          }),
        );
        attachmentKeys = uploads.filter(Boolean) as string[];
      }

      const nowIso = new Date().toISOString();
      let visibleAt = nowIso;
      if (useSchedulePost) {
        if (!scheduledVisibleAt) {
          setError("Please select a valid date and time to schedule the post.");
          setIsSubmitting(false);
          return;
        }
        visibleAt = scheduledVisibleAt;
      }

      const postData: CreatePostDto = {
        title,
        actionId: actionId,
        editableContent: { body: content.body, attachments: attachmentKeys },
        visibleAt,
      };

      const saved =
        mode === "create" ? await create(postData) : await update(postData);

      // Leaving the page unmounts this form while the post is in flight, and
      // the signal below dies with it.
      clearDraft(storageKey);
      setClearDraftSignal((x) => x + 1);
      navigate(href("/forum/post/:id", { id: saved.id.toString() }));
    } catch (err) {
      console.error("Error saving post:", err);
      setError("Failed to save post");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (awaitingPost && !isFetchedAfterMount) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-10">
          <div className="loader">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 mt-4">
      <div className="mb-6">
        <Link to={href("/forum")} className="text-blue hover:underline">
          &larr; Back to Forum
        </Link>
      </div>

      <Card>
        <div className="p-2">
          <h1 className="text-xl! font-semibold mb-6">
            {mode === "create" ? "New Thread" : "Edit Thread"}
          </h1>

          {shownError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {shownError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="title"
                className="block text-zinc-700 font-medium mb-2"
              >
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                placeholder="Enter title"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-zinc-700 font-medium mb-2">
                Content
              </label>
              <div className="rounded-lg p-4 bg-zinc-100">
                <EditableContentForm
                  value={content}
                  onChange={setContent}
                  disabled={isSubmitting}
                  clearDraftSignal={clearDraftSignal}
                  expanded={true}
                  placeholder="Write your post content here..."
                  storageKey={storageKey}
                />
                <div className="mt-3 flex justify-end text-sm text-zinc-500">
                  Drag an image to attach
                </div>
              </div>
            </div>

            <div className="flex justify-between space-x-3 items-center">
              <div>
                {canSchedulePost && (
                  <div className="flex space-x-3 items-center">
                    <LargeCheckbox
                      label="Schedule post for later"
                      checked={useSchedulePost}
                      disabled={isSubmitting}
                      onChange={() => {
                        setUseSchedulePost(!useSchedulePost);
                        if (!useSchedulePost && !scheduledVisibleAt) {
                          setScheduledVisibleAt(new Date().toISOString());
                        }
                        if (error) {
                          setError(null);
                        }
                      }}
                    />
                    {useSchedulePost && (
                      <div className="flex space-x-3">
                        <DateTimePicker
                          id="schedulePostDate"
                          value={scheduledVisibleAt}
                          disabled={isSubmitting}
                          onChange={({ utcValue }) => {
                            setScheduledVisibleAt(utcValue);
                            if (!utcValue) {
                              setError(
                                "Please select a valid date and time to schedule the post.",
                              );
                              return;
                            }
                            if (error) {
                              setError(null);
                            }
                          }}
                          inputClassName="-my-3 disabled:opacity-50"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => navigate(href("/forum"))}
                  color={ButtonColor.Light}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color={ButtonColor.Black}
                  disabled={
                    isSubmitting || !title.trim() || !content.body.trim()
                  }
                >
                  {isSubmitting
                    ? "Saving..."
                    : mode === "create"
                      ? "Create Post"
                      : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default PostFormPage;

import type { PostDto } from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import { Download, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { usePostsAdmin } from "../../lib/usePostsAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";
import {
  CheckboxField,
  Field,
  FieldGroup,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import UserSelect from "../../ui/UserSelect";
import {
  deleteTagsQuestion,
  postSaveOf,
  settingsOf,
  type PostSettings,
} from "./postRules";
import { useDownloadPost } from "./useDownloadPost";

/** Keyed by the post's id, so another post starts clean. */
export function PostSettingsForm({ post }: { post: PostDto }) {
  const { updateSettings } = usePostsAdmin();
  const users = useUsersAdmin();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const exported = useDownloadPost(post.id);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const [basis, setBasis] = useState(post);
  const seeded = settingsOf(basis);
  const [values, setValues] = useState(seeded);
  const [tagError, setTagError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const dirty = !isEqual(values, seeded);
  useLeaveGuard(dirty);

  // A refetch reseeds the form only while it is untouched; a dirty form saves
  // against the post it was seeded from, so the server can refuse stale tags.
  if (!dirty && !isEqual(settingsOf(post), seeded)) {
    setBasis(post);
    setValues(settingsOf(post));
  }

  const change = (patch: Partial<PostSettings>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    setTagError(null);
    setOutcome(null);
  };
  const setTag = (index: number, name: string) =>
    change({
      tags: values.tags.map((tag, i) => (i === index ? { ...tag, name } : tag)),
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const save = postSaveOf(basis, values);
    if (!save.ok) {
      setTagError(save.error);
      focusFirstInvalid();
      return;
    }
    if (
      save.value.deletedTags.length > 0 &&
      !(await confirm(deleteTagsQuestion(save.value.deletedTags)))
    ) {
      return;
    }
    setOutcome(null);
    updateSettings.mutate(
      { id: post.id, body: save.value.body },
      {
        onSuccess: (updated) => {
          setBasis(updated);
          setValues(settingsOf(updated));
          setOutcome({ saved: true });
          success("Post settings saved", updated.title);
        },
        onError: (error) =>
          setOutcome({
            saved: false,
            reason: adminRefusalMessage(error, SAVE_FAILED_FALLBACK),
          }),
      },
    );
  };

  const state = updateSettings.isPending
    ? SaveState.Saving
    : outcome?.saved === false
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : outcome?.saved
          ? SaveState.Saved
          : SaveState.Clean;
  const qaOff = values.qaMode ? undefined : "Turn on Q&A mode to use this.";

  return (
    <form
      ref={formRef}
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex min-h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-6 p-card">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="small"
            variant={ButtonVariant.Default}
            busy={exported.downloading}
            onClick={() => void exported.download()}
            title="The post, its comments and their attachments, as a single web page"
          >
            <Download aria-hidden="true" className="size-4" />
            Download as .html
          </Button>
          <InlineError message={exported.error} />
        </div>

        <Field
          label="Authors"
          help="Every listed author is notified of new comments on this post."
        >
          {(control) => (
            <UserSelect
              {...control}
              label={null}
              users={users.data ?? []}
              selectedUserIds={values.authorIds}
              onChange={(authorIds) => change({ authorIds })}
              loading={users.isLoading}
              loadFailed={users.isLoadingError}
            />
          )}
        </Field>

        <div className="flex flex-col gap-4">
          <CheckboxField
            label="Q&A mode"
            help="Designated experts get a badge on their replies, and readers can filter comments by answered and unanswered."
            checked={values.qaMode}
            onChange={(event) => change({ qaMode: event.target.checked })}
          />
          <div className="flex flex-col gap-4 border-l border-line pl-6">
            <Field
              label="Expert badge label"
              help={
                qaOff ??
                "Such as “AMA guest” or “Specialist”. Empty shows “Expert”."
              }
            >
              {(control) => (
                <Input
                  {...control}
                  maxLength={64}
                  value={values.expertLabel}
                  disabled={!values.qaMode}
                  placeholder="Expert"
                  onChange={(event) =>
                    change({ expertLabel: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label="Designated experts" help={qaOff}>
              {(control) => (
                <UserSelect
                  {...control}
                  label={null}
                  users={users.data ?? []}
                  selectedUserIds={values.expertIds}
                  onChange={(expertIds) => change({ expertIds })}
                  loading={users.isLoading}
                  loadFailed={users.isLoadingError}
                  disabled={!values.qaMode}
                  hint="Picked experts appear here."
                />
              )}
            </Field>
          </div>
        </div>

        <CheckboxField
          label="Notify for replies"
          help="When someone replies to a comment on this post, the comment's author also gets a text or email, by their notification settings."
          checked={values.notifyForReplies}
          onChange={(event) =>
            change({ notifyForReplies: event.target.checked })
          }
        />
        <CheckboxField
          label="Show cluster tags"
          help="Each commenter's cluster name appears as a tag next to their name in this post's comments: green when the reader shares the cluster, grey otherwise. Members also see these comments in their home feed when they share the commenter's cluster."
          checked={values.showClusterTags}
          onChange={(event) =>
            change({ showClusterTags: event.target.checked })
          }
        />

        <FieldGroup
          label="Comment tags"
          help="Commenters pick one of these when they start a thread on this post, and readers can filter by them. Deleting a tag clears it from the comments that used it."
          error={tagError}
        >
          {values.tags.map((tag, index) => (
            <div key={tag.id ?? `new-${index}`} className="flex gap-2">
              <Input
                aria-label={`Tag ${index + 1}`}
                aria-invalid={tagError ? true : undefined}
                value={tag.name}
                placeholder="Tag name"
                onChange={(event) => setTag(index, event.target.value)}
              />
              <Button
                variant={ButtonVariant.Ghost}
                aria-label={`Remove tag: ${tag.name || index + 1}`}
                title="Remove tag"
                onClick={() =>
                  change({ tags: values.tags.filter((_, i) => i !== index) })
                }
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            size="small"
            variant={ButtonVariant.Default}
            onClick={() => change({ tags: [...values.tags, { name: "" }] })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add tag
          </Button>
        </FieldGroup>
      </div>
      <div className="sticky bottom-0">
        <SaveBar
          state={state}
          error={outcome?.saved === false ? outcome.reason : null}
          onDiscard={() => {
            setValues(seeded);
            setTagError(null);
            setOutcome(null);
          }}
        />
      </div>
    </form>
  );
}

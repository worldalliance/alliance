import { R } from "@alliance/common/result";
import type {
  ActionEventDto,
  ActionUpdateNotifyType,
  CreateActionUpdateDto,
  TagDto,
} from "@alliance/shared/client";
import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { useActionUpdateAdmin } from "../../../lib/useActionUpdateAdmin";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { linkClass } from "../../../ui/styles";
import {
  Field,
  FormSection,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../../ui/templates/Form";
import { CollectiveResultFields } from "./CollectiveResultFields";
import { UPDATE_PREVIEW_DESCRIPTION, UpdatePreview } from "./UpdatePreview";
import {
  missingForCreate,
  NOTIFY_TYPE_LABELS,
  NOTIFY_TYPES,
  pacific,
  UPDATE_COPY_GUIDELINES_URL,
} from "./updateRules";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

const isNotifyType = (value: string): value is ActionUpdateNotifyType =>
  NOTIFY_TYPES.some((type) => type === value);

const blankUpdate = (): CreateActionUpdateDto => ({
  title: "",
  date: new Date().toISOString(),
  notifyType: "none",
  shortNotifString: "",
});

/**
 * Creating writes an empty, unpublished update and sends nothing
 * (`server/src/actions/action-updates.service.ts`, `createActionUpdate`):
 * writing it and sending it are the next two steps, on the update's page.
 */
export function NewUpdateForm({
  actionId,
  events,
  tags,
  formId,
}: {
  actionId: number;
  events: ActionEventDto[];
  tags: TagDto[];
  formId: string;
}) {
  const navigate = useNavigate();
  const { create } = useActionUpdateAdmin(null);
  const [draft, setDraft] = useState(blankUpdate);
  const [submitted, setSubmitted] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const missing = missingForCreate(draft);
  const shown = refusal ?? (submitted ? missing : null);
  const invalid = (bad: boolean) => (submitted && bad ? true : undefined);
  const edit = (next: Partial<CreateActionUpdateDto>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setRefusal(null);
  };
  const texts = {
    shortNotifString: draft.shortNotifString ?? "",
    nonCompleterResult: draft.nonCompleterResult ?? "",
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    setSubmitted(true);
    setRefusal(null);
    if (missing) {
      focusFirstInvalid();
      return;
    }
    const created = await R.fromPromise(
      create.mutateAsync({ actionId, body: draft }),
      (thrown) => adminRefusalMessage(thrown, SAVE_FAILED_FALLBACK),
    );
    if (!created.ok) {
      setRefusal(created.error);
      return;
    }
    void navigate(`/tasks/${actionId}/updates/${created.value.id}`);
  };

  return (
    <form
      id={formId}
      ref={formRef}
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <FormSection
        title="New project update"
        description={
          <>
            Read the{" "}
            <a
              href={UPDATE_COPY_GUIDELINES_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              update copy guidelines
            </a>{" "}
            first. You write the update&apos;s content after creating it.
          </>
        }
        footer={
          <SaveBar
            state={
              create.isPending
                ? SaveState.Saving
                : shown
                  ? SaveState.Failed
                  : SaveState.Clean
            }
            error={shown}
            stateText={{ saving: "Creating…", failed: "Couldn't create" }}
            note="Creates a draft members can't see, and sends nothing. You write its content next, and send the notification from there."
            saveLabel="Create and write content"
          />
        }
      >
        <Field
          label="Title"
          help="A short heading members see above the update."
        >
          {(control) => (
            <Input
              {...control}
              aria-invalid={invalid(!draft.title.trim())}
              value={draft.title}
              onChange={(event) => edit({ title: event.target.value })}
            />
          )}
        </Field>
        <CollectiveResultFields
          texts={texts}
          onChange={(next) =>
            edit({
              shortNotifString: next.shortNotifString,
              nonCompleterResult: next.nonCompleterResult || null,
            })
          }
        />
        <Field
          label="Notification audience"
          help="Who the notification will go to. Nothing is sent until you send it from the update's page."
        >
          {(control) => (
            <Select
              {...control}
              value={draft.notifyType}
              onChange={(event) => {
                const notifyType = event.target.value;
                if (!isNotifyType(notifyType)) return;
                edit({
                  notifyType,
                  tagId: notifyType === "tag" ? draft.tagId : undefined,
                });
              }}
            >
              {NOTIFY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {NOTIFY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Tag to notify"
          help={
            draft.notifyType === "tag"
              ? "Only members with this tag are notified."
              : `Used when the audience is "${NOTIFY_TYPE_LABELS.tag}".`
          }
        >
          {(control) => (
            <Select
              {...control}
              aria-invalid={invalid(draft.notifyType === "tag" && !draft.tagId)}
              disabled={draft.notifyType !== "tag"}
              value={draft.notifyType === "tag" ? (draft.tagId ?? "") : ""}
              onChange={(event) =>
                edit({ tagId: event.target.value || undefined })
              }
            >
              <option value="">Select a tag</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={`Date (${ZONE})`}
          help="The date shown on the update. Members see it from this date, or from the first save of its content if that is later."
        >
          {(control) => (
            <DateTimePicker
              {...control}
              aria-invalid={invalid(!draft.date)}
              timeZone={LAUNCH_TIME_ZONE}
              value={draft.date}
              onChange={(change) => edit({ date: change.utcValue ?? "" })}
            />
          )}
        </Field>
        {events.length > 0 && (
          <Field label="Associated event" mark="optional">
            {(control) => (
              <Select
                {...control}
                value={draft.associatedEventId ?? ""}
                onChange={(event) =>
                  edit({
                    associatedEventId: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              >
                <option value="">No associated event</option>
                {events.map((taskEvent) => (
                  <option key={taskEvent.id} value={taskEvent.id}>
                    {taskEvent.title} – {pacific(taskEvent.date)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <div className="flex flex-col gap-1.5">
          <p className="font-medium">Preview</p>
          <p className="text-caption text-fg-muted">
            {UPDATE_PREVIEW_DESCRIPTION}
          </p>
          <UpdatePreview texts={texts} />
        </div>
      </FormSection>
    </form>
  );
}

import { readGroupResults } from "@alliance/common/action-update-copy";
import {
  readDisplayOnlySchema,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import type {
  ActionEventDto,
  ActionUpdateNotifyType,
  AdminActionUpdateDto,
} from "@alliance/shared/client";
import { useId, useState } from "react";
import {
  notifyBlockedReasonOf,
  usesRecognition,
  type ActionUpdateForm,
} from "../../../lib/actionUpdateDetails";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import type { useActionUpdateAdmin } from "../../../lib/useActionUpdateAdmin";
import { useTagsAdmin } from "../../../lib/useTagsAdmin";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import {
  Field,
  FieldGroup,
  FormSection,
  SaveBar,
} from "../../../ui/templates/Form";
import { PageBody } from "../../../ui/templates/Page";
import { AudienceUpdatePreview } from "./AudienceUpdatePreview";
import { CardImageField } from "./CardImageField";
import { CollectiveResultFields } from "./CollectiveResultFields";
import { UpdateNotifySection } from "./UpdateNotifySection";
import { UPDATE_PREVIEW_DESCRIPTION } from "./UpdatePreview";
import { UpdateVisibilitySection } from "./UpdateVisibilitySection";
import {
  dateHelpOf,
  detailsSaveNoteOf,
  NOTIFY_TYPE_LABELS,
  NOTIFY_TYPES,
  pacific,
  visibilityOf,
} from "./updateRules";
import type { UpdateDetails } from "./useUpdateDetails";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

const isNotifyType = (value: string): value is ActionUpdateNotifyType =>
  NOTIFY_TYPES.some((type) => type === value);

/** The saved details, the one-time send and the member visibility, each saved on its own. */
export function UpdateDetailsTab({
  details,
  form,
  update,
  events,
  admin,
  onWritten,
}: {
  details: UpdateDetails;
  form: ActionUpdateForm;
  update: AdminActionUpdateDto;
  events: ActionEventDto[] | null;
  admin: ReturnType<typeof useActionUpdateAdmin>;
  /** Refills the form from what a write returned. */
  onWritten: (saved: AdminActionUpdateDto) => void;
}) {
  const [visibilityRefusal, setVisibilityRefusal] = useState<string | null>(
    null,
  );
  const storedSchema = readDisplayOnlySchema(update.schema);
  const blockedReason = notifyBlockedReasonOf({
    notifyType: update.notifyType,
    hasUnsavedDetails: details.hasUnsavedDetails,
    hasBody: !!storedSchema && storedSchema.blocks.length > 0,
    hasNotificationText: readGroupResults({
      completed: update.shortNotifString,
      didNotComplete: update.nonCompleterResult,
    }).ok,
  });
  const changeVisibility = async (
    write: () => Promise<AdminActionUpdateDto>,
    fallback: string,
  ) => {
    setVisibilityRefusal(null);
    try {
      onWritten(await write());
    } catch (error) {
      setVisibilityRefusal(adminRefusalMessage(error, fallback));
    }
  };
  return (
    <PageBody width="form">
      <UpdateDetailsForm
        details={details}
        form={form}
        update={update}
        storedSchema={storedSchema}
        events={events}
      />
      <UpdateNotifySection
        update={update}
        notify={admin.notify}
        blockedReason={blockedReason}
        onSent={onWritten}
      />
      <UpdateVisibilitySection
        update={update}
        hasUnsavedDetails={details.hasUnsavedDetails}
        changing={admin.publishNow.isPending || admin.unpublish.isPending}
        refusal={visibilityRefusal}
        onPublishNow={() =>
          void changeVisibility(
            admin.publishNow.mutateAsync,
            "Couldn't publish the update.",
          )
        }
        onUnpublish={() =>
          void changeVisibility(
            admin.unpublish.mutateAsync,
            "Couldn't unpublish the update.",
          )
        }
      />
    </PageBody>
  );
}

function UpdateDetailsForm({
  details,
  form,
  update,
  storedSchema,
  events,
}: {
  details: UpdateDetails;
  form: ActionUpdateForm;
  update: AdminActionUpdateDto;
  storedSchema: DisplayOnlySchema | null;
  /** null while the task's events couldn't load. */
  events: ActionEventDto[] | null;
}) {
  const { setForm, errors } = details;
  const tags = useTagsAdmin();
  const recognition = usesRecognition(form.notificationMode);
  const previewId = useId();
  return (
    <form
      ref={details.formRef}
      onSubmit={(event) => void details.submit(event)}
      noValidate
    >
      <FormSection
        title="Details"
        description="The heading and card image members see, the notification's text and audience, and the update's date."
        footer={
          <SaveBar
            state={details.state}
            error={details.saveError}
            note={detailsSaveNoteOf({
              saved: update,
              date: form.date,
              now: new Date(),
            })}
            onDiscard={details.discard}
          />
        }
      >
        <Field
          label="Title"
          help="A short heading members see above the update."
          error={errors.title}
        >
          {(control) => (
            <Input
              {...control}
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          )}
        </Field>
        <FieldGroup
          label="Card image"
          help="The first photo on this update's card on members' tasks page, followed by the update's other images. Cropped to fit."
        >
          <CardImageField
            savedSrc={update.cardImage}
            schema={storedSchema}
            choice={form.cardImage}
            onChange={details.setCardImage}
          />
        </FieldGroup>
        {recognition ? (
          <>
            <CollectiveResultFields
              texts={form}
              onChange={(texts) => setForm({ ...form, ...texts })}
            />
            {update.recognitionPreparedAt && (
              <p className="text-fg-muted">
                Each member&apos;s copy was frozen when this update came due, so
                changing the notification text no longer reaches anyone.
              </p>
            )}
          </>
        ) : (
          <Field
            label="Short notification text"
            help='"Update: " is added before it.'
            error={errors.shortNotifString}
          >
            {(control) => (
              <Input
                {...control}
                value={form.shortNotifString}
                onChange={(event) =>
                  setForm({ ...form, shortNotifString: event.target.value })
                }
              />
            )}
          </Field>
        )}
        <Field
          label="Audience"
          help={
            update.notifiedAt
              ? "The notification has been sent, so changing the audience reaches no one."
              : "Who the notification goes to when you send it below."
          }
        >
          {(control) => (
            <Select
              {...control}
              value={form.notifyType}
              onChange={(event) => {
                const notifyType = event.target.value;
                if (isNotifyType(notifyType)) setForm({ ...form, notifyType });
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
            tags.isError
              ? "Couldn't load the tags."
              : form.notifyType === "tag"
                ? "Only members with this tag are notified."
                : `Used when the audience is "${NOTIFY_TYPE_LABELS.tag}".`
          }
        >
          {(control) => (
            <Select
              {...control}
              disabled={form.notifyType !== "tag"}
              value={form.notifyType === "tag" ? form.tagId : ""}
              onChange={(event) =>
                setForm({ ...form, tagId: event.target.value })
              }
            >
              <option value="">Select a tag</option>
              {tags.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={`Date (${ZONE})`}
          help={dateHelpOf(visibilityOf(update, new Date()))}
        >
          {(control) => (
            <DateTimePicker
              {...control}
              timeZone={LAUNCH_TIME_ZONE}
              value={form.date}
              onChange={(change) =>
                setForm({ ...form, date: change.utcValue ?? "" })
              }
            />
          )}
        </Field>
        {events === null ? (
          <Field
            label="Associated event"
            mark="optional"
            error="Couldn't load the task's events."
          >
            {(control) => (
              <Select {...control} disabled value="">
                <option value="">—</option>
              </Select>
            )}
          </Field>
        ) : (
          events.length > 0 && (
            <Field label="Associated event" mark="optional">
              {(control) => (
                <Select
                  {...control}
                  value={form.associatedEventId}
                  onChange={(event) =>
                    setForm({ ...form, associatedEventId: event.target.value })
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
          )
        )}
        {recognition && !update.recognitionPreparedAt && (
          <section
            aria-labelledby={previewId}
            className="flex flex-col gap-1.5"
          >
            <h3 id={previewId} className="font-medium">
              Preview
            </h3>
            <p className="text-caption text-fg-muted">
              {UPDATE_PREVIEW_DESCRIPTION}
            </p>
            <AudienceUpdatePreview updateId={update.id} form={form} />
          </section>
        )}
      </FormSection>
    </form>
  );
}

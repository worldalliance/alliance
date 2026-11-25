import { readGroupResults } from "@alliance/common/action-update-copy";
import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { cn } from "@alliance/shared/styles/util";
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ActionUpdateCardImageField } from "../components/ActionUpdateCardImageField";
import { NotificationAudienceFields } from "../components/ActionUpdateNotificationAudience";
import {
  HiddenFromMembersBanner,
  VisibilityControls,
} from "../components/ActionUpdateVisibility";
import { AudienceUpdatePreview } from "../components/AudienceUpdatePreview";
import { CollectiveResultFields } from "../components/CollectiveResultFields";
import { FormBuilder } from "../components/FormBuilder";
import FormSection from "../components/FormSection";
import { UPDATE_PREVIEW_DESCRIPTION } from "../components/UpdatePreview";
import { useContentConfirm } from "../components/useContentConfirm";
import {
  detailsBody,
  formOf,
  notifyBlockedReasonOf,
  usesRecognition,
  type ActionUpdateForm,
} from "../lib/actionUpdateDetails";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { notifyRealMembersText } from "../lib/notifyRealMembers";
import { useActionUpdateAdmin } from "../lib/useActionUpdateAdmin";
import { useConfirmOnPage } from "../lib/useConfirmOnPage";
import { useLeaveGuard } from "../lib/useLeaveGuard";
import { useSearchParamTab } from "../lib/useSearchParamTab";
import DateTimePicker from "../ui/DateTimePicker";
import { ConfirmMode, useToast } from "../ui/ToastProvider";

const tabs = ["details", "content"] as const;

const TEXT_INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm";

const ActionUpdatePage: React.FC = () => {
  const { actionId: actionIdParam, updateId: updateIdParam } = useParams<{
    actionId: string;
    updateId: string;
  }>();
  const navigate = useNavigate();
  const [selectedTab, onTabChange] = useSearchParamTab(tabs, "content");

  const actionId = Number(actionIdParam);
  const parsedUpdateId = Number(updateIdParam);
  const updateId = isNaN(parsedUpdateId) ? null : parsedUpdateId;

  const {
    query,
    update: updateMutation,
    notify,
    publishNow,
    unpublish,
    saveSchema,
  } = useActionUpdateAdmin(updateId);
  const update = query.data;
  const { action, isError: actionFailed } = useActionAdmin(
    isNaN(actionId) ? null : actionId,
  );
  const events = action?.events ?? [];
  const [form, setForm] = useState<ActionUpdateForm | null>(null);
  const [formSource, setFormSource] = useState<AdminActionUpdateDto | null>(
    null,
  );
  const fillForm = useCallback((source: AdminActionUpdateDto) => {
    setFormSource(source);
    setForm(formOf(source));
  }, []);
  const saving = updateMutation.isPending;
  const notifying = notify.isPending;
  const changingVisibility = publishNow.isPending || unpublish.isPending;
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmOnPage();
  const { success } = useToast();

  // A copy cached by an earlier visit may be stale, and saving a form filled
  // from it would write those stale details back. A newer copy refills a form
  // with no edits, so someone else's change never reads as an unsaved edit.
  const formEdited =
    formSource !== null &&
    JSON.stringify(form) !== JSON.stringify(formOf(formSource));
  if (
    update &&
    query.isFetchedAfterMount &&
    !query.isError &&
    update !== formSource &&
    (formSource?.id !== update.id || !formEdited)
  ) {
    fillForm(update);
  }

  // A draft of another update was already discarded at the prompt that left it.
  useLeaveGuard(formEdited && formSource.id === updateId, {
    allowSamePath: true,
  });

  const savedForm = useMemo(() => update && formOf(update), [update]);

  const saveDetails = updateMutation.mutateAsync;
  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  const handleSubmitDetails = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form) return;
      setError(null);
      const body = detailsBody(form);
      if (!(await confirmSave(body))) return;
      try {
        fillForm(await saveDetails(body));
        success(`Saved "${body.title}"`);
      } catch (err) {
        setError("Failed to save update");
        console.error(err);
      }
    },
    [form, saveDetails, fillForm, confirmSave, success],
  );

  const writeAndRefill = useCallback(
    async (write: () => Promise<AdminActionUpdateDto>, fallback: string) => {
      setError(null);
      try {
        fillForm(await write());
      } catch (err) {
        setError(adminRefusalMessage(err, fallback));
        console.error(err);
      }
    },
    [fillForm],
  );

  const handleNotify = useCallback(
    async (audienceLabel: string) => {
      const ok = await confirm({
        title: "Send notification?",
        message: `This notifies ${audienceLabel}. It can't be undone, and it can only be sent once.`,
        confirmLabel: "Send",
        cancelLabel: "Cancel",
        mode: ConfirmMode.Fullscreen,
        requiredText: notifyRealMembersText("many"),
      });
      if (!ok) return;
      await writeAndRefill(
        notify.mutateAsync,
        "Failed to send the notification",
      );
    },
    [writeAndRefill, notify.mutateAsync, confirm],
  );

  const handleUnpublish = useCallback(
    () =>
      writeAndRefill(unpublish.mutateAsync, "Failed to unpublish the update"),
    [writeAndRefill, unpublish.mutateAsync],
  );

  const handlePublishNow = useCallback(
    () =>
      writeAndRefill(publishNow.mutateAsync, "Failed to publish the update"),
    [writeAndRefill, publishNow.mutateAsync],
  );

  const formFilled = updateId !== null && formSource?.id === updateId;

  if (updateId !== null && !formFilled && !query.isError) {
    return (
      <div className="p-8">
        <title>Action Update - Admin</title>
        Loading update...
      </div>
    );
  }

  if (!formFilled || !update || !form || !savedForm) {
    return (
      <div className="p-8">
        <title>Action Update - Admin</title>
        <p className="text-red-500">
          {updateId === null
            ? "Invalid update id"
            : thrownStatus(query.error) === 404
              ? "Update not found"
              : "Failed to load update"}
        </p>
        <button
          onClick={() => navigate(`/tasks/${actionId}?tab=updates`)}
          className="mt-4 px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
      </div>
    );
  }

  const storedSchema = readDisplayOnlySchema(update.schema);
  const recognition = usesRecognition(form.notificationMode);
  const hasUnsavedDetails = JSON.stringify(form) !== JSON.stringify(savedForm);

  const notifyBlockedReason = notifyBlockedReasonOf({
    notifyType: update.notifyType,
    hasUnsavedDetails,
    hasBody: !!storedSchema && storedSchema.blocks.length > 0,
    hasNotificationText: readGroupResults({
      completed: update.shortNotifString,
      didNotComplete: update.nonCompleterResult,
    }).ok,
  });

  const detailsTab = (
    <form onSubmit={handleSubmitDetails} className="space-y-6">
      <FormSection
        title="Title"
        description="A short, descriptive heading shown above the update."
      >
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        />
      </FormSection>

      <FormSection
        title="Card image"
        description="The first photo on this update's card on members' tasks page, followed by the update's other images. Cropped to fit."
      >
        <ActionUpdateCardImageField
          savedSrc={update.cardImage}
          schema={storedSchema}
          choice={form.cardImage}
          onChange={(cardImage) => setForm({ ...form, cardImage })}
        />
      </FormSection>

      <FormSection
        title={recognition ? "Notification text" : "Short notification text"}
        description={
          recognition
            ? undefined
            : 'An automatic "Update: " prefix is added to this text.'
        }
      >
        {recognition ? (
          <>
            <CollectiveResultFields
              texts={form}
              onChange={(texts) => setForm({ ...form, ...texts })}
              inputClassName={TEXT_INPUT_CLASS}
            />
            {update.recognitionPreparedAt && (
              <p className="mt-2 text-sm text-gray-700">
                Each member&apos;s copy was frozen when this update came due, so
                changing the notification text no longer reaches anyone.
              </p>
            )}
          </>
        ) : (
          <input
            type="text"
            value={form.shortNotifString}
            onChange={(e) =>
              setForm({ ...form, shortNotifString: e.target.value })
            }
            required={form.notifyType !== "none"}
            className={TEXT_INPUT_CLASS}
          />
        )}
      </FormSection>

      <FormSection title="Notification audience">
        <NotificationAudienceFields
          form={form}
          onChange={setForm}
          update={update}
          notifying={notifying}
          notifyBlockedReason={notifyBlockedReason}
          onNotify={handleNotify}
        />
      </FormSection>

      <FormSection
        title="Date"
        description="The date and time displayed for this update."
      >
        <DateTimePicker
          value={form.date}
          onChange={(date) => setForm({ ...form, date: date.utcValue ?? "" })}
        />
      </FormSection>

      <FormSection title="Member visibility">
        <VisibilityControls
          update={update}
          hasUnsavedDetails={hasUnsavedDetails}
          changing={changingVisibility}
          onPublishNow={handlePublishNow}
          onUnpublish={handleUnpublish}
        />
      </FormSection>

      {!action && actionFailed && (
        <FormSection title="Associated event">
          <p className="text-sm text-red-500">
            Couldn&apos;t load the action&apos;s events.
          </p>
        </FormSection>
      )}

      {events.length > 0 && (
        <FormSection
          title="Associated event"
          description="Optionally link this update to a related action event."
        >
          <select
            value={form.associatedEventId}
            onChange={(e) =>
              setForm({ ...form, associatedEventId: e.target.value })
            }
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">No associated event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} – {new Date(event.date).toLocaleString()}
              </option>
            ))}
          </select>
        </FormSection>
      )}

      {recognition && !update.recognitionPreparedAt && (
        <FormSection
          title="Preview update"
          description={UPDATE_PREVIEW_DESCRIPTION}
        >
          <AudienceUpdatePreview updateId={update.id} form={form} />
        </FormSection>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          className="px-4 py-2 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 text-sm font-medium"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );

  const contentTab = storedSchema ? (
    <FormBuilder
      displayOnly
      initialSchema={displayOnlyToFormSchema(storedSchema)}
      initialSnapshotId={update.schemaSnapshotId}
      title={update.title}
      setFormId={() => {}}
      onSave={saveSchema}
    />
  ) : (
    // Editing content this build can't parse would save back whatever the
    // builder made of it, dropping the parts it didn't understand.
    <div
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
      role="alert"
    >
      <p className="font-medium">This update can&apos;t be edited here</p>
      <p className="mt-1 text-sm">
        Its content was saved by a newer version of the admin panel. Refresh the
        page to pick that version up.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <title>{update.title} - Admin</title>
      {contentDialog}
      <div className="p-5 pb-0 flex flex-row justify-between w-full">
        <h1 className="text-[#111] text-[16pt] font-bold">{update.title}</h1>
        <button
          onClick={() => navigate(`/tasks/${actionId}?tab=updates`)}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 text-nowrap mr-5"
        >
          ← Back to updates
        </button>
      </div>

      <HiddenFromMembersBanner update={update} />

      {error && (
        <div
          role="alert"
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 mx-5 mt-4"
        >
          {error}
        </div>
      )}

      <div className="space-y-4 flex-1 min-h-0 mx-5">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(
              [
                ["content", "Content"],
                ["details", "Update details"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={cn(
                  "py-2 px-1 border-b-2 text-sm",
                  selectedTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {selectedTab === "details" ? detailsTab : contentTab}
        </div>
      </div>
    </div>
  );
};

export default ActionUpdatePage;

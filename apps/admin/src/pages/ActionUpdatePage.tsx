import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { R } from "@alliance/common/result";
// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import {
  actionsFindOneAdmin,
  type ActionEventDto,
  type AdminActionUpdateDto,
  type RecognitionPreviewCountsDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { cn } from "@alliance/shared/styles/util";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import type { UseQueryResult } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { NotificationAudienceFields } from "../components/ActionUpdateNotificationAudience";
import { COLLECTIVE_RESULT_DESCRIPTION } from "../components/ActionUpdateRecognition";
import {
  HiddenFromMembersBanner,
  VisibilityControls,
} from "../components/ActionUpdateVisibility";
import { CollectiveResultSplitFields } from "../components/CollectiveResultSplitFields";
import { FormBuilder } from "../components/FormBuilder";
import FormSection from "../components/FormSection";
import {
  PreviewCountsKind,
  UPDATE_PREVIEW_DESCRIPTION,
  UpdatePreview,
  type PreviewCounts,
} from "../components/UpdatePreview";
import {
  detailsBody,
  formOf,
  notifyBlockedReasonOf,
  usesRecognition,
  type ActionUpdateForm,
} from "../lib/actionUpdateDetails";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionUpdateAdmin } from "../lib/useActionUpdateAdmin";
import { useRecognitionPreviewCounts } from "../lib/useRecognitionPreviewCounts";
import { useSearchParamTab } from "../lib/useSearchParamTab";

const tabs = ["details", "content"] as const;

const TEXT_INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm";

const previewCountsOf = (
  form: ActionUpdateForm,
  query: UseQueryResult<RecognitionPreviewCountsDto>,
): PreviewCounts => {
  if (form.notifyType === "none") {
    return {
      kind: PreviewCountsKind.Counted,
      counts: {
        completed: 0,
        didNotComplete: 0,
        uninvolved: 0,
      },
    };
  }
  if (form.notifyType === "tag" && !form.tagId) {
    return {
      kind: PreviewCountsKind.Unavailable,
      reason: "Pick a tag to count recipients.",
    };
  }
  if (query.data) {
    return { kind: PreviewCountsKind.Counted, counts: query.data };
  }
  return query.isError
    ? {
        kind: PreviewCountsKind.Unavailable,
        reason: "Couldn't count the recipients.",
      }
    : { kind: PreviewCountsKind.Pending };
};

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
  const [events, setEvents] = useState<ActionEventDto[]>([]);
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

  const savedForm = useMemo(() => update && formOf(update), [update]);
  const countsTagId = form?.notifyType === "tag" ? form.tagId || null : null;
  const countsQuery = useRecognitionPreviewCounts({
    updateId: updateId ?? 0,
    notifyType: form?.notifyType ?? "none",
    tagId: countsTagId,
    enabled:
      !!form &&
      usesRecognition(form.notificationMode) &&
      !update?.recognitionPreparedAt &&
      form.notifyType !== "none" &&
      (form.notifyType !== "tag" || countsTagId !== null),
  });

  useEffect(() => {
    if (isNaN(actionId)) return;
    let cancelled = false;
    const load = async () => {
      const action = await R.fromPromise(
        actionsFindOneAdmin({ path: { id: actionId } }),
      );
      if (cancelled) return;
      if (!action.ok) {
        console.error("Failed to load the action:", action.error);
      }
      setEvents((action.ok && action.value.data?.events) || []);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  const saveDetails = updateMutation.mutateAsync;
  const handleSubmitDetails = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form) return;
      setError(null);
      try {
        fillForm(await saveDetails(detailsBody(form)));
      } catch (err) {
        setError("Failed to save update");
        console.error(err);
      }
    },
    [form, saveDetails, fillForm],
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
      if (
        !window.confirm(
          `Send this update's notification to ${audienceLabel}? This can't be undone, and it can only be sent once.`,
        )
      ) {
        return;
      }
      await writeAndRefill(
        notify.mutateAsync,
        "Failed to send the notification",
      );
    },
    [writeAndRefill, notify.mutateAsync],
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
          onClick={() => navigate(`/actions/${actionId}?tab=updates`)}
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
        title={recognition ? "Collective result" : "Short notification text"}
        description={
          recognition
            ? COLLECTIVE_RESULT_DESCRIPTION
            : 'An automatic "Update: " prefix is added to this text.'
        }
      >
        <input
          type="text"
          value={form.shortNotifString}
          onChange={(e) =>
            setForm({ ...form, shortNotifString: e.target.value })
          }
          required={!(recognition && form.splitCollectiveResult)}
          className={TEXT_INPUT_CLASS}
        />
        {recognition &&
          (update.recognitionPreparedAt ? (
            <p className="mt-2 text-sm text-gray-700">
              Each member&apos;s copy was frozen when this update came due, so
              changing the collective result no longer reaches anyone.
            </p>
          ) : (
            <CollectiveResultSplitFields
              texts={form}
              onChange={(texts) => setForm({ ...form, ...texts })}
              inputClassName={TEXT_INPUT_CLASS}
            />
          ))}
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
          title="Preview Update"
          description={UPDATE_PREVIEW_DESCRIPTION}
        >
          <UpdatePreview
            texts={form}
            counts={previewCountsOf(form, countsQuery)}
          />
        </FormSection>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          className="px-4 py-2 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 text-sm font-medium"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
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
      <div className="p-5 pb-0 flex flex-row justify-between w-full">
        <h1 className="text-[#111] text-[16pt] font-bold">{update.title}</h1>
        <button
          onClick={() => navigate(`/actions/${actionId}?tab=updates`)}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 text-nowrap mr-5"
        >
          ← Back to Updates
        </button>
      </div>

      <HiddenFromMembersBanner update={update} />

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 mx-5 mt-4">
          {error}
        </div>
      )}

      <div className="space-y-4 flex-1 min-h-0 mx-5">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(
              [
                ["content", "Content"],
                ["details", "Update Details"],
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

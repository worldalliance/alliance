/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { R } from "@alliance/common/result";
import { run } from "@alliance/common/run";
import {
  actionsFindOneAdmin,
  ActionUpdateNotifyType,
  type ActionEventDto,
  type ActionFormVariantsListDto,
  type AdminActionUpdateDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { cn } from "@alliance/shared/styles/util";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import { Eye, EyeOff } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ActionFormStatus,
  COLLECTIVE_RESULT_DESCRIPTIONS,
  NotificationHeldBanner,
  RecognitionCheck,
  RecognitionCopySection,
  type ActionForm,
} from "../components/ActionUpdateRecognition";
import { FormBuilder } from "../components/FormBuilder";
import FormSection from "../components/FormSection";
import {
  checkBlockedReasonOf,
  detailsBody,
  formOf,
  notifyBlockedReasonOf,
  recognitionModeOf,
  type ActionUpdateForm,
} from "../lib/actionUpdateDetails";
import {
  ACTION_UPDATE_NOTIFY_TYPE_LABELS,
  ACTION_UPDATE_NOTIFY_TYPES,
} from "../lib/actionUpdateNotifyTypes";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionUpdateAdmin } from "../lib/useActionUpdateAdmin";
import { useFormVariantsAdmin } from "../lib/useFormVariantsAdmin";
import { useSearchParamTab } from "../lib/useSearchParamTab";

const tabs = ["details", "content"] as const;

enum VisibilityState {
  Unpublished = "unpublished",
  Scheduled = "scheduled",
  Published = "published",
}

type Visibility =
  | { state: VisibilityState.Unpublished }
  | { state: VisibilityState.Scheduled; visibleAt: Date }
  | { state: VisibilityState.Published; visibleAt: Date };

type ActionTaskForm =
  | Exclude<ActionForm, { status: ActionFormStatus.Loaded }>
  | { status: ActionFormStatus.Loaded; taskFormId: number | undefined };

const variantFormIdsOf = (list: ActionFormVariantsListDto) =>
  list.variants.map((variant) => variant.formId);

const visibilityOf = (
  update: AdminActionUpdateDto,
  now: number,
): Visibility => {
  if (!update.visibleAt) return { state: VisibilityState.Unpublished };

  const visibleAt = new Date(update.visibleAt);
  return visibleAt.getTime() > now
    ? { state: VisibilityState.Scheduled, visibleAt }
    : { state: VisibilityState.Published, visibleAt };
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
  const [actionTaskForm, setActionTaskForm] = useState<ActionTaskForm>({
    status: ActionFormStatus.Loading,
  });
  const { variants: variantFormIds } = useFormVariantsAdmin(
    actionId,
    variantFormIdsOf,
  );
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

  const { tags: availableTags } = useTagsAdmin();
  const savedForm = useMemo(() => update && formOf(update), [update]);

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
      const actionData = action.ok ? action.value.data : undefined;
      if (!actionData) {
        setActionTaskForm({ status: ActionFormStatus.LoadFailed });
        return;
      }
      setEvents(actionData.events ?? []);
      setActionTaskForm({
        status: ActionFormStatus.Loaded,
        taskFormId: actionData.taskFormId,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  const actionForm = useMemo(
    (): ActionForm =>
      actionTaskForm.status !== ActionFormStatus.Loaded
        ? actionTaskForm
        : variantFormIds.data
          ? { ...actionTaskForm, variantFormIds: variantFormIds.data }
          : variantFormIds.isError
            ? { status: ActionFormStatus.LoadFailed }
            : { status: ActionFormStatus.Loading },
    [actionTaskForm, variantFormIds.data, variantFormIds.isError],
  );

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
  const recognitionMode = recognitionModeOf(form.notificationMode);
  const hasUnsavedDetails = JSON.stringify(form) !== JSON.stringify(savedForm);

  const now = Date.now();
  const visibility = visibilityOf(update, now);
  const displayDate = new Date(update.date);

  const notifyBlockedReason = notifyBlockedReasonOf({
    notifyType: update.notifyType,
    formulasReadable: savedForm.formulas !== null,
    hasUnsavedDetails,
    hasBody: !!storedSchema && storedSchema.blocks.length > 0,
  });

  // Unpublishing moves `visibleAt` to the saved date, so an unsaved edit to the
  // picker would schedule the update for a different time than the one shown.
  const unpublishBlockedReason = run(() => {
    if (hasUnsavedDetails) {
      return "Save your changes first.";
    }
    if (displayDate.getTime() <= now) {
      return "The displayed date has already passed, so there's nothing to wait for.";
    }
    return null;
  });

  const hiddenBanner = run(() => {
    switch (visibility.state) {
      case VisibilityState.Unpublished:
        return "Not visible to members yet — this update publishes the first time you save content on the Content tab.";
      case VisibilityState.Scheduled:
        return `Not visible to members yet — this update publishes ${visibility.visibleAt.toLocaleString()}.`;
      case VisibilityState.Published:
        return null;
      default:
        throw new Error(`unknown visibility: ${visibility satisfies never}`);
    }
  });

  const visibilitySection = run(() => {
    switch (visibility.state) {
      case VisibilityState.Unpublished:
        return (
          <p className="text-sm text-gray-700">
            Not published yet — this update publishes the first time you save
            content on the Content tab.
          </p>
        );
      case VisibilityState.Scheduled:
        return (
          <>
            <p className="text-sm text-gray-700">
              Hidden from members until {visibility.visibleAt.toLocaleString()},
              when it publishes on its own.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePublishNow}
                disabled={changingVisibility}
                className="flex items-center gap-2 px-4 py-2 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:hover:scale-100"
              >
                <Eye className="w-4 h-4" aria-hidden />
                {changingVisibility ? "Publishing..." : "Publish now"}
              </button>
              <p className="text-xs text-gray-500">
                Makes the update visible to members immediately.
              </p>
            </div>
          </>
        );
      case VisibilityState.Published:
        return (
          <>
            <p className="text-sm text-gray-700">
              Visible to members since {visibility.visibleAt.toLocaleString()}.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={changingVisibility || unpublishBlockedReason !== null}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:hover:bg-white"
              >
                <EyeOff className="w-4 h-4" aria-hidden />
                {changingVisibility
                  ? "Unpublishing..."
                  : "Unpublish until displayed date"}
              </button>
              <p className="text-xs text-gray-500">
                {unpublishBlockedReason ??
                  `Hides it from members until ${displayDate.toLocaleString()}.`}
              </p>
            </div>
          </>
        );
      default:
        throw new Error(`unknown visibility: ${visibility satisfies never}`);
    }
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
        title={
          recognitionMode
            ? "Collective result (#{alliance_result})"
            : "Short notification text"
        }
        description={
          recognitionMode
            ? COLLECTIVE_RESULT_DESCRIPTIONS[recognitionMode]
            : 'An automatic "Update: " prefix is added to this text.'
        }
      >
        <input
          type="text"
          value={form.shortNotifString}
          onChange={(e) =>
            setForm({ ...form, shortNotifString: e.target.value })
          }
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        />
      </FormSection>

      {recognitionMode && (
        <RecognitionCopySection
          form={form}
          mode={recognitionMode}
          prepared={update.recognitionPreparedAt !== null}
          actionForm={actionForm}
          onChange={setForm}
        />
      )}

      <FormSection title="Notification audience">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Audience</span>
            <select
              value={form.notifyType}
              onChange={(e) =>
                setForm({
                  ...form,
                  notifyType: e.target.value as ActionUpdateNotifyType,
                })
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {ACTION_UPDATE_NOTIFY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {ACTION_UPDATE_NOTIFY_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          {form.notifyType === "tag" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Target tag</span>
              <select
                value={form.tagId}
                onChange={(e) => setForm({ ...form, tagId: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a tag</option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          {update.notificationHeldReason && (
            <NotificationHeldBanner reason={update.notificationHeldReason} />
          )}
          {recognitionMode && !update.recognitionPreparedAt && (
            <RecognitionCheck
              key={JSON.stringify(savedForm)}
              updateId={update.id}
              disabledReason={checkBlockedReasonOf({
                notifyType: update.notifyType,
                hasUnsavedDetails,
              })}
            />
          )}
          {update.notifiedAt ? (
            <p className="text-sm text-gray-700">
              Sent {new Date(update.notifiedAt).toLocaleString()} to{" "}
              {ACTION_UPDATE_NOTIFY_TYPE_LABELS[
                update.notifyType
              ].toLowerCase()}
              . An update can only be notified about once.
              {recognitionMode &&
                !update.recognitionPreparedAt &&
                " Each member's copy is resolved and sent when the update comes due."}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleNotify(
                    ACTION_UPDATE_NOTIFY_TYPE_LABELS[
                      update.notifyType
                    ].toLowerCase(),
                  )
                }
                disabled={notifying || notifyBlockedReason !== null}
                className="px-4 py-2 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:hover:scale-100"
              >
                {notifying ? "Sending..." : "Send notification"}
              </button>
              <p className="text-xs text-gray-500">
                {notifyBlockedReason ??
                  "Nothing has been sent yet. Members are notified when you send it."}
              </p>
            </div>
          )}
        </div>
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

      <FormSection title="Member visibility">{visibilitySection}</FormSection>

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

      {hiddenBanner && (
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm">{hiddenBanner}</p>
        </div>
      )}

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

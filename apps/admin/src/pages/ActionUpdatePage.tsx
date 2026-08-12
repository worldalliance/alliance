import {
  displayOnlyToFormSchema,
  readDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { run } from "@alliance/common/run";
import {
  actionsFindOneAdmin,
  actionsFindOneUpdateAdmin,
  actionsNotifyUpdateAdmin,
  actionsPublishUpdateNowAdmin,
  actionsUnpublishUpdateAdmin,
  actionsUpdateUpdateAdmin,
  ActionUpdateDto,
  ActionUpdateNotifyType,
  type ActionEventDto,
  type UpdateActionUpdateDto,
} from "@alliance/shared/client";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { cn } from "@alliance/shared/styles/util";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import { Eye, EyeOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { FormBuilder } from "../components/FormBuilder";
import FormSection from "../components/FormSection";
import {
  ACTION_UPDATE_NOTIFY_TYPE_LABELS,
  ACTION_UPDATE_NOTIFY_TYPES,
} from "../lib/actionUpdateNotifyTypes";
import {
  useDisplayOnlySchemaSave,
  type DisplayOnlySchemaSaveBody,
} from "../lib/useDisplayOnlySchemaSave";

type Tab = "details" | "content";

type ActionUpdateForm = {
  title: string;
  shortNotifString: string;
  notifyType: ActionUpdateNotifyType;
  tagId: string;
  date: string;
  associatedEventId: string;
};

enum VisibilityState {
  Unpublished = "unpublished",
  Scheduled = "scheduled",
  Published = "published",
}

type Visibility =
  | { state: VisibilityState.Unpublished }
  | { state: VisibilityState.Scheduled; visibleAt: Date }
  | { state: VisibilityState.Published; visibleAt: Date };

const visibilityOf = (update: ActionUpdateDto, now: number): Visibility => {
  if (!update.visibleAt) return { state: VisibilityState.Unpublished };

  const visibleAt = new Date(update.visibleAt);
  return visibleAt.getTime() > now
    ? { state: VisibilityState.Scheduled, visibleAt }
    : { state: VisibilityState.Published, visibleAt };
};

const formOf = (update: ActionUpdateDto): ActionUpdateForm => ({
  title: update.title,
  shortNotifString: update.shortNotifString,
  notifyType: update.notifyType,
  tagId: update.tag?.id ?? "",
  date: update.date,
  associatedEventId: update.associatedEventId
    ? String(update.associatedEventId)
    : "",
});

const ActionUpdatePage: React.FC = () => {
  const { actionId: actionIdParam, updateId: updateIdParam } = useParams<{
    actionId: string;
    updateId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = (searchParams.get("tab") as Tab) ?? "content";

  const actionId = Number(actionIdParam);
  const updateId = Number(updateIdParam);

  const [update, setUpdate] = useState<ActionUpdateDto | null>(null);
  const [events, setEvents] = useState<ActionEventDto[]>([]);
  const [form, setForm] = useState<ActionUpdateForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { tags: availableTags } = useTagsAdmin();

  const onTabChange = useCallback(
    (tab: Tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (isNaN(updateId)) {
      setError("Invalid update id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await actionsFindOneUpdateAdmin({
          path: { id: updateId },
        });
        if (cancelled) return;
        if (!response.data) {
          setError("Update not found");
          return;
        }
        setUpdate(response.data);
        setForm(formOf(response.data));
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load update");
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [updateId]);

  useEffect(() => {
    if (isNaN(actionId)) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await actionsFindOneAdmin({ path: { id: actionId } });
        if (!cancelled && response.data) setEvents(response.data.events ?? []);
      } catch (err) {
        console.error("Failed to load action events:", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [actionId]);

  const handleSubmitDetails = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form) return;
      setSaving(true);
      setError(null);
      try {
        const body: UpdateActionUpdateDto = {
          title: form.title,
          shortNotifString: form.shortNotifString,
          notifyType: form.notifyType,
          date: form.date,
          tagId: form.notifyType === "tag" ? form.tagId || null : null,
          associatedEventId: form.associatedEventId
            ? Number(form.associatedEventId)
            : null,
        };
        const response = await actionsUpdateUpdateAdmin({
          path: { id: updateId },
          body,
        });
        if (!response.data) throw new Error("Update failed");
        setUpdate(response.data);
        setForm(formOf(response.data));
      } catch (err) {
        setError("Failed to save update");
        console.error(err);
      } finally {
        setSaving(false);
      }
    },
    [form, updateId],
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
      setNotifying(true);
      setError(null);
      try {
        const response = await actionsNotifyUpdateAdmin({
          path: { id: updateId },
        });
        if (!response.data) {
          const message = response.error?.message;
          throw new Error(
            (Array.isArray(message) ? message.join("; ") : message) ??
              "Failed to send the notification",
          );
        }
        setUpdate(response.data);
        setForm(formOf(response.data));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to send the notification",
        );
        console.error(err);
      } finally {
        setNotifying(false);
      }
    },
    [updateId],
  );

  const changeVisibility = useCallback(
    async (
      call: () => ReturnType<typeof actionsUnpublishUpdateAdmin>,
      fallbackError: string,
    ) => {
      setChangingVisibility(true);
      setError(null);
      try {
        const response = await call();
        if (!response.data) {
          const message = response.error?.message;
          throw new Error(
            (Array.isArray(message) ? message.join("; ") : message) ??
              fallbackError,
          );
        }
        setUpdate(response.data);
        setForm(formOf(response.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackError);
        console.error(err);
      } finally {
        setChangingVisibility(false);
      }
    },
    [],
  );

  const handleUnpublish = useCallback(
    () =>
      changeVisibility(
        () => actionsUnpublishUpdateAdmin({ path: { id: updateId } }),
        "Failed to unpublish the update",
      ),
    [changeVisibility, updateId],
  );

  const handlePublishNow = useCallback(
    () =>
      changeVisibility(
        () => actionsPublishUpdateNowAdmin({ path: { id: updateId } }),
        "Failed to publish the update",
      ),
    [changeVisibility, updateId],
  );

  const saveSchema = useCallback(
    (body: DisplayOnlySchemaSaveBody) =>
      actionsUpdateUpdateAdmin({ path: { id: updateId }, body }),
    [updateId],
  );

  const refetchUpdate = useCallback(
    () => actionsFindOneUpdateAdmin({ path: { id: updateId } }),
    [updateId],
  );

  const handleSaveSchema = useDisplayOnlySchemaSave({
    ownerLabel: "Updates",
    save: saveSchema,
    refetch: refetchUpdate,
    onSaved: setUpdate,
  });

  if (loading) {
    return (
      <div className="p-8">
        <title>Action Update - Admin</title>
        Loading update...
      </div>
    );
  }

  if (!update || !form) {
    return (
      <div className="p-8">
        <title>Action Update - Admin</title>
        <p className="text-red-500">{error ?? "Update not found"}</p>
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
  const hasUnsavedDetails =
    JSON.stringify(form) !== JSON.stringify(formOf(update));

  const now = Date.now();
  const visibility = visibilityOf(update, now);
  const displayDate = new Date(update.date);

  // The notification carries `shortNotifString` and goes to the saved audience,
  // so an unsaved edit to either would send something other than what's on
  // screen.
  const notifyBlockedReason = run(() => {
    if (update.notifyType === "none") {
      return "Pick an audience and save to enable sending.";
    }
    if (hasUnsavedDetails) {
      return "Save your changes before sending.";
    }
    if (!storedSchema || storedSchema.blocks.length === 0) {
      return "Write the update body on the Content tab first.";
    }
    return null;
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
        title="Short notification text"
        description={'An automatic "Update: " prefix is added to this text.'}
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
        <div className="mt-4 pt-4 border-t border-gray-200">
          {update.notifiedAt ? (
            <p className="text-sm text-gray-700">
              Sent {new Date(update.notifiedAt).toLocaleString()} to{" "}
              {ACTION_UPDATE_NOTIFY_TYPE_LABELS[
                update.notifyType
              ].toLowerCase()}
              . An update can only be notified about once.
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
      onSave={handleSaveSchema}
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

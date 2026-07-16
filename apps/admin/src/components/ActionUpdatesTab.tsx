import {
  ActionEventDto,
  actionsCreateUpdateAdmin,
  actionsDeleteUpdateAdmin,
  actionsUpdateUpdateAdmin,
  ActionUpdateDto,
  ActionUpdateNotifyType,
  CreateActionUpdateDto,
  CreateEditableContentDto,
  TagDto,
} from "@alliance/shared/client";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import EditableContentForm from "@alliance/sharedweb/ui/EditableContentForm";
import { useState } from "react";

interface ActionUpdatesTabProps {
  actionId: number;
  updates: ActionUpdateDto[];
  setUpdates: (updates: ActionUpdateDto[]) => unknown;
  events: ActionEventDto[];
  availableTags: TagDto[];
}

const defaultNewUpdate: CreateActionUpdateDto = {
  title: "",
  content: {
    body: "",
    attachments: [],
  },
  date: new Date().toISOString(),
  visibleAt: new Date().toISOString(),
  notifyType: "none",
  shortNotifString: "",
};

const ActionUpdatesTab = ({
  actionId,
  updates,
  setUpdates,
  events,
  availableTags,
}: ActionUpdatesTabProps) => {
  const [newUpdate, setNewUpdate] =
    useState<CreateActionUpdateDto>(defaultNewUpdate);
  const [preview, setPreview] = useState(false);
  const notifyTypeOptions: ActionUpdateNotifyType[] = [
    "none",
    "action_cohort",
    "all_members",
    "tag",
  ];
  const notifyTypeLabels: Record<ActionUpdateNotifyType, string> = {
    none: "No notification",
    action_cohort: "Action cohort members",
    all_members: "All members",
    tag: "Specific tag",
  };
  const shortNotifString = newUpdate.shortNotifString ?? "";
  const isSubmitDisabled =
    !shortNotifString.trim() ||
    (newUpdate.notifyType === "tag" && !newUpdate.tagId);

  const [clearDraftSignal, setClearDraftSignal] = useState(0);

  const handleSubmit = async () => {
    if (isSubmitDisabled) {
      return;
    }

    const response = await actionsCreateUpdateAdmin({
      path: { id: actionId },
      body: newUpdate,
    });

    if (response.response.ok && response.data) {
      setUpdates([...updates, response.data as ActionUpdateDto]);
      setNewUpdate(defaultNewUpdate);
      setPreview(false);
      setClearDraftSignal((x) => x + 1);
    }
  };

  const handleDelete = async (id: number) => {
    const response = await actionsDeleteUpdateAdmin({
      path: { id },
    });
    if (response.response.ok) {
      setUpdates(updates.filter((update) => update.id !== id));
    }
  };

  const handleEdit = async (
    id: number,
    title: string,
    content: CreateEditableContentDto,
  ) => {
    const existingUpdate = updates.find((u) => u.id === id);
    if (!existingUpdate) return;

    const response = await actionsUpdateUpdateAdmin({
      path: { id },
      body: {
        title,
        content,
        date: existingUpdate.date,
        visibleAt: existingUpdate.visibleAt ?? existingUpdate.date,
        notifyType: "none",
        shortNotifString: existingUpdate.shortNotifString ?? "",
      },
    });

    if (response.response.ok && response.data) {
      setUpdates(
        updates.map((u) =>
          u.id === id ? (response.data as ActionUpdateDto) : u,
        ),
      );
    }
  };

  return (
    <div className="space-y-2 flex flex-col">
      <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-950">
        Before writing an update, review the{" "}
        <a
          href="https://docs.google.com/document/d/1vxeA31milcWRhpkGjGWHp1RQbpDFRjS541E9SzdKkFc/edit?tab=t.0#heading=h.l5nuu7lwqdm8"
          target="_blank"
          rel="noreferrer"
          className="font-bold underline"
        >
          Update copy guidelines
        </a>
        .
      </p>
      <div className="flex justify-between items-center">
        <p className="font-bold">Add a status update...</p>
        <label className="flex items-center gap-2">
          <span className="flex flex-col">
            <span className="text-sm font-bold">Preview</span>
            <span className="text-xs text-zinc-600">
              See how this update will appear.
            </span>
          </span>
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => setPreview(e.target.checked)}
          />
        </label>
      </div>
      {preview ? (
        <ActionUpdateCard update={{ ...newUpdate, id: 0, actionId }} />
      ) : (
        <Card className="space-y-2">
          <div className="p-3 bg-zinc-100 rounded-md space-y-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold">Title</span>
              <span className="text-xs text-zinc-600">
                Give the update a short, descriptive heading.
              </span>
              <input
                type="text"
                placeholder="Title..."
                className="w-full p-2 bg-white rounded-md font-bold"
                value={newUpdate.title}
                onChange={(e) => {
                  setNewUpdate({ ...newUpdate, title: e.target.value });
                }}
                required
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">Update body</span>
              <span className="text-xs text-zinc-600">
                Share the full update and add any relevant attachments.
              </span>
              <EditableContentForm
                value={newUpdate.content}
                draftKey={`action-update-${actionId}`}
                clearDraftSignal={clearDraftSignal}
                placeholder="Action update body..."
                onChange={(content) => {
                  setNewUpdate({
                    ...newUpdate,
                    content,
                  });
                }}
              />
            </div>
            <label className="flex flex-col text-sm gap-1">
              <span className="font-bold">Short notification text</span>
              <span className="text-xs text-zinc-600">
                An automatic &quot;Update: &quot; prefix will be added to this
                text.
              </span>
              <input
                type="text"
                className="p-2 rounded-md bg-white text-base"
                placeholder="Notification message"
                value={newUpdate.shortNotifString}
                onChange={(e) =>
                  setNewUpdate({
                    ...newUpdate,
                    shortNotifString: e.target.value,
                  })
                }
                required
              />
            </label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 mt-3">
              <label className="flex flex-col text-sm gap-1">
                <span className="font-bold">Notification audience</span>
                <span className="text-xs text-zinc-600">
                  Choose who should receive a push notification.
                </span>
                <select
                  className="p-2 rounded-md bg-white text-base"
                  value={newUpdate.notifyType}
                  onChange={(e) => {
                    const nextNotifyType = e.target
                      .value as ActionUpdateNotifyType;
                    setNewUpdate({
                      ...newUpdate,
                      notifyType: nextNotifyType,
                      tagId:
                        nextNotifyType === "tag" ? newUpdate.tagId : undefined,
                    });
                  }}
                >
                  {notifyTypeOptions.map((option) => {
                    const label = notifyTypeLabels[option];
                    return (
                      <option key={option} value={option}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="flex flex-col text-sm gap-1">
                <span className="font-bold">Date</span>
                <span className="text-xs text-zinc-600">
                  Set the date and time displayed for this update.
                </span>
                <DateTimePicker
                  value={newUpdate.date}
                  className="bg-white border-none"
                  onChange={(date) => {
                    setNewUpdate({ ...newUpdate, date: date.utcValue ?? "" });
                  }}
                />
              </label>
              {newUpdate.notifyType === "tag" && (
                <label className="flex flex-col text-sm gap-1 md:col-span-2">
                  <span className="font-bold">Target tag</span>
                  <span className="text-xs text-zinc-600">
                    Notify only members assigned to this tag.
                  </span>
                  <select
                    className="p-2 rounded-md bg-white text-base"
                    value={newUpdate.tagId ? String(newUpdate.tagId) : ""}
                    onChange={(e) =>
                      setNewUpdate({
                        ...newUpdate,
                        tagId: e.target.value ? e.target.value : undefined,
                      })
                    }
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
              {events.length > 0 && (
                <label className="flex flex-col text-sm gap-1 md:col-span-2">
                  <span className="font-bold">Associated event (optional)</span>
                  <span className="text-xs text-zinc-600">
                    Link this update to a related action event.
                  </span>
                  <select
                    className="p-2 rounded-md bg-white text-base"
                    value={
                      newUpdate.associatedEventId
                        ? String(newUpdate.associatedEventId)
                        : ""
                    }
                    onChange={(e) => {
                      setNewUpdate({
                        ...newUpdate,
                        associatedEventId: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      });
                    }}
                  >
                    <option value="">No associated event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title} – {new Date(event.date).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </Card>
      )}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          color={ButtonColor.Black}
          disabled={isSubmitDisabled}
        >
          Add update
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-bold">Existing updates</h2>
      </div>
      <div className="space-y-2 bg-white pb-5">
        {updates.map((update) => (
          <ActionUpdateCard
            key={update.id}
            update={update}
            onDelete={() => handleDelete(update.id)}
            onEdit={handleEdit}
            admin
          />
        ))}
      </div>
    </div>
  );
};

export default ActionUpdatesTab;

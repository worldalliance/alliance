import {
  ActionDto,
  actionsCreateUpdate,
  actionsDeleteUpdate,
  ActionUpdateNotifyType,
  CreateActionUpdateDto,
  TagDto,
} from "@alliance/shared/client";
import ActionUpdateCard from "@alliance/shared/ui/ActionUpdateCard";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card from "@alliance/shared/ui/Card";
import DateTimePicker from "@alliance/shared/ui/DateTimePicker";
import EditableContentForm from "@alliance/shared/ui/EditableContentForm";
import { useState } from "react";

interface ActionUpdatesTabProps {
  actionId: number;
  updates: ActionDto["updates"];
  setUpdates: (updates: ActionDto["updates"]) => unknown;
  events: ActionDto["events"];
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

    const response = await actionsCreateUpdate({
      path: { id: actionId },
      body: newUpdate,
    });

    if (response.response.ok && response.data) {
      setUpdates([...updates, response.data]);
      setNewUpdate(defaultNewUpdate);
      setPreview(false);
      setClearDraftSignal((x) => x + 1);
    }
  };

  const handleDelete = async (id: number) => {
    const response = await actionsDeleteUpdate({
      path: { id },
    });
    if (response.response.ok) {
      setUpdates(updates.filter((update) => update.id !== id));
    }
  };

  return (
    <div className="space-y-2 flex flex-col">
      <div className="flex justify-between items-center">
        <p className="font-bold">Add a status update...</p>
        <div className="flex items-center gap-2">
          <label className="text-sm">Preview?</label>
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => setPreview(e.target.checked)}
          />
        </div>
      </div>
      {preview ? (
        <ActionUpdateCard update={{ ...newUpdate, id: 0, actionId }} />
      ) : (
        <Card className="space-y-2">
          <div className="p-2 bg-zinc-100 rounded-md">
            <input
              type="text"
              placeholder="Title..."
              className="w-full p-2 bg-zinc-100 rounded-md font-bold"
              value={newUpdate.title}
              onChange={(e) => {
                setNewUpdate({ ...newUpdate, title: e.target.value });
              }}
              required
            />
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
            <label className="flex flex-col text-sm gap-1">
              <span>Short notification text</span>
              <input
                type="text"
                className="p-2 rounded-md bg-white text-base"
                placeholder="shows in notification bell message"
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
                <span>Notification audience</span>
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
                <span>Date</span>
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
                  <span>Target tag</span>
                  <select
                    className="p-2 rounded-md bg-white text-base"
                    value={newUpdate.tagId ? String(newUpdate.tagId) : ""}
                    onChange={(e) =>
                      setNewUpdate({
                        ...newUpdate,
                        tagId: e.target.value
                          ? Number(e.target.value)
                          : undefined,
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
                  <span>Associated event (optional)</span>
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
            admin
          />
        ))}
      </div>
    </div>
  );
};

export default ActionUpdatesTab;

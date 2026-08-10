import {
  ActionEventDto,
  actionsCreateUpdateAdmin,
  actionsDeleteUpdateAdmin,
  ActionUpdateDto,
  ActionUpdateNotifyType,
  CreateActionUpdateDto,
  TagDto,
} from "@alliance/shared/client";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import { EyeOff, SquarePen } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ACTION_UPDATE_NOTIFY_TYPE_LABELS,
  ACTION_UPDATE_NOTIFY_TYPES,
} from "../lib/actionUpdateNotifyTypes";

interface ActionUpdatesTabProps {
  actionId: number;
  updates: ActionUpdateDto[];
  setUpdates: (updates: ActionUpdateDto[]) => unknown;
  events: ActionEventDto[];
  availableTags: TagDto[];
}

const defaultNewUpdate: CreateActionUpdateDto = {
  title: "",
  date: new Date().toISOString(),
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
  const navigate = useNavigate();
  const [newUpdate, setNewUpdate] =
    useState<CreateActionUpdateDto>(defaultNewUpdate);

  const shortNotifString = newUpdate.shortNotifString ?? "";
  const isSubmitDisabled =
    !newUpdate.title.trim() ||
    !shortNotifString.trim() ||
    (newUpdate.notifyType === "tag" && !newUpdate.tagId);

  const handleSubmit = async () => {
    if (isSubmitDisabled) {
      return;
    }

    const response = await actionsCreateUpdateAdmin({
      path: { id: actionId },
      body: newUpdate,
    });

    if (response.response.ok && response.data) {
      setUpdates([...updates, response.data]);
      setNewUpdate(defaultNewUpdate);
      navigate(`/actions/${actionId}/updates/${response.data.id}`);
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
      <p className="font-bold">Add a status update...</p>
      <Card className="space-y-2">
        <div className="p-3 bg-zinc-100 rounded-md space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">Title</span>
            <span className="text-xs text-zinc-600">
              Give the update a short, descriptive heading. You&apos;ll write
              the body in the block editor after creating it, and send the
              notification from there once it&apos;s written.
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
                Who to notify. Nothing is sent until you send it from the
                editor.
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
                {ACTION_UPDATE_NOTIFY_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {ACTION_UPDATE_NOTIFY_TYPE_LABELS[option]}
                  </option>
                ))}
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
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          color={ButtonColor.Black}
          disabled={isSubmitDisabled}
        >
          Create and write content
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
            actions={
              <>
                {!update.visibleAt && (
                  <span
                    className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                    title="Not visible to members until its content is saved"
                  >
                    <EyeOff className="w-3 h-3" aria-hidden />
                    Draft
                  </span>
                )}
                <Link
                  to={`/actions/${actionId}/updates/${update.id}`}
                  title="Edit update"
                  aria-label="Edit update"
                  className="text-zinc-500 hover:text-zinc-900"
                >
                  <SquarePen className="w-4 h-4" />
                </Link>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
};

export default ActionUpdatesTab;

import { ActionEventDto, UpdateActionEventDto } from "@alliance/shared/client";
import { formatDateTimeWithZone } from "@alliance/shared/lib/dateFormatters";
import { useState } from "react";
import Button, { ButtonColor } from "../ui/Button";
import Card from "../ui/Card";
import DateTimePicker from "../ui/DateTimePicker";

export type SuiteEventCardProps = {
  event: ActionEventDto;
  onEdit: (body: UpdateActionEventDto) => void;
  onDelete: (eventId: number) => void;
};

const FIELD =
  "mt-1 mb-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal";

const SuiteEventCard = ({ event, onEdit, onDelete }: SuiteEventCardProps) => {
  const [editing, setEditing] = useState(false);
  const [editingValues, setEditingValues] = useState<ActionEventDto>(event);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleEdit = () => {
    setEditing(true);
    setEditingValues(event);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditingValues(event);
  };

  const handleSave = () => {
    onEdit(editingValues);
    setEditing(false);
  };

  const handleDelete = () => {
    onDelete(event.id);
    setConfirmingDelete(false);
  };

  const handleConfirmDelete = () => {
    setConfirmingDelete(true);
  };

  const handleCancelDelete = () => {
    setConfirmingDelete(false);
  };

  return (
    <Card className="relative">
      {editing ? (
        <div className="sm:min-w-64">
          <label className="block text-sm font-medium">
            Title
            <input
              type="text"
              className={FIELD}
              value={editingValues.title}
              onChange={(e) =>
                setEditingValues({ ...editingValues, title: e.target.value })
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Description
            <input
              type="text"
              className={FIELD}
              value={editingValues.description}
              onChange={(e) =>
                setEditingValues({
                  ...editingValues,
                  description: e.target.value,
                })
              }
            />
          </label>
          <DateTimePicker
            id={`suite-event-${event.id}-date`}
            label="Date"
            showTimezoneHint
            value={editingValues.date}
            onChange={(date) =>
              setEditingValues({ ...editingValues, date: date.utcValue! })
            }
          />
          <div className="flex flex-row gap-2 mt-2">
            <Button color={ButtonColor.Black} onClick={handleSave}>
              Save
            </Button>
            <Button color={ButtonColor.White} onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2 p-4 -m-4 bg-zinc-100 -mb-1">
            <p className="font-bold">{event.title}</p>
          </div>
          <p>{event.description}</p>
          <p>{formatDateTimeWithZone(new Date(event.date))}</p>
          <div className="flex flex-row gap-2">
            <Button color={ButtonColor.Black} onClick={handleEdit}>
              Edit for all
            </Button>
            <Button color={ButtonColor.Red} onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}
      {confirmingDelete && (
        <div className="absolute bg-white/60 backdrop-blur-sm top-0 left-0 w-full h-full flex flex-col gap-2 items-center justify-center">
          <p>Delete for all suite actions?</p>
          <div className="flex flex-row gap-2">
            <Button color={ButtonColor.White} onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button color={ButtonColor.Red} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default SuiteEventCard;

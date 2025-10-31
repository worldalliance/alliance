import { ActionEventDto, UpdateActionEventDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card from "@alliance/shared/ui/Card";
import DateTimePicker from "@alliance/shared/ui/DateTimePicker";
import { formatDate } from "date-fns";
import { useState } from "react";

export type SuiteEventCardProps = {
  event: ActionEventDto;
  onEdit: (body: UpdateActionEventDto) => void;
  onDelete: (eventId: number) => void;
};

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
        <div>
          <input
            type="text"
            value={editingValues.title}
            onChange={(e) =>
              setEditingValues({ ...editingValues, title: e.target.value })
            }
          />
          <input
            type="text"
            value={editingValues.description}
            onChange={(e) =>
              setEditingValues({
                ...editingValues,
                description: e.target.value,
              })
            }
          />
          <DateTimePicker
            value={editingValues.date}
            onChange={(date) =>
              setEditingValues({ ...editingValues, date: date.utcValue! })
            }
          />
          <div className="flex flex-row gap-2 mt-2">
            <Button color={ButtonColor.Black} onClick={handleSave}>
              Save
            </Button>
            <Button color={ButtonColor.Black} onClick={handleCancel}>
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
          <p>{formatDate(event.date, "MM/dd/yyyy hh:mm a")}</p>
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
            <Button color={ButtonColor.Black} onClick={handleCancelDelete}>
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

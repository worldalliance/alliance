import { href, Link } from "react-router";
import {
  ActionUpdateDto,
  CreateEditableContentDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "./Button";
import EditableContentForm from "./EditableContentForm";
import EditableContentRenderer from "./EditableContentRenderer";
import { useState } from "react";

export interface ActionUpdateItemProps {
  update: ActionUpdateDto;
  onDelete?: () => void;
  onEdit?: (
    id: number,
    title: string,
    content: CreateEditableContentDto
  ) => Promise<void>;
  admin?: boolean;
}

const ActionUpdateItem = ({ update, onEdit }: ActionUpdateItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(update.title);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>(
    update.content
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onEdit) return;
    setIsSaving(true);
    try {
      await onEdit(update.id, editTitle, editContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(update.title);
    setEditContent(update.content);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col border border-zinc-200 rounded divide-y divide-zinc-200 overflow-hidden">
        <div className="p-3 md:p-5 w-full gap-y-1 bg-zinc-50">
          <input
            type="text"
            className="w-full p-2 bg-white rounded-md font-medium border border-zinc-300"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title..."
          />
        </div>
        <div className="p-3 md:p-5 w-full bg-white">
          <EditableContentForm
            value={editContent}
            onChange={setEditContent}
            placeholder="Update body..."
          />
        </div>
        <div className="p-3 md:p-5 w-full bg-zinc-50 flex gap-2 justify-end">
          <Button onClick={handleCancel} color={ButtonColor.Light} size="small">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            color={ButtonColor.Black}
            size="small"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3">
        <span className="">Update on </span>
        <Link
          className="font-medium text-link"
          to={href("/actions/:id", { id: update.actionId.toString() })}
        >
          {update.actionName}:{" "}
        </Link>
        <span>{update.title}</span>
      </div>
      {!!update.content.body && (
        <div className="gap-y-1">
          <EditableContentRenderer content={update.content} smallImages />
        </div>
      )}
    </div>
  );
};

export default ActionUpdateItem;

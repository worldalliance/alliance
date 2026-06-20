import { Link } from "react-router";
import {
  ActionStatus,
  ActionUpdateDto,
  CreateEditableContentDto,
} from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { readableActionStatus } from "@alliance/shared/lib/actionStatus";
import Button, { ButtonColor } from "./Button";
import EditableContentForm from "./EditableContentForm";
import EditableContentRenderer from "./EditableContentRenderer";
import DatabaseIcon from "./icons/DatabaseIcon";
import { useState } from "react";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { useOptionalNotifications } from "@alliance/shared/lib/useNotifications";
import { cn } from "@alliance/shared/styles/util";

export interface ActionUpdateCardProps {
  update: ActionUpdateDto;
  onDelete?: () => void;
  onEdit?: (
    id: number,
    title: string,
    content: CreateEditableContentDto,
  ) => Promise<void>;
  admin?: boolean;
  onActionPageTimeline?: boolean;
  border?: boolean;
  // Render without card chrome, formatted to match the timeline event items.
  plain?: boolean;
  // (plain only) status of the associated event — shown as the kicker.
  status?: ActionStatus;
  // (plain only) the most recent entry in the timeline (its kicker is green).
  highlighted?: boolean;
}

const ActionUpdateCard = ({
  update,
  onDelete,
  onEdit,
  admin = false,
  onActionPageTimeline = true, // if not on action page timeline, need to have action title and link
  border = false,
  plain = false,
  status,
  highlighted = false,
}: ActionUpdateCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(update.title);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>(
    update.content,
  );
  const [isSaving, setIsSaving] = useState(false);
  const notifications = useOptionalNotifications();

  useMarkUnreadContentRead({
    contentType: "action_update",
    contentIds: [update.id],
    enabled: !!notifications,
    onMarked: (contentType, contentIds) => {
      notifications?.applyNotificationsReadByContent(contentType, contentIds);
    },
  });

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

  if (plain) {
    // Kicker text = the associated status label (e.g. "Office action"), or a plain
    // "Update" when standalone or attached to member action. The most recent
    // entry's kicker is green; others grey.
    const kicker = {
      text:
        status && status !== "member_action"
          ? readableActionStatus[status]
          : "Update",
      className: highlighted ? "text-green" : "text-zinc-400",
    };

    return (
      <div className="flex flex-col gap-y-1.5">
        <div className="flex items-baseline gap-x-3 text-sm">
          {onActionPageTimeline && (
            <span className={cn("font-semibold", kicker.className)}>
              {kicker.text}
            </span>
          )}
          <span className="ml-auto shrink-0 whitespace-nowrap font-medium text-zinc-400">
            {formatTime(new Date(update.date), { addSuffix: true })}
          </span>
        </div>
        <h3 className="font-serif text-lg leading-snug font-semibold tracking-tight text-zinc-900 md:text-xl">
          {update.title}
        </h3>
        {!onActionPageTimeline && (
          <Link to={`/actions/${update.actionId}`}>
            <p className="text-link">{update.actionName}</p>
          </Link>
        )}
        {!!update.content.body && (
          <div className="mt-1 text-zinc-600 leading-relaxed">
            <EditableContentRenderer content={update.content} className="" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded overflow-hidden">
      <div
        className={cn(
          "px-4 py-3 sm:py-4 sm:px-6 w-full gap-y-1  border-b border-zinc-200",
          border ? "bg-gray-1 border border-b-0 border-zinc-200" : " bg-white",
        )}
      >
        <div className="flex flex-col">
          <div className="flex flex-col md:flex-row md:gap-x-2 items-start">
            <p className="font-semibold">
              {onActionPageTimeline && (
                <span className="text-green">Update: </span>
              )}

              {update.title}
            </p>

            {admin && (
              <Link to={`/database?table=action_update&id=${update.id}`}>
                <DatabaseIcon size="small" />
              </Link>
            )}

            <p className="text-zinc-500 whitespace-nowrap">
              {formatTime(new Date(update.date), {
                addSuffix: true,
              })}
            </p>

            {onEdit && (
              <Button
                onClick={() => setIsEditing(true)}
                color={ButtonColor.Light}
                size="small"
              >
                Edit
              </Button>
            )}

            {onDelete && (
              <Button onClick={onDelete} color={ButtonColor.Black} size="small">
                Delete
              </Button>
            )}
          </div>
          {!onActionPageTimeline && (
            <Link to={`/actions/${update.actionId}`}>
              <p className="text-link">{update.actionName}</p>
            </Link>
          )}
        </div>
      </div>
      {!!update.content.body && (
        <div
          className={cn(
            "p-4 md:p-6 w-full gap-y-1 bg-white",
            border && "border border-zinc-200",
          )}
        >
          <EditableContentRenderer content={update.content} className="" />
        </div>
      )}
    </div>
  );
};

export default ActionUpdateCard;

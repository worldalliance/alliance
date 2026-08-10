import { readDisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { ActionUpdateDto } from "@alliance/shared/client";
import { useOptionalNotifications } from "@alliance/shared/lib/useNotifications";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { useMemo } from "react";
import { Link } from "react-router";
import DisplayOnlyRenderer from "../forms/DisplayOnlyRenderer";
import Button, { ButtonColor } from "./Button";

export interface ActionUpdateCardProps {
  update: ActionUpdateDto;
  onDelete?: () => void;
  actions?: React.ReactNode;
  onActionPageTimeline?: boolean;
  border?: boolean;
}

const ActionUpdateCard = ({
  update,
  onDelete,
  actions,
  onActionPageTimeline = true, // if not on action page timeline, need to have action title and link
  border = false,
}: ActionUpdateCardProps) => {
  const notifications = useOptionalNotifications();
  const schema = useMemo(
    () => readDisplayOnlySchema(update.schema),
    [update.schema],
  );

  useMarkUnreadContentRead({
    contentType: "action_update",
    contentIds: [update.id],
    enabled: !!notifications,
    onMarked: (contentType, contentIds) => {
      notifications?.applyNotificationsReadByContent(contentType, contentIds);
    },
  });

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

            <p className="text-zinc-500 whitespace-nowrap">
              {formatTime(new Date(update.date), {
                addSuffix: true,
              })}
            </p>

            {actions}

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
      {schema?.blocks.length !== 0 && (
        <div
          className={cn(
            "p-4 md:p-6 w-full gap-y-1 bg-white",
            border && "border border-zinc-200",
          )}
        >
          <DisplayOnlyRenderer schema={schema} />
        </div>
      )}
    </div>
  );
};

export default ActionUpdateCard;

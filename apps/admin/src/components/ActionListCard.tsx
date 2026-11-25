import { ActionDto } from "@alliance/shared/client";
import { formatDateTimeWithZone } from "@alliance/shared/lib/dateFormatters";
import { cn } from "@alliance/shared/styles/util";
import { Link } from "react-router";
import { ACTION_STATUS_LABELS } from "../lib/actionStatusDisplay";
import { getLastPastEventDate } from "../pages/Actions";
import ActionProgressBar from "./ActionProgressBar";

export interface ActionListCardProps {
  action: Pick<
    ActionDto,
    | "id"
    | "name"
    | "archived"
    | "events"
    | "status"
    | "shortDescription"
    | "usersJoined"
    | "usersCompleted"
    | "optional"
  >;
}

const ActionListCard = ({ action }: ActionListCardProps) => {
  const lastEventDate = getLastPastEventDate(action);
  return (
    <div className="p-4 group">
      <Link to={`/tasks/${action.id}`} className="relative block">
        <div className="flex justify-between mb-2 ">
          <div className="flex flex-row items-center gap-x-2">
            {action?.archived && (
              <span className="px-2 py-1 rounded-sm bg-zinc-200 text-zinc-700 text-xs">
                Archived
              </span>
            )}
            <h2 className="font-bold text-sm">{action.name}</h2>
            {lastEventDate && (
              <p className="text-sm text-zinc-500">
                Last event {formatDateTimeWithZone(lastEventDate)}
              </p>
            )}
          </div>
          <div className="flex flex-row items-center gap-x-2 -my-2">
            <span
              className={cn(
                "p-2 right-0 top-0 text-zinc-800 font-medium text-xs rounded-sm text-nowrap border-zinc-200 border",
                action.status === "member_action"
                  ? "bg-green/20"
                  : "bg-zinc-50",
              )}
            >
              {ACTION_STATUS_LABELS[action.status]}
            </span>
            {action.optional && (
              <span className="p-2 rounded-sm border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800">
                Optional
              </span>
            )}
          </div>
        </div>
        <p className="text-xs">{action.shortDescription}</p>

        <ActionProgressBar
          status={action.status}
          usersJoined={action.usersJoined}
          usersCompleted={action.usersCompleted}
          className="mt-2"
        />
      </Link>
    </div>
  );
};

export default ActionListCard;

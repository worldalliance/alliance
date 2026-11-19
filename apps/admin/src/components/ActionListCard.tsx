import { ActionDto } from "@alliance/shared/client";
import { formatDateTimeWithZone } from "@alliance/shared/lib/dateFormatters";
import { Link } from "react-router";
import { StatusTone } from "../lib/statusTone";
import { getLastPastEventDate } from "../pages/Actions";
import ActionProgressBar from "./ActionProgressBar";
import StatusPill, { ActionStatusPill } from "./ui/StatusPill";

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
      <Link to={`/actions/${action.id}`} className="relative block">
        <div className="flex justify-between mb-2 ">
          <div className="flex flex-row items-center gap-x-2">
            {action.archived && (
              <StatusPill tone={StatusTone.Neutral} label="Archived" />
            )}
            <h3 className="font-semibold text-sm">{action.name}</h3>
            {lastEventDate && (
              <p className="text-sm text-zinc-500">
                Last event {formatDateTimeWithZone(lastEventDate)}
              </p>
            )}
          </div>
          <div className="flex flex-row items-center gap-x-2">
            <ActionStatusPill status={action.status} />
            {action.optional && (
              <StatusPill tone={StatusTone.Neutral} label="Optional" />
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

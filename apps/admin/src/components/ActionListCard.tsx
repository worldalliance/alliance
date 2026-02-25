import { ActionDto } from "@alliance/shared/client";
import ActionProgressBar from "./ActionProgressBar";
import { getLastPastEventDate } from "../pages/Actions";
import { useCallback } from "react";
import { useNavigate } from "react-router";

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
    | "commitmentThreshold"
    | "type"
    | "donationAmount"
    | "optional"
  >;
}

const ActionListCard = ({ action }: ActionListCardProps) => {
  const navigate = useNavigate();
  const handleEditAction = useCallback(
    (id: number) => {
      navigate(`/actions/${id}`);
    },
    [navigate]
  );

  const lastEventDate = getLastPastEventDate(action);
  return (
    <div key={action.id} className="p-4 group">
      <div
        onClick={() => handleEditAction(action.id)}
        className="cursor-pointer relative"
      >
        <div className="flex justify-between mb-2 ">
          <div className="flex flex-row items-center gap-x-2">
            {action?.archived && (
              <span className="px-2 py-1 rounded-sm bg-red-200 text-xs">
                Archived
              </span>
            )}
            <h2 className="font-bold text-sm">{action.name}</h2>
            {lastEventDate && (
              <p className="text-sm text-zinc-500">
                Last event {lastEventDate.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-row items-center gap-x-2 -my-2">
            <span
              className={`p-2 right-0 top-0 text-zinc-800 
                            font-medium text-xs rounded-sm text-nowrap border-zinc-200 border
                            ${
                              action.status === "member_action"
                                ? "bg-green/20"
                                : "bg-zinc-50"
                            }`}
            >
              {action.status}
            </span>
            {action.optional && (
              <span className="p-2 bg-blue-500 rounded-sm text-xs text-white">
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
          commitmentThreshold={action.commitmentThreshold}
          actionType={action.type}
          donationAmount={action.donationAmount}
          className="mt-2"
        />
      </div>
    </div>
  );
};

export default ActionListCard;

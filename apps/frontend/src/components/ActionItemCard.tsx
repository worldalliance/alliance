import { ActionActivityDto } from "@alliance/shared/client/types.gen";
import React from "react";
import { Link } from "react-router";
import { ActionWithRelation } from "../applayout";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";

export interface ActionItemCardProps {
  action: Pick<
    ActionWithRelation,
    | "name"
    | "shortDescription"
    | "category"
    | "id"
    | "status"
    | "relation"
    | "commitmentThreshold"
    | "everyoneShouldComplete"
    | "usersJoined"
    | "usersCompleted"
  >;
  className?: string;
  friendCommitmentActivities?: ActionActivityDto[];
  showDescription?: boolean;
  activity?: ActionActivityDto;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  className,
  friendCommitmentActivities,
}) => {
  return (
    <Link
      to={`/actions/${action.id}`}
      className={`relative ${className} p-4 hover:bg-zinc-50`}
    >
      <div className="flex flex-row items-start gap-x-8">
        <div className="flex-1 flex flex-col">
          <div className="flex flex-row items-center justify-between gap-x-2 mb-2">
            <p className="font-medium text-black">{action.name}</p>
            {action.relation === "completed" && <CheckIcon size="mini" />}
          </div>
          <p className="text-zinc-500">{action.shortDescription}</p>
        </div>
      </div>
      {(action.status === "member_action" ||
        action.status === "gathering_commitments") &&
        !action.everyoneShouldComplete && (
          <ActionCompletedBarWithInfo
            action={action}
            friendActivities={friendCommitmentActivities ?? null}
            className="mt-4"
          />
        )}
    </Link>
  );
};

export default ActionItemCard;

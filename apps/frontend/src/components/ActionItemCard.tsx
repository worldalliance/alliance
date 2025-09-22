import { ActionActivityDto } from "@alliance/shared/client/types.gen";
import React from "react";
import { Link } from "react-router";
import { ActionWithRelation } from "../applayout";
import CompletedBar from "./CompletedBar";
import Tag, { TagStyle } from "./Tag";
import UserProfilePicRow from "./UserProfilePicRow";

export interface ActionItemCardProps
  extends Pick<
    ActionWithRelation,
    "name" | "shortDescription" | "category" | "id" | "status" | "relation"
  > {
  className?: string;
  joinedCount?: number;
  neededCount?: number;
  friendCommitmentActivities?: ActionActivityDto[];
  showDescription?: boolean;
  activity?: ActionActivityDto;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  name,
  id,
  shortDescription,
  className,
  joinedCount,
  neededCount,
  friendCommitmentActivities = [],
  activity,
  relation,
}) => {
  return (
    <Link
      to={`/actions/${id}`}
      className={`relative ${className} p-4 hover:bg-zinc-50 transition-colors duration-150`}
    >
      <div className="flex flex-row items-start gap-x-8">
        <div className="flex-1 flex flex-col">
          <div className="flex flex-row items-center justify-between gap-x-2 mb-2">
            <p className="font-medium text-black">{name}</p>
            {relation === "completed" && (
              <Tag style={TagStyle.Green} className="text-green font-medium">
                Completed
              </Tag>
            )}
          </div>
          <p className="text-zinc-500">{shortDescription}</p>
        </div>
      </div>
      {activity && joinedCount && neededCount && (
        <div className="mt-6">
          <div className="flex flex-row items-center justify-between w-full gap-x-2">
            <p className="text-zinc-500 text-base mb-0.5">
              {joinedCount} / {neededCount} committed
              {friendCommitmentActivities.length > 0 && (
                <>
                  , including {friendCommitmentActivities.length} friend
                  {friendCommitmentActivities.length === 1 ? "" : "s"}
                </>
              )}
            </p>
            <UserProfilePicRow
              users={friendCommitmentActivities.map(
                (activity) => activity.user
              )}
            />
          </div>
          <CompletedBar percentage={(joinedCount / neededCount) * 100} />
        </div>
      )}
    </Link>
  );
};

export default ActionItemCard;

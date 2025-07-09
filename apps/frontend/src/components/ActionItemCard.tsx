import React from "react";
import Card, { CardStyle } from "./system/Card";
import { useNavigate } from "react-router";
import { ActionDto } from "@alliance/shared/client/types.gen";
import ActionCardUserCount from "./ActionCardUserCount";

export interface ActionItemCardProps
  extends Pick<ActionDto, "name" | "shortDescription" | "category" | "id"> {
  className?: string;
  joinedCount?: number;
  completedCount?: number;
  showDescription?: boolean;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  name,
  id,
  shortDescription,
  className,
  joinedCount,
  completedCount,
  showDescription = true,
}) => {
  const navigate = useNavigate();

  return (
    <div className={`relative ${className}`}>
      <Card
        className="block shadow text-[11pt] "
        style={CardStyle.White}
        onClick={() => navigate(`/actions/${id}`)}
      >
        {/* <Badge>{category}</Badge> */}
        <div className="w-[100%] space-x-3">
          <div className="flex flex-row justify-between items-start mr-0">
            <p className="font-medium">{name}</p>
            {joinedCount !== undefined && (
              <ActionCardUserCount
                joined={joinedCount}
                completed={completedCount}
              />
            )}
          </div>
          {showDescription && (
            <p className="text-zinc-400">{shortDescription}</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ActionItemCard;

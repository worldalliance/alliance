import React from "react";
import Card, { CardStyle } from "./system/Card";
import { useNavigate } from "react-router";
import { ActionDto } from "@alliance/shared/client/types.gen";
import ActionCardUserCount from "./ActionCardUserCount";

export interface ActionItemCardProps
  extends Pick<ActionDto, "name" | "shortDescription" | "category" | "id"> {
  className?: string;
  liveCount?: number;
  showDescription?: boolean;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  name,
  id,
  shortDescription,
  className,
  liveCount,
  showDescription = true,
}) => {
  const navigate = useNavigate();

  return (
    <div className={`relative ${className}`}>
      <Card
        className="block bg-pagebg text-[11pt] font-avenir"
        style={CardStyle.White}
        onClick={() => navigate(`/actions/${id}`)}
      >
        {liveCount !== undefined && <ActionCardUserCount count={liveCount} />}
        {/* <Badge>{category}</Badge> */}
        <div className="w-[100%] space-x-3">
          <p className="font-avenir font-bold">{name}</p>
          {showDescription && (
            <p className="text-gray-500">{shortDescription}</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ActionItemCard;

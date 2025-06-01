import React from "react";
import Badge from "./system/Badge";
import Card, { CardStyle } from "./system/Card";
import { useNavigate } from "react-router-dom";
import { ActionDto } from "@alliance/shared/client/types.gen";

export interface ActionItemCardProps
  extends Pick<ActionDto, "name" | "description" | "category" | "id"> {
  className?: string;
  liveCount?: number;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  name,
  id,
  description,
  category,
  className,
  liveCount,
}) => {
  const navigate = useNavigate();

  return (
    <div className={`relative ${className}`}>
      <Card
        className="block bg-pagebg text-[11pt] font-avenir"
        style={CardStyle.White}
        onClick={() => navigate(`/action/${id}`)}
      >
        <div className="flex items-center justify-start w-[100%] space-x-3">
          <p className="font-bold">{name}</p>
          <Badge>{category}</Badge>
        </div>
        {liveCount !== undefined && <p>Count: {liveCount}</p>}
        <div className="flex items-center justify-between ">
          <p>{description}</p>
        </div>
      </Card>
    </div>
  );
};

export default ActionItemCard;

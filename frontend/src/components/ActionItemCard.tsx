import React from "react";
import Badge from "./system/Badge";
import Card from "./system/Card";
import Button, { ButtonColor } from "./system/Button";
import { useNavigate } from "react-router-dom";

interface ActionItemCardProps {
  title: string;
  description: string;
  category: string;
  className?: string;
  actions: ActionCardAction[];
  onClick?: () => void;
}

export enum ActionCardAction {
  Complete = "Complete",
  Discuss = "Discuss",
  Details = "Details",
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  title,
  description,
  category,
  actions,
  onClick,
  className,
}) => {
  const navigate = useNavigate();

  return (
    <div className={`relative ${className}`}>
      {/* <StatusIndicator status={Status.InProgress} /> */}
      <Card className="block bg-pagebg text-[11pt] font-avenir">
        <div className="flex items-center justify-start w-[100%] space-x-3">
          <p className="font-bold">{title}</p>
          <Badge>{category}</Badge>
        </div>
        <div className="flex items-center justify-between ">
          <p>{description}</p>
        </div>
        <div className="flex items-center justify-end">
          {actions.map((action) => (
            <Button
              color={ButtonColor.Transparent}
              key={action}
              label={action}
              onClick={() => {
                onClick ? onClick() : navigate(`/action/${title}`);
              }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ActionItemCard;

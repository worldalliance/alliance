import React from "react";
import Badge from "./system/Badge";
import Card from "./system/Card";
import Button, { ButtonColor } from "./system/Button";
interface ActionItemCardProps {
  title: string;
  description: string;
  category: string;
  actions: ActionCardAction[];
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
}) => {
  return (
    <Card className="block bg-stone-50 mb-2.5 max-w-[600px] space-y-2 text-[11pt] font-avenir">
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
            onClick={() => {}}
          />
        ))}
      </div>
    </Card>
  );
};

export default ActionItemCard;

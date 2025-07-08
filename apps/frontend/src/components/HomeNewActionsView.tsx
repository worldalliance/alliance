import React from "react";
import { ActionDto } from "@alliance/shared/client";
import ActionItemCard from "./ActionItemCard";

export interface HomeNewActionsViewProps {
  actions: ActionDto[];
}

export const HomeNewActionsView: React.FC<HomeNewActionsViewProps> = ({
  actions,
}: HomeNewActionsViewProps) => {
  if (actions.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-gray-700 pl-4">
        <span className="font-bold">
          Awaiting Commitment ({actions.length})
        </span>
      </p>
      {actions.map((action) => (
        <ActionItemCard key={action.id} {...action} />
      ))}
    </div>
  );
};

export default HomeNewActionsView;

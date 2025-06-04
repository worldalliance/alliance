import React from "react";
import { ActionDto } from "@alliance/shared/client";
import ActionItemCard from "./ActionItemCard";
export interface HomeNewActionsViewProps {
  actions: ActionDto[];
}

export const HomeNewActionsView: React.FC<HomeNewActionsViewProps> = ({
  actions: initialActions,
}: HomeNewActionsViewProps) => {
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row items-center gap-x-2 justify-between w-full">
        <p className="text-gray-600 text-lg">Actions needing commitment</p>
      </div>
      {initialActions.map((action) => (
        <ActionItemCard key={action.id} {...action} />
      ))}
      {initialActions.length === 0 && (
        <p className="rounded border border-gray-200 text-center text-gray-500 py-5">
          No actions need your attention right now!
        </p>
      )}
    </div>
  );
};

export default HomeNewActionsView;

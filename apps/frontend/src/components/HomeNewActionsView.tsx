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
      <p className="text-gray-700 text-lg">
        <span className="font-bold text-black">
          {initialActions.length} actions awaiting your commitment
        </span>
      </p>
      {initialActions.map((action) => (
        <ActionItemCard key={action.id} {...action} />
      ))}
      {initialActions.length === 0 && (
        <p className="rounded border border-gray-200 text-center text-gray-500 !py-5">
          No new actions to commit to
        </p>
      )}
    </div>
  );
};

export default HomeNewActionsView;

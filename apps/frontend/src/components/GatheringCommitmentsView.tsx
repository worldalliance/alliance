import React from "react";
import { ActionDto } from "@alliance/shared/client";
import ActionItemCard from "./ActionItemCard";

export interface GatheringCommitmentsViewProps {
  actions: ActionDto[];
}

export const GatheringCommitmentsView: React.FC<
  GatheringCommitmentsViewProps
> = ({ actions }: GatheringCommitmentsViewProps) => {
  if (actions.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-y-4">
      <div className="my-2 pl-4">
        <span className="font-bold">
          Still gathering commitments from other members ({actions.length})
        </span>
      </div>
      {actions.map((action) => (
        <ActionItemCard key={action.id} {...action} showDescription={false} />
      ))}
    </div>
  );
};

export default GatheringCommitmentsView;

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
    <div className="flex flex-col gap-y-2">
      <div className="my-2">
        <span className=" text-black text-lg">
          {actions.length} action{actions.length === 1 ? "" : "s"} you&apos;ve
          committed to still gathering commitments from other members
        </span>
        <p className="text-gray-500 text-lg ">(no action needed right now)</p>
      </div>
      {actions.map((action) => (
        <ActionItemCard key={action.id} {...action} showDescription={false} />
      ))}
    </div>
  );
};

export default GatheringCommitmentsView;

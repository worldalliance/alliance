import React from "react";
import { alliancePriorities } from "../lib/alliancePriorities";
import ExamplePriorityCard from "./ExamplePriorityCard";

interface ExamplePriorityCardListProps {
  bgColor?: "grey" | "white";
  dropdown?: boolean;
  titleClass?: string;
}

const ExamplePriorityCardList: React.FC<ExamplePriorityCardListProps> = ({
  bgColor = "grey",
  dropdown = false,
  titleClass = "",
}: ExamplePriorityCardListProps) => {
  return (
    <div className="flex flex-col gap-y-2">
      {alliancePriorities.map((priority) => (
        <ExamplePriorityCard
          bgColor={bgColor}
          key={priority.id}
          id={priority.id}
          title={priority.title}
          description={priority.description}
          dropdown={dropdown}
          titleClass={titleClass}
        />
      ))}
    </div>
  );
};

export default ExamplePriorityCardList;

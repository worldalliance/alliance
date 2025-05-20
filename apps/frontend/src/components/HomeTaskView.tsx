import { ActionDto } from "@alliance/shared/client";
import TaskCard from "./TaskCard";

export interface HomeTaskViewProps {
  actions: ActionDto[];
}

export const HomeTaskView: React.FC<HomeTaskViewProps> = ({ actions }) => {
  return (
    <div className="flex flex-col gap-y-2">
      {actions.map((action) => (
        <TaskCard key={action.id} />
      ))}
    </div>
  );
};

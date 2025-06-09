import { ActionDto } from "@alliance/shared/client";
import TaskCard from "./TaskCard";
import { useCallback } from "react";

export interface HomeTaskViewProps {
  actions: ActionDto[];
  onTaskComplete?: (actionId: number) => void;
}

export const HomeTaskView: React.FC<HomeTaskViewProps> = ({
  actions: initialActions,
  onTaskComplete,
}: HomeTaskViewProps) => {
  const handleTaskComplete = useCallback(
    (actionId: number) => {
      if (onTaskComplete) {
        onTaskComplete(actionId);
      }
    },
    [onTaskComplete]
  );

  return (
    <div className="flex flex-col gap-y-2">
      <p className="text-gray-600 text-lg">Actions to complete</p>
      {initialActions.map((action) => (
        <TaskCard
          key={action.id}
          action={action}
          onComplete={() => handleTaskComplete(action.id)}
        />
      ))}
      {initialActions.length === 0 && (
        <p className="rounded border border-gray-200 text-center text-gray-500 py-5">
          Nothing to do right now!
        </p>
      )}
    </div>
  );
};

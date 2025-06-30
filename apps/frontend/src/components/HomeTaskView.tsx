import { ActionDto } from "@alliance/shared/client";
import TaskCard from "./TaskCard";
import { useCallback } from "react";

export interface HomeTaskViewProps {
  actions: ActionDto[];
  onTaskComplete?: (actionId: number) => void;
}

export const HomeTaskView: React.FC<HomeTaskViewProps> = ({
  actions,
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
    <div className="flex flex-col gap-y-4">
      {actions.length > 0 ? (
        <p className="text-gray-700 text-lg">
          <span className="font-bold text-black">
            {actions.length} action(s) you committed to are awaiting completion.
          </span>{" "}
          These actions have reached their commitment threshold, so are now
          being completed by all committed members.
        </p>
      ) : (
        <p className="text-gray-600 text-lg">No actions to complete.</p>
      )}
      {actions.map((action) => (
        <TaskCard
          key={action.id}
          action={action}
          onComplete={() => handleTaskComplete(action.id)}
        />
      ))}
      {actions.length === 0 && (
        <p className="rounded border border-gray-200 text-center text-gray-500 py-5">
          Nothing to do right now!
        </p>
      )}
    </div>
  );
};

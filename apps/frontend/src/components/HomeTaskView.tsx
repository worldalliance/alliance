import { ActionDto } from "@alliance/shared/client";
import TaskCard from "./TaskCard";
import Button from "./system/Button";
import { ButtonColor } from "./system/Button";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

export interface HomeTaskViewProps {
  actions: ActionDto[];
  onTaskComplete?: (actionId: number) => void;
}

export const HomeTaskView: React.FC<HomeTaskViewProps> = ({
  actions: initialActions,
  onTaskComplete,
}) => {
  const navigate = useNavigate();

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
      <div className="flex flex-row items-center gap-x-2 justify-between w-full mb-3">
        <h1 className="text-[#111] !text-[16pt] font-font">Your Tasks</h1>
        {/* <Button
          color={ButtonColor.Light}
          onClick={() => {
            navigate("/actions");
          }}
        >
          See completed
        </Button> */}
      </div>
      {initialActions.map((action) => (
        <TaskCard
          key={action.id}
          action={action}
          onComplete={() => handleTaskComplete(action.id)}
        />
      ))}
      {initialActions.length === 0 && (
        <p className="text-center text-gray-500 py-5">
          Nothing to do right now!
        </p>
      )}
    </div>
  );
};

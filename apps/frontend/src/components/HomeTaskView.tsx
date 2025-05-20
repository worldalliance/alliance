import { ActionDto } from "@alliance/shared/client";
import TaskCard from "./TaskCard";

export interface HomeTaskViewProps {
  actions: ActionDto[];
  onTaskComplete?: (actionId: number) => void;
}

export const HomeTaskView: React.FC<HomeTaskViewProps> = ({
  actions: initialActions,
  onTaskComplete,
}) => {
  const handleTaskComplete = (actionId: number) => {
    if (onTaskComplete) {
      onTaskComplete(actionId);
    }
  };

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-row items-center gap-x-2 justify-between w-full">
        <h1 className="text-[#111] !text-[16pt] font-font mb-3">Your Tasks</h1>
        {/* <Button color={ButtonColor.Light} label="View All" onClick={() => {}} /> */}
      </div>
      {initialActions.map((action) => (
        <TaskCard
          key={action.id}
          action={action}
          onComplete={() => handleTaskComplete(action.id)}
        />
      ))}
    </div>
  );
};

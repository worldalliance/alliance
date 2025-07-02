import React from "react";

export interface ActionProgressBarProps {
  status: string;
  usersJoined: number;
  usersCompleted: number;
  commitmentThreshold?: number;
}

const ActionProgressBar: React.FC<ActionProgressBarProps> = ({
  status,
  usersJoined,
  usersCompleted,
  commitmentThreshold,
}) => {
  // Don't show progress bars for draft actions
  if (status === "draft") {
    return null;
  }

  // Gathering Commitments: Show progress towards commitment threshold
  if (status === "gathering-commitments") {
    const threshold = commitmentThreshold || 10; // Default threshold if not set
    const percentage = Math.min((usersJoined / threshold) * 100, 100);
    const isComplete = usersJoined >= threshold;
    
    return (
      <div className="flex flex-col gap-y-1 flex-1">
        <div className="w-full h-2 bg-gray-100 rounded-[2px]">
          <div
            className={`h-2 rounded-[2px] ${
              isComplete ? "bg-green-500" : "bg-yellow-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">
          {usersJoined} / {threshold} commitments
          {isComplete && " (Target reached!)"}
        </p>
      </div>
    );
  }

  // Member Action: Show completion progress
  if (status === "member-action") {
    const percentage = usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;
    
    return (
      <div className="flex flex-col gap-y-1 flex-1">
        <div className="w-full h-2 bg-gray-100 rounded-[2px]">
          <div
            className="h-2 bg-purple-500 rounded-[2px]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">
          {usersCompleted} / {usersJoined} completed
        </p>
      </div>
    );
  }

  // Commitments Reached: Show completion progress
  if (status === "commitments-reached") {
    const percentage = usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;
    
    return (
      <div className="flex flex-col gap-y-1 flex-1">
        <div className="w-full h-2 bg-gray-100 rounded-[2px]">
          <div
            className="h-2 bg-orange-500 rounded-[2px]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">
          {usersCompleted} / {usersJoined} completed
        </p>
      </div>
    );
  }

  // Resolution: Show completion progress (all should be completed)
  if (status === "resolution") {
    const percentage = usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;
    
    return (
      <div className="flex flex-col gap-y-1 flex-1">
        <div className="w-full h-2 bg-gray-100 rounded-[2px]">
          <div
            className="h-2 bg-indigo-500 rounded-[2px]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">
          {usersCompleted} / {usersJoined} completed
        </p>
      </div>
    );
  }

  // For other statuses, show basic progress bar if there are users
  if (usersJoined > 0) {
    const percentage = (usersCompleted / usersJoined) * 100;
    
    return (
      <div className="flex flex-col gap-y-1 flex-1">
        <div className="w-full h-2 bg-gray-100 rounded-[2px]">
          <div
            className="h-2 bg-blue-500 rounded-[2px]"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">
          {usersCompleted} / {usersJoined} completed
        </p>
      </div>
    );
  }

  // For statuses with no users, show basic stats
  return (
    <div className="flex flex-col gap-y-1 flex-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>Joined: {usersJoined}</span>
        <span>Completed: {usersCompleted}</span>
      </div>
    </div>
  );
};

export default ActionProgressBar;
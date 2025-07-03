import React from "react";

export interface ActionProgressBarProps {
  status: string;
  usersJoined: number;
  usersCompleted: number;
  commitmentThreshold?: number;
  actionType?: string;
  donationThreshold?: number;
  donationAmount?: number;
}

const ActionProgressBar: React.FC<ActionProgressBarProps> = ({
  status,
  usersJoined,
  usersCompleted,
  commitmentThreshold,
  actionType,
  donationThreshold,
  donationAmount,
}) => {
  // Don't show progress bars for draft actions
  if (status === "draft") {
    return null;
  }

  // Gathering Commitments: Show progress towards commitment threshold
  if (status === "gathering-commitments") {
    // Handle funding type actions differently
    if (actionType === "Funding") {
      const donationGoal = (donationThreshold || 1000) / 100; // Default if not set
      const suggestedAmount = donationAmount || 50; // Default if not set
      const currentAmount = (usersJoined * suggestedAmount) / 100;
      const percentage = Math.min((currentAmount / donationGoal) * 100, 100);
      const isComplete = currentAmount >= donationGoal;

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
            ${currentAmount} / ${donationGoal} committed
          </p>
        </div>
      );
    } else {
      // Activity type actions
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
          </p>
        </div>
      );
    }
  }

  // Member Action: Show completion progress
  if (status === "member-action") {
    const percentage =
      usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;

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
    const percentage =
      usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;

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
    const percentage =
      usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;

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

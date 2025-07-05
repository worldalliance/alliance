import React from "react";
import { ActionDto } from "@alliance/shared/client";

export interface ActionProgressBarProps {
  status: ActionDto["status"];
  usersJoined: number;
  usersCompleted: number;
  commitmentThreshold?: number;
  actionType?: string;
  donationThreshold?: number;
  donationAmount?: number;
  className?: string;
}

interface ProgressBarWrapperProps {
  className?: string;
  children: React.ReactNode;
}

interface ProgressBarProps {
  percentage: number;
  barColor: string;
  label: string;
}

// Reusable wrapper component
const ProgressBarWrapper: React.FC<ProgressBarWrapperProps> = ({ className, children }) => (
  <div className={`flex flex-col gap-y-1 flex-1 ${className || ""}`}>
    {children}
  </div>
);

// Reusable progress bar component
const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, barColor, label }) => (
  <>
    <div className="w-full h-2 bg-gray-100 rounded-[2px]">
      <div
        className={`h-2 rounded-[2px] ${barColor}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
    <p className="text-gray-600 text-xs">{label}</p>
  </>
);

const ActionProgressBar: React.FC<ActionProgressBarProps> = ({
  status,
  usersJoined,
  usersCompleted,
  commitmentThreshold,
  actionType,
  donationThreshold,
  donationAmount,
  className,
}) => {
  // Don't show progress bars for draft actions
  if (status === "draft") {
    return null;
  }

  // Gathering Commitments: Show progress towards commitment threshold
  if (status === "gathering_commitments") {
    if (actionType === "Funding") {
      const donationGoal = (donationThreshold || 1000) / 100;
      const suggestedAmount = donationAmount || 50;
      const currentAmount = (usersJoined * suggestedAmount) / 100;
      const percentage = (currentAmount / donationGoal) * 100;
      const isComplete = currentAmount >= donationGoal;
      const barColor = isComplete ? "bg-green-500" : "bg-yellow-500";

      return (
        <ProgressBarWrapper className={className}>
          <ProgressBar
            percentage={percentage}
            barColor={barColor}
            label={`$${currentAmount} / $${donationGoal} committed`}
          />
        </ProgressBarWrapper>
      );
    } else {
      const threshold = commitmentThreshold || 10;
      const percentage = (usersJoined / threshold) * 100;
      const isComplete = usersJoined >= threshold;
      const barColor = isComplete ? "bg-green-500" : "bg-yellow-500";

      return (
        <ProgressBarWrapper className={className}>
          <ProgressBar
            percentage={percentage}
            barColor={barColor}
            label={`${usersJoined} / ${threshold} commitments`}
          />
        </ProgressBarWrapper>
      );
    }
  }

  // Completion progress for various statuses
  const completionStatuses = ["member_action", "commitments_reached", "resolution"];
  if (completionStatuses.includes(status)) {
    const percentage = usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;
    const statusColors = {
      member_action: "bg-purple-500",
      commitments_reached: "bg-orange-500",
      resolution: "bg-indigo-500",
    } as const;

    return (
      <ProgressBarWrapper className={className}>
        <ProgressBar
          percentage={percentage}
          barColor={statusColors[status as keyof typeof statusColors]}
          label={`${usersCompleted} / ${usersJoined} completed`}
        />
      </ProgressBarWrapper>
    );
  }

  // For other statuses, show basic progress bar if there are users
  if (usersJoined > 0) {
    const percentage = (usersCompleted / usersJoined) * 100;

    return (
      <ProgressBarWrapper className={className}>
        <ProgressBar
          percentage={percentage}
          barColor="bg-blue-500"
          label={`${usersCompleted} / ${usersJoined} completed`}
        />
      </ProgressBarWrapper>
    );
  }

  // For statuses with no users, show basic stats
  return (
    <ProgressBarWrapper className={className}>
      <div className="flex justify-between text-xs text-gray-600">
        <span>Joined: {usersJoined}</span>
        <span>Completed: {usersCompleted}</span>
      </div>
    </ProgressBarWrapper>
  );
};

export default ActionProgressBar;

import { ActionDto, ActionStatus } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import React from "react";

export interface ActionProgressBarProps {
  status: ActionDto["status"];
  usersJoined: number;
  usersCompleted: number;
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
const ProgressBarWrapper: React.FC<ProgressBarWrapperProps> = ({
  className,
  children,
}) => (
  <div className={cn("flex flex-col gap-y-1 flex-1", className)}>
    {children}
  </div>
);

// Reusable progress bar component
const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  barColor,
  label,
}) => (
  <>
    <div className="w-full h-2 bg-zinc-100 rounded-[2px]">
      <div
        className={cn("h-2 rounded-[2px]", barColor)}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
    <p className="text-zinc-600 text-xs">{label}</p>
  </>
);

const ActionProgressBar: React.FC<ActionProgressBarProps> = ({
  status,
  usersJoined,
  usersCompleted,
  className,
}) => {
  // Don't show progress bars for draft actions
  if (status === "draft") {
    return null;
  }

  // Completion progress for various statuses
  const completionStatuses: ActionStatus[] = [
    "member_action",
    "office_action",
    "resolution",
  ];

  if (completionStatuses.includes(status)) {
    const percentage =
      usersJoined > 0 ? (usersCompleted / usersJoined) * 100 : 0;
    const statusColors = {
      member_action: "bg-green",
      office_action: "bg-green",
      resolution: "bg-green",
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
      <div className="flex justify-between text-xs text-zinc-600">
        <span>Joined: {usersJoined}</span>
        <span>Completed: {usersCompleted}</span>
      </div>
    </ProgressBarWrapper>
  );
};

export default ActionProgressBar;

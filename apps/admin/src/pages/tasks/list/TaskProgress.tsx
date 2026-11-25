import type { ActionDto } from "@alliance/shared/client";
import { formatCount } from "../../../lib/formatNumber";
import { cn } from "../../../ui/cn";

export type TaskProgressProps = {
  status: ActionDto["status"];
  usersJoined: number;
  usersCompleted: number;
  className?: string;
};

/** "12 / 40": completed of joined, or null for a draft, which nobody has joined. */
export const completedOfJoined = ({
  status,
  usersJoined,
  usersCompleted,
}: Pick<TaskProgressProps, "status" | "usersJoined" | "usersCompleted">) =>
  status === "draft"
    ? null
    : `${formatCount(usersCompleted)} / ${formatCount(usersJoined)}`;

export default function TaskProgress({
  className,
  ...counts
}: TaskProgressProps) {
  const text = completedOfJoined(counts);
  if (text === null) return null;
  const share =
    counts.usersJoined > 0
      ? Math.min(counts.usersCompleted / counts.usersJoined, 1) * 100
      : 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-2 inset-ring inset-ring-line">
        <div className="h-full bg-success" style={{ width: `${share}%` }} />
      </div>
      <span className="text-caption text-fg-muted tabular-nums">
        {text} completed
      </span>
    </div>
  );
}

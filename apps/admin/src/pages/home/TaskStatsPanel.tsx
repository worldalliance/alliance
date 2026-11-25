import { withCount } from "@alliance/common/plural";
import { href, Link } from "react-router";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import type { useActionStats } from "../../lib/useActionStats";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";

const NUMBER = "text-right tabular-nums";

/**
 * Every task's counts. Shown only once there are stats: their loading, failed
 * and empty states are the completion chart's, which reads the same query.
 */
export function TaskStatsPanel({
  stats,
  className,
}: {
  stats: ReturnType<typeof useActionStats>["stats"];
  className?: string;
}) {
  const tasks = stats.data ?? [];
  if (tasks.length === 0) return null;
  return (
    <Panel
      title="Task stats"
      description={withCount(tasks.length, "task")}
      flush
      className={className}
    >
      <div className="max-h-96 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Joined</TableHead>
              <TableHead className="text-right">Completion rate (%)</TableHead>
              <TableHead>Task date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.actionId}>
                <TableCell className="max-w-64 truncate">
                  <Link
                    to={href("/tasks/:actionId", {
                      actionId: task.actionId.toString(),
                    })}
                    className={nameLinkClass}
                    title={task.actionName}
                  >
                    {task.actionName}
                  </Link>
                </TableCell>
                <TableCell className={NUMBER}>
                  {formatCount(task.usersCompleted)}
                </TableCell>
                <TableCell className={NUMBER}>
                  {formatCount(task.usersJoined)}
                </TableCell>
                <TableCell className={NUMBER}>
                  {task.usersJoined > 0
                    ? Math.round(task.completionRate * 100)
                    : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-fg-muted">
                  {task.memberActionStartDate
                    ? formatDate(task.memberActionStartDate)
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

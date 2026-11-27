import { eventInEffectAt } from "@alliance/common/actionEvent";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { taskHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import Badge from "../../ui/Badge";
import { cn } from "../../ui/cn";
import PhaseBadge from "../../ui/PhaseBadge";
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
const PACIFIC = { timeZone: LAUNCH_TIME_ZONE };

/** The suite's tasks, highest priority first. */
export function SuiteTasksTab({ suite }: { suite: ActionSuiteDto }) {
  const now = new Date();
  const tasks = suite.actions.slice().sort((a, b) => b.priority - a.priority);
  return (
    <Panel title="Tasks" description="Highest priority first" flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead className={NUMBER}>Time (min)</TableHead>
            <TableHead className={NUMBER}>Joined</TableHead>
            <TableHead className={NUMBER}>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const since = eventInEffectAt(task.events, now).event?.date;
            return (
              <TableRow key={task.id}>
                <TableCell className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <Link
                      to={taskHref(task.id)}
                      title={
                        task.shortDescription
                          ? `${task.name}\n\n${task.shortDescription}`
                          : task.name
                      }
                      className={cn(nameLinkClass, "max-w-48 truncate")}
                    >
                      {task.name}
                    </Link>
                    {task.optional && <Badge>Optional</Badge>}
                    {task.archived && <Badge>Archived</Badge>}
                  </span>
                </TableCell>
                <TableCell
                  title={
                    since
                      ? `Since ${formatDateTime(since, PACIFIC)}`
                      : undefined
                  }
                >
                  <PhaseBadge status={task.status} />
                </TableCell>
                <TableCell className={NUMBER}>
                  {task.timeEstimate || "—"}
                </TableCell>
                <TableCell className={NUMBER}>
                  {formatCount(task.usersJoined)}
                </TableCell>
                <TableCell className={NUMBER}>
                  {formatCount(task.usersCompleted)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

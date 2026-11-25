import { eventInEffectAt } from "@alliance/common/actionEvent";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { taskHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import Badge from "../../ui/Badge";
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
            <TableHead>Since</TableHead>
            <TableHead className={NUMBER}>Time (min)</TableHead>
            <TableHead>Optional</TableHead>
            <TableHead className={NUMBER}>Joined</TableHead>
            <TableHead className={NUMBER}>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const since = eventInEffectAt(task.events, now).event?.date;
            return (
              <TableRow key={task.id}>
                <TableCell truncate title={task.shortDescription || task.name}>
                  <Link to={taskHref(task.id)} className={nameLinkClass}>
                    {task.name}
                  </Link>
                  {task.archived && (
                    <>
                      {" "}
                      <Badge>Archived</Badge>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <PhaseBadge status={task.status} />
                </TableCell>
                <TableCell>
                  {since
                    ? formatDateTime(since, { timeZone: LAUNCH_TIME_ZONE })
                    : "—"}
                </TableCell>
                <TableCell className={NUMBER}>
                  {task.timeEstimate ?? "—"}
                </TableCell>
                <TableCell>{task.optional ? "Yes" : "No"}</TableCell>
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

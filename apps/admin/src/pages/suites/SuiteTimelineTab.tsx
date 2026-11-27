import type { ActionSuiteDto } from "@alliance/shared/client";
import { Link } from "react-router";
import ActionTimeline from "../../components/ActionTimeline";
import { formatDateTime } from "../../lib/formatDate";
import { suiteHref, taskHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { TabParam } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import PhaseBadge, { phaseLabel } from "../../ui/PhaseBadge";
import { linkClass, nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { type PhaseCell, PhaseRole, phaseStrip } from "./suitePhaseStrip";
import { LaunchStatus, suiteLaunch } from "./suiteRules";

const ROLE: Record<PhaseRole, string> = {
  [PhaseRole.MembersStart]: "Members start",
  [PhaseRole.Deadline]: "Members' deadline",
};

function PhaseStrip({ cells }: { cells: PhaseCell[] }) {
  return (
    <ol
      aria-label="Phases"
      className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-card border border-line bg-surface"
    >
      {cells.map((cell) => (
        <li
          key={cell.key}
          aria-current={cell.now ? "step" : undefined}
          className={cn(
            "flex min-w-0 flex-col gap-1 border-l border-line px-card py-bar first:border-l-0",
            cell.now && "bg-surface-2",
          )}
        >
          <span className="text-caption font-medium text-fg-muted">
            {phaseLabel(cell.status)}
          </span>
          <span className="font-medium">
            {cell.date
              ? formatDateTime(cell.date, {
                  weekday: true,
                  timeZone: LAUNCH_TIME_ZONE,
                })
              : cell.status === "draft"
                ? "Until members start"
                : "Set at launch"}
          </span>
          <span className="text-caption text-fg-muted">
            {[cell.now && "Now", cell.role && ROLE[cell.role]]
              .filter(Boolean)
              .join(" · ") || "\u00a0"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The suite's phases over its tasks on a timeline, with its reminders. Until a
 * task has an event there is nothing to chart, so the tasks are listed with
 * the ways to add more.
 */
export function SuiteTimelineTab({
  suite,
  now,
  onReminderClick,
}: {
  suite: ActionSuiteDto;
  /** The page's clock, so the strip's Now agrees with the header. */
  now: Date;
  /** Opens the Reminders tab on the reminder. */
  onReminderClick: (reminderId: number) => void;
}) {
  const canLaunch = suiteLaunch(suite).status === LaunchStatus.Ready;
  const cells = phaseStrip({
    events: suite.events,
    now,
    canLaunch,
  });
  const charted = suite.actions.some((action) => action.events.length > 0);
  const launchHref = `${suiteHref(suite.id)}?${TabParam.Tab}=launch`;

  return (
    <div className="flex flex-col gap-section">
      <PhaseStrip cells={cells} />
      {charted ? (
        <Panel title="Timeline" flush>
          <ActionTimeline
            actions={suite.actions}
            reminders={suite.reminderGroups}
            onReminderClick={onReminderClick}
            header={<div className="flex h-full items-center pl-4">Task</div>}
          />
        </Panel>
      ) : (
        <Panel title="Tasks" description="None has an event yet" flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead className="text-right">Time (min)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suite.actions.map((task) => (
                <TableRow key={task.id}>
                  <TableCell truncate title={task.name}>
                    <Link to={taskHref(task.id)} className={nameLinkClass}>
                      {task.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PhaseBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {task.timeEstimate || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-2 border-t border-line px-card py-bar text-fg-muted">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="small"
                variant={ButtonVariant.Default}
                to={`/tasks/new?suiteId=${suite.id}`}
              >
                New task
              </Button>
              <span>New tasks start as drafts in this suite.</span>
            </div>
            <p>
              To add a task that already exists, choose this suite in the task's
              Suite field.
              {canLaunch && (
                <>
                  {" "}
                  Each task's readiness is checked on the{" "}
                  <Link to={launchHref} className={linkClass}>
                    Launch tab
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

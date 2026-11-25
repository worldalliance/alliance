import type {
  ActionUpdateDto,
  ActionUpdateNotifyType,
} from "@alliance/shared/client";
import { Link } from "react-router";
import { stepPath } from "../../components/ProjectStepRows";
import {
  ACTION_UPDATE_STATUS_LABELS,
  ActionUpdateStatus,
  actionUpdateStatus,
} from "../../lib/actionUpdateStatus";
import { formatDate } from "../../lib/formatDate";
import { taskUpdateHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import type { ProjectCard } from "../../lib/projectCards";
import Badge, { BadgeTone } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
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

const STATUS_TONE: Record<ActionUpdateStatus, BadgeTone> = {
  [ActionUpdateStatus.Draft]: BadgeTone.Neutral,
  [ActionUpdateStatus.Scheduled]: BadgeTone.Info,
  [ActionUpdateStatus.Published]: BadgeTone.Success,
};

const UNSENT: Record<ActionUpdateNotifyType, string> = {
  none: "No notification",
  action_cohort: "Not sent yet",
  all_members: "Not sent yet",
  tag: "Not sent yet",
};

const day = (date: string) => formatDate(date, { timeZone: LAUNCH_TIME_ZONE });

/** The updates posted on the project's tasks, newest first, as the server orders them. */
export function ProjectUpdatesTab({
  card,
  updates,
  now,
}: {
  card: ProjectCard;
  /** Every task's updates, as the page loaded them. */
  updates: ActionUpdateDto[];
  now: Date;
}) {
  const stepById = new Map(card.steps.map((step) => [step.id, step]));
  const rows = updates.filter((update) => stepById.has(update.actionId));

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No project updates yet"
        description="An update posted on one of this project's tasks shows here."
      />
    );
  }

  return (
    <Panel title="Project updates" description="Pacific time" flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Update</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((update) => {
            const step = stepById.get(update.actionId);
            const status = actionUpdateStatus(update, now);
            return (
              <TableRow key={update.id}>
                <TableCell truncate title={update.title}>
                  <Link
                    to={taskUpdateHref({
                      actionId: update.actionId,
                      updateId: update.id,
                    })}
                    className={nameLinkClass}
                  >
                    {update.title}
                  </Link>
                  {step && (
                    <div className="mt-1 truncate text-caption text-fg-muted">
                      <Link
                        to={stepPath(step)}
                        title={step.name}
                        className="rounded-sm focus-ring hover:underline"
                      >
                        {step.name}
                      </Link>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={STATUS_TONE[status]}>
                    {ACTION_UPDATE_STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {day(update.date)}
                  <div className="mt-1 text-caption text-fg-muted">
                    {update.notifiedAt
                      ? `Sent ${day(update.notifiedAt)}`
                      : UNSENT[update.notifyType]}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

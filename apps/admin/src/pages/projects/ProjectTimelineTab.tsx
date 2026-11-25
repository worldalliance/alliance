import { Link } from "react-router";
import { stepPath } from "../../components/ProjectStepRows";
import { DEFAULT_EVENT_NAMES } from "../../lib/actionStatusDisplay";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import type { ProjectCard } from "../../lib/projectCards";
import { cn } from "../../ui/cn";
import { EmptyState } from "../../ui/EmptyState";
import PhaseBadge, { phaseLabel } from "../../ui/PhaseBadge";
import { projectColor } from "../../ui/projectColor";
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
import { Lane, LaneDates } from "./ProjectLanes";
import { projectTimeline } from "./timelineRules";

const at = (date: string) =>
  formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

/**
 * When each task runs, on one scale, then every event behind the bars as a
 * table, so nothing the bars show needs a pointer to read.
 */
export function ProjectTimelineTab({
  card,
  projectId,
  now,
}: {
  card: ProjectCard;
  projectId: number;
  now: Date;
}) {
  const timeline = projectTimeline(card.steps, now);
  const color = projectColor(projectId);
  const events = card.steps
    .flatMap((step) => step.events.map((event) => ({ step, event })))
    .sort(
      (a, b) =>
        new Date(a.event.date).getTime() - new Date(b.event.date).getTime(),
    );

  if (!timeline) {
    return (
      <EmptyState
        title="Nothing scheduled yet"
        description="A task shows here once it has an event: its release, a deadline or a phase change."
      />
    );
  }

  return (
    <>
      <Panel
        title="Phases"
        description="Pacific time"
        action={
          <ul className="flex items-center gap-4 text-caption text-fg-muted">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("h-2 w-4 rounded-sm", color.solid)}
              />
              Members taking action
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-4 rounded-sm bg-line-strong"
              />
              Other phases
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-px bg-fg" />
              Now
            </li>
          </ul>
        }
      >
        <div className="flex flex-col gap-2">
          {card.steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              <Link
                to={stepPath(step)}
                title={step.name}
                className={cn(nameLinkClass, "w-64 shrink-0 truncate")}
              >
                {step.name}
              </Link>
              <Lane
                step={step}
                timeline={timeline}
                memberActionClass={color.solid}
                className="h-4 flex-1"
              />
            </div>
          ))}
          <div className="flex gap-3">
            <span className="w-64 shrink-0" />
            <div className="flex-1">
              <LaneDates timeline={timeline} />
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Events" description="Pacific time" flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Phase from then on</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map(({ step, event }) => (
              <TableRow key={`${step.id}-${event.id}-${event.date}`}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {at(event.date)}
                </TableCell>
                <TableCell truncate title={step.name}>
                  <Link to={stepPath(step)} className={nameLinkClass}>
                    {step.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <PhaseBadge status={event.newStatus} />
                  {![
                    phaseLabel(event.newStatus),
                    DEFAULT_EVENT_NAMES[event.newStatus],
                  ].includes(event.title) && (
                    <div className="mt-1 text-caption text-fg-muted">
                      {event.title}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

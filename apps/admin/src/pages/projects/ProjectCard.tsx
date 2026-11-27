import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router";
import { ActionCategoryIcons } from "../../components/ActionCategoryIcons";
import { stepPath } from "../../components/ProjectStepRows";
import {
  cohortSegmentsText,
  type CohortSegment,
} from "../../lib/describeCohortExpression";
import { projectHref, taskHref } from "../../lib/hrefs";
import {
  ProjectCardKind,
  type ProjectCard as Card,
  type ProjectFlag,
} from "../../lib/projectCards";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { projectColor } from "../../ui/projectColor";
import { ProjectSwatch } from "../../ui/ProjectSwatch";
import { nameLinkClass } from "../../ui/styles";
import { Lane, LaneDates } from "./ProjectLanes";
import {
  countsText,
  flagText,
  startedText,
  stepDates,
  totalCompletions,
} from "./projectRules";
import { StepBadges, StepFunnel, totalsText } from "./stepPieces";
import { projectTimeline } from "./timelineRules";

/** A standalone task has no project colour: its bars are neutral. */
const NEUTRAL_BAR = "bg-fg-muted";

export const cardBarClass = (card: Card) =>
  card.kind === ProjectCardKind.Project
    ? projectColor(card.project.id).solid
    : NEUTRAL_BAR;

/** What needs attention on a project's tasks, each in a sentence. */
export function ProjectFlags({ flags }: { flags: ProjectFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {flags.map(flagText).map((flag) => (
        <li
          key={flag.key}
          title={flag.at}
          className="flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-caption"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-px size-3.5 shrink-0 text-warning"
          />
          {flag.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * One project on the board, or one task that is in no project: its tasks in
 * order, when each runs and how many members completed each.
 */
export function ProjectCard({
  card,
  participantsById,
  now,
  onMakeProject,
}: {
  card: Card;
  participantsById: ReadonlyMap<number, CohortSegment[]>;
  now: Date;
  /** For a standalone task: start a project from it. */
  onMakeProject: (task: { id: number; name: string }) => void;
}) {
  const titleId = useId();
  const barClass = cardBarClass(card);
  const timeline = projectTimeline(card.steps, now);
  const funnelById = new Map(card.funnel.map((entry) => [entry.stepId, entry]));
  const maxCompletions = Math.max(1, ...card.funnel.map((f) => f.completions));
  const standalone = card.kind === ProjectCardKind.Standalone;

  return (
    <article
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-card"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <h3
            id={titleId}
            className="flex min-h-control-sm min-w-0 flex-1 items-center gap-2 text-heading"
          >
            {card.kind === ProjectCardKind.Project && (
              <ProjectSwatch projectId={card.project.id} />
            )}
            <Link
              to={
                card.kind === ProjectCardKind.Project
                  ? projectHref(card.project.id)
                  : taskHref(card.action.id)
              }
              title={card.name}
              className={cn(nameLinkClass, "line-clamp-2 font-semibold")}
            >
              {card.name}
            </Link>
            {card.kind === ProjectCardKind.Project && (
              <ActionCategoryIcons categories={card.project.category} />
            )}
          </h3>
          {card.kind === ProjectCardKind.Standalone && (
            <Button
              size="small"
              variant={ButtonVariant.Default}
              aria-label={`Make project…: ${card.name}`}
              onClick={() =>
                onMakeProject({ id: card.action.id, name: card.name })
              }
            >
              Make project…
            </Button>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
          {standalone && <Badge>Standalone task</Badge>}
          {[startedText(card.startedAt), countsText(card)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <ProjectFlags flags={card.flags} />

      {timeline ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-col gap-0.5">
            {card.steps.map((step) => (
              <Lane
                key={step.id}
                step={step}
                timeline={timeline}
                memberActionClass={barClass}
                className="h-1.5"
              />
            ))}
          </div>
          <LaneDates timeline={timeline} />
        </div>
      ) : (
        card.steps.length > 0 && (
          <p className="text-caption text-fg-muted">No events scheduled</p>
        )
      )}

      {card.steps.length === 0 ? (
        <p className="text-caption text-fg-muted">No tasks yet</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line border-t border-line">
          {card.steps.map((step, index) => {
            const participants = participantsById.get(step.id);
            const cohort = participants && cohortSegmentsText(participants);
            return (
              <li key={step.id} className="flex items-start gap-3 py-2">
                {!standalone && (
                  <span className="w-4 shrink-0 text-right text-fg-muted tabular-nums">
                    {index + 1}
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {!standalone && (
                      <Link
                        to={stepPath(step)}
                        title={step.name}
                        className={cn(nameLinkClass, "max-w-full truncate")}
                      >
                        {step.name}
                      </Link>
                    )}
                    <StepBadges step={step} now={now} />
                  </div>
                  <p
                    className="truncate text-caption text-fg-muted"
                    title={cohort}
                  >
                    {[stepDates(step), cohort].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StepFunnel
                  entry={funnelById.get(step.id)}
                  maxCompletions={maxCompletions}
                  barClass={barClass}
                  className="w-40"
                />
              </li>
            );
          })}
        </ol>
      )}

      {/* Pushed to the card's foot, so the totals line up along a row of cards. */}
      <p className="mt-auto border-t border-line pt-2 text-caption text-fg-muted tabular-nums">
        {totalsText({
          completions: totalCompletions(card),
          wontComplete: card.wontComplete,
          dismissed: card.dismissed,
        })}
      </p>
    </article>
  );
}

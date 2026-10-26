import { format, formatDistanceToNowStrict, isFuture } from "date-fns";
import { TriangleAlert } from "lucide-react";
import type { CohortSegment } from "../lib/describeCohortExpression";
import {
  ProjectFlagKind,
  StepCountBucket,
  type ProjectCard,
  type ProjectFlag,
  type ProjectStep,
} from "../lib/projectCards";
import ProjectMiniTimeline from "./ProjectMiniTimeline";
import ProjectStepRows from "./ProjectStepRows";

const COUNT_LABELS: Record<StepCountBucket, string> = {
  [StepCountBucket.Live]: "live",
  [StepCountBucket.Planned]: "planned",
  [StepCountBucket.Draft]: "draft",
  [StepCountBucket.WrappingUp]: "wrapping up",
  [StepCountBucket.Done]: "done",
};

const COUNT_COLORS: Record<StepCountBucket, string> = {
  [StepCountBucket.Live]: "bg-purple-100 text-purple-800",
  [StepCountBucket.Planned]: "bg-blue-100 text-blue-800",
  [StepCountBucket.Draft]: "bg-zinc-100 text-zinc-700",
  [StepCountBucket.WrappingUp]: "bg-orange-100 text-orange-800",
  [StepCountBucket.Done]: "bg-green-100 text-green-800",
};

const day = (date: Date) => format(date, "MMM d");
const relative = (date: Date) =>
  formatDistanceToNowStrict(date, { addSuffix: true });

const FLAG_TEXT: Record<ProjectFlagKind, (flag: ProjectFlag) => string> = {
  [ProjectFlagKind.Stuck]: ({ step, at }) =>
    `"${step.name}" has been wrapping up since ${day(at)} with no update`,
  [ProjectFlagKind.NoUpdate]: ({ step, at }) =>
    `"${step.name}" completed ${day(at)} with no update posted`,
  [ProjectFlagKind.DeadlineSoon]: ({ step, at }) =>
    `"${step.name}" closes ${relative(at)}`,
  [ProjectFlagKind.LaunchSoon]: ({ step, at }) =>
    `"${step.name}" opens ${relative(at)}`,
  [ProjectFlagKind.GapBeforeNextStep]: ({ step }) =>
    `Nothing planned after "${step.name}"`,
};

export const startedText = (startedAt: Date | null) => {
  if (!startedAt) return "Not started";
  const date = format(startedAt, "MMM d, yyyy");
  return isFuture(startedAt) ? `Starts ${date}` : `Started ${date}`;
};

export const ProjectCounts = ({ card }: { card: ProjectCard }) => (
  <div className="flex flex-wrap items-center gap-1">
    {Object.values(StepCountBucket)
      .filter((bucket) => card.counts[bucket] > 0)
      .map((bucket) => (
        <span
          key={bucket}
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${COUNT_COLORS[bucket]}`}
        >
          {card.counts[bucket]} {COUNT_LABELS[bucket]}
        </span>
      ))}
  </div>
);

const ProjectCardBody = ({
  card,
  participantsById,
  detailed,
  onRemoveStep,
}: {
  card: ProjectCard;
  participantsById: ReadonlyMap<number, CohortSegment[]>;
  detailed: boolean;
  onRemoveStep?: (step: ProjectStep) => void;
}) => {
  const completions = card.funnel.reduce((sum, f) => sum + f.completions, 0);
  return (
    <div className="flex flex-col gap-3">
      {card.flags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {card.flags.map((flag) => (
            <li
              key={`${flag.kind}-${flag.step.id}`}
              className="flex items-start gap-x-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900"
            >
              <TriangleAlert size={12} className="mt-0.5 shrink-0" />
              {FLAG_TEXT[flag.kind](flag)}
            </li>
          ))}
        </ul>
      )}
      {card.steps.length > 0 && (
        <ProjectMiniTimeline
          steps={card.steps}
          colorSeed={card.name}
          laneClassName={detailed ? "h-4" : "h-1.5"}
        />
      )}
      <ProjectStepRows
        steps={card.steps}
        funnel={card.funnel}
        participantsById={participantsById}
        detailed={detailed}
        onRemove={onRemoveStep}
      />
      <div className="flex gap-x-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
        <span>
          <span className="font-medium text-zinc-800">{completions}</span>{" "}
          completions
        </span>
        <span>
          <span className="font-medium text-zinc-800">{card.wontComplete}</span>{" "}
          won&apos;t
        </span>
        <span>
          <span className="font-medium text-zinc-800">{card.dismissed}</span>{" "}
          dismissed
        </span>
      </div>
    </div>
  );
};

export default ProjectCardBody;

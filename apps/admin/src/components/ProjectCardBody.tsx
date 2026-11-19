import { withCount } from "@alliance/common/plural";
import { format, isFuture } from "date-fns";
import type { CohortSegment } from "../lib/describeCohortExpression";
import {
  COUNT_LABELS,
  COUNT_TONES,
  StepCountBucket,
  type ProjectCard,
  type ProjectStep,
} from "../lib/projectCards";
import ProjectMiniTimeline from "./ProjectMiniTimeline";
import ProjectStepRows from "./ProjectStepRows";
import StatusPill from "./ui/StatusPill";

const startedText = (startedAt: Date | null) => {
  if (!startedAt) return "Not started";
  const date = format(startedAt, "MMM d, yyyy");
  return isFuture(startedAt) ? `Starts ${date}` : `Started ${date}`;
};

export const ProjectCounts = ({ card }: { card: ProjectCard }) => (
  <div className="flex flex-wrap items-center gap-1">
    {Object.values(StepCountBucket)
      .filter((bucket) => card.counts[bucket] > 0)
      .map((bucket) => (
        <StatusPill
          key={bucket}
          tone={COUNT_TONES[bucket]}
          label={`${card.counts[bucket]} ${COUNT_LABELS[bucket]}`}
        />
      ))}
  </div>
);

export const projectSummary = (card: ProjectCard) => {
  const completions = card.funnel.reduce((sum, f) => sum + f.completions, 0);
  return [
    startedText(card.startedAt),
    withCount(completions, "completion"),
    `${card.wontComplete} won't`,
    `${card.dismissed} dismissed`,
  ].join(" · ");
};

const ProjectCardBody = ({
  card,
  participantsById,
  detailed,
  onRemoveStep,
  onStartStaffTesting,
}: {
  card: ProjectCard;
  participantsById: ReadonlyMap<number, CohortSegment[]>;
  detailed: boolean;
  onRemoveStep?: (step: ProjectStep) => void;
  onStartStaffTesting?: (step: ProjectStep) => void;
}) => (
  <div className="flex flex-col gap-3">
    {detailed && card.steps.length > 0 && (
      <ProjectMiniTimeline steps={card.steps} colorSeed={card.name} />
    )}
    <ProjectStepRows
      steps={card.steps}
      funnel={card.funnel}
      participantsById={participantsById}
      detailed={detailed}
      onRemove={onRemoveStep}
      onStartStaffTesting={onStartStaffTesting}
    />
  </div>
);

export default ProjectCardBody;

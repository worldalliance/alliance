import { cn } from "@alliance/shared/styles/util";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Link } from "react-router";
import { ActionPhase, actionPhase } from "../lib/actionPhase";
import type { CohortSegment } from "../lib/describeCohortExpression";
import type { FunnelStep, ProjectStep } from "../lib/projectCards";
import {
  ActionEditorSection,
  missingForStaffTesting,
} from "../lib/staffTestingGate";
import ActionPhasePill from "./ActionPhasePill";
import ActionTimelineRowMeta from "./ActionTimelineRowMeta";

const shortDate = (date: string | null) =>
  date ? format(new Date(date), "MMM d") : null;

const stepDates = (step: ProjectStep) => {
  const start = shortDate(step.memberActionStart);
  if (!start) return "Unscheduled";
  const deadline = shortDate(step.memberActionDeadline);
  return deadline ? `${start} – ${deadline}` : `From ${start}`;
};

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

export const stepPath = (step: Pick<ProjectStep, "id" | "project">) =>
  step.project
    ? `/projects/${step.project.id}/action/${step.id}`
    : `/actions/${step.id}`;

const NextStep = ({
  step,
  phase,
  onStartStaffTesting,
}: {
  step: ProjectStep;
  phase: ActionPhase;
  onStartStaffTesting?: (step: ProjectStep) => void;
}) => {
  if (phase === ActionPhase.StaffTesting) {
    return (
      <Link
        to={`${stepPath(step)}#${ActionEditorSection.Release}`}
        className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
      >
        Schedule release
      </Link>
    );
  }
  if (phase !== ActionPhase.Draft || !onStartStaffTesting) return null;
  const missing = missingForStaffTesting(step);
  return (
    <button
      type="button"
      disabled={missing.length > 0}
      title={
        missing.length > 0
          ? `Needs: ${missing.map(({ label }) => label).join(", ")}`
          : undefined
      }
      onClick={() => onStartStaffTesting(step)}
      className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
    >
      Start staff testing
    </button>
  );
};

const ProjectStepRows = ({
  steps,
  funnel,
  participantsById,
  detailed,
  onRemove,
  onStartStaffTesting,
}: {
  steps: ProjectStep[];
  funnel: FunnelStep[];
  participantsById: ReadonlyMap<number, CohortSegment[]>;
  detailed: boolean;
  onRemove?: (step: ProjectStep) => void;
  onStartStaffTesting?: (step: ProjectStep) => void;
}) => {
  const now = new Date();
  const funnelById = new Map(funnel.map((entry) => [entry.stepId, entry]));
  const maxCompletions = Math.max(1, ...funnel.map((f) => f.completions));
  if (steps.length === 0) {
    return <p className="text-xs text-zinc-400">No actions yet</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-zinc-100">
      {steps.map((step, index) => {
        const entry = funnelById.get(step.id);
        const completions = entry?.completions ?? 0;
        return (
          <li
            key={step.id}
            className="relative z-10 flex items-center gap-x-3 py-1.5"
          >
            <span className="w-4 shrink-0 text-right text-xs text-zinc-400">
              {index + 1}
            </span>
            <Link
              to={stepPath(step)}
              className="min-w-0 flex-1 rounded hover:bg-zinc-50"
            >
              <div className="truncate text-sm font-medium text-black">
                {step.name}
              </div>
              {detailed && step.slug && (
                <div className="truncate font-mono text-xs text-zinc-400">
                  {step.slug}
                </div>
              )}
              <ActionTimelineRowMeta
                status={step.status}
                participants={participantsById.get(step.id)}
              />
            </Link>
            {detailed && (
              <div className="flex w-56 shrink-0 items-center justify-end gap-x-2">
                <ActionPhasePill
                  phase={actionPhase(step, now)}
                  status={step.status}
                />
                <NextStep
                  step={step}
                  phase={actionPhase(step, now)}
                  onStartStaffTesting={onStartStaffTesting}
                />
              </div>
            )}
            <span className="w-24 shrink-0 text-xs text-zinc-500">
              {stepDates(step)}
            </span>
            <div
              className={cn(
                "flex shrink-0 flex-col items-end gap-0.5",
                detailed ? "w-48" : "w-24",
              )}
            >
              <div className="flex items-baseline gap-x-1 text-xs">
                <span className="font-medium text-zinc-800">{completions}</span>
                <span className="text-zinc-400">done</span>
                {entry?.retention != null && (
                  <span
                    className="text-zinc-500"
                    title="Completions relative to the previous step"
                  >
                    · {percent(entry.retention)}
                  </span>
                )}
              </div>
              <div className="h-1 w-full rounded bg-zinc-100">
                <div
                  className="h-1 rounded bg-emerald-500"
                  style={{ width: percent(completions / maxCompletions) }}
                />
              </div>
              {detailed && (
                <div className="text-[11px] text-zinc-400">
                  {step.usersWontComplete} won&apos;t · {step.usersDismissed}{" "}
                  dismissed
                </div>
              )}
            </div>
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove "${step.name}" from project`}
                title="Remove from project"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => onRemove(step)}
              >
                <X size={14} />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default ProjectStepRows;

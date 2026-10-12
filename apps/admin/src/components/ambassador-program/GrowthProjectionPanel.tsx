import {
  AmbassadorInviteGoalWithStatsDto,
  AmbassadorInviteProjectionDto,
  AmbassadorProgramMemberDto,
} from "@alliance/shared/client";
import { TrendingUp } from "lucide-react";
import React from "react";
import { formatGoalDate, numberLabel } from "./format";

const formatGeneratedAt = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

export const GrowthProjectionPanel: React.FC<{
  projection?: AmbassadorInviteProjectionDto;
  activeParticipants: AmbassadorProgramMemberDto[];
}> = ({ projection, activeParticipants }) => {
  const activeGoals = activeParticipants
    .map((member) => member.inviteStats?.currentGoal)
    .filter((goal): goal is AmbassadorInviteGoalWithStatsDto => Boolean(goal));
  const currentTarget = activeGoals.reduce(
    (total, goal) => total + goal.goal.targetSuccessfulRecruits,
    0,
  );
  const currentSuccessful = activeGoals.reduce(
    (total, goal) => total + goal.stats.goalSuccessfulRecruits,
    0,
  );
  const remainingCurrentTarget = Math.max(0, currentTarget - currentSuccessful);
  const points = projection?.points ?? [];

  return (
    <section className="border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            <h2 className="text-lg font-semibold text-zinc-900">
              Projected growth
            </h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Estimate of successful recruits expected from active and upcoming
            ambassador invite goals.
          </p>
        </div>
        {projection && (
          <p className="text-xs text-zinc-500">
            Updated {formatGeneratedAt(projection.generatedAt)}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Active goal target left</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {numberLabel(remainingCurrentTarget)}
          </p>
        </div>
        {points.map((point) => (
          <div
            key={point.date}
            className="border border-zinc-200 bg-zinc-50 px-3 py-2"
          >
            <p className="text-xs text-zinc-500">
              By {formatGoalDate(point.date)}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {numberLabel(point.projectedSuccessfulRecruits)}
            </p>
          </div>
        ))}
        {!points.length && (
          <div className="border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500">
            No active or upcoming invite goals to project.
          </div>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Calculation reminder: for every active or future goal, this estimates
        the remaining successful recruits not yet earned, spreads them evenly
        from today or the goal start date through the due date, then sums those
        estimates for each checkpoint.
      </p>
    </section>
  );
};

import {
  AmbassadorInviteGoalWithStatsDto,
  AmbassadorProgramMemberDto,
} from "@alliance/shared/client";
import { UserCheck } from "lucide-react";
import React from "react";
import { formatGoalDate, numberLabel } from "./format";

const goalPeriodLabel = (goal: AmbassadorInviteGoalWithStatsDto) =>
  `${formatGoalDate(goal.goal.startAt)} - ${formatGoalDate(goal.goal.dueAt)}`;

const GoalPeriodStats: React.FC<{
  goal: AmbassadorInviteGoalWithStatsDto;
  label?: string;
}> = ({ goal, label }) => (
  <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-800">
          {label ?? goalPeriodLabel(goal)}
        </p>
        {label && (
          <p className="text-xs text-zinc-500">{goalPeriodLabel(goal)}</p>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Target {numberLabel(goal.goal.targetSuccessfulRecruits)}
      </p>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div>
        <p className="text-xs text-zinc-500">Created</p>
        <p className="font-semibold tabular-nums">
          {numberLabel(goal.stats.totalInvitesSent)}
        </p>
      </div>
      <div>
        <p className="text-xs text-zinc-500">Accepted</p>
        <p className="font-semibold tabular-nums">
          {numberLabel(goal.stats.totalAcceptedInvites)}
        </p>
      </div>
      <div>
        <p className="text-xs text-zinc-500">Successful</p>
        <p className="font-semibold tabular-nums">
          {numberLabel(goal.stats.goalSuccessfulRecruits)} /{" "}
          {numberLabel(goal.goal.targetSuccessfulRecruits)}
        </p>
      </div>
    </div>
  </div>
);

export const InviteGoalStatsPanel: React.FC<{
  member: AmbassadorProgramMemberDto;
}> = ({ member }) => {
  if (!member.inviteStats) {
    return null;
  }

  const { currentGoal, pastGoals, totals, upcomingGoals } = member.inviteStats;

  return (
    <div className="mt-4 border-t border-zinc-200 pt-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
        <UserCheck size={16} />
        Ambassador invite goals
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Created total</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(totals.totalInvitesSent)}
          </p>
        </div>
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Accepted total</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(totals.totalAcceptedInvites)}
          </p>
        </div>
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Successful total</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(totals.totalSuccessfulRecruits)}
          </p>
        </div>
        <div className="border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-xs text-zinc-500">Goal periods</p>
          <p className="font-semibold tabular-nums">
            {numberLabel(
              (currentGoal ? 1 : 0) + pastGoals.length + upcomingGoals.length,
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {currentGoal ? (
          <GoalPeriodStats goal={currentGoal} label="Current goal" />
        ) : (
          <div className="border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500">
            No current ambassador invite goal.
          </div>
        )}

        {pastGoals.length > 0 && (
          <details className="border border-zinc-200 bg-white px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-zinc-700">
              Past growth periods ({pastGoals.length})
            </summary>
            <div className="mt-2 space-y-2">
              {pastGoals.map((goal) => (
                <GoalPeriodStats key={goal.goal.id} goal={goal} />
              ))}
            </div>
          </details>
        )}

        {upcomingGoals.length > 0 && (
          <details className="border border-zinc-200 bg-white px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-zinc-700">
              Upcoming goals ({upcomingGoals.length})
            </summary>
            <div className="mt-2 space-y-2">
              {upcomingGoals.map((goal) => (
                <GoalPeriodStats key={goal.goal.id} goal={goal} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

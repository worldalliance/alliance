import type {
  AmbassadorInviteGoalWithStatsDto,
  AmbassadorProgramMemberDto,
} from "@alliance/shared/client/types.gen";
import { ChevronRight } from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-caption font-medium text-fg-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const period = (goal: AmbassadorInviteGoalWithStatsDto) =>
  `${formatDate(goal.goal.startAt)} – ${formatDate(goal.goal.dueAt)}`;

function GoalPeriod({
  goal,
  label,
}: {
  goal: AmbassadorInviteGoalWithStatsDto;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface-2 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{label ?? period(goal)}</span>
        <span className="text-caption text-fg-muted">
          {label && `${period(goal)} · `}Target{" "}
          {formatCount(goal.goal.targetSuccessfulRecruits)}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Stat
          label="Created"
          value={formatCount(goal.stats.totalInvitesSent)}
        />
        <Stat
          label="Accepted"
          value={formatCount(goal.stats.totalAcceptedInvites)}
        />
        <Stat
          label="Successful"
          value={`${formatCount(goal.stats.goalSuccessfulRecruits)} / ${formatCount(goal.goal.targetSuccessfulRecruits)}`}
        />
      </dl>
    </div>
  );
}

function GoalGroup({
  title,
  goals,
}: {
  title: string;
  goals: readonly AmbassadorInviteGoalWithStatsDto[];
}) {
  if (goals.length === 0) return null;
  return (
    <details className="group/goals">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium focus-ring">
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-fg-muted transition-transform duration-fast group-open/goals:rotate-90"
        />
        {title} ({formatCount(goals.length)})
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {goals.map((goal) => (
          <GoalPeriod key={goal.goal.id} goal={goal} />
        ))}
      </div>
    </details>
  );
}

export function InviteGoals({
  member,
}: {
  member: AmbassadorProgramMemberDto;
}) {
  if (!member.inviteStats) return null;
  const { currentGoal, pastGoals, totals, upcomingGoals } = member.inviteStats;
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4">
      <h4 className="font-semibold">Ambassador invite goals</h4>
      <dl className="grid grid-cols-2 gap-3 @md:grid-cols-4">
        <Stat
          label="Created total"
          value={formatCount(totals.totalInvitesSent)}
        />
        <Stat
          label="Accepted total"
          value={formatCount(totals.totalAcceptedInvites)}
        />
        <Stat
          label="Successful total"
          value={formatCount(totals.totalSuccessfulRecruits)}
        />
        <Stat
          label="Goal periods"
          value={formatCount(
            (currentGoal ? 1 : 0) + pastGoals.length + upcomingGoals.length,
          )}
        />
      </dl>
      {currentGoal ? (
        <GoalPeriod goal={currentGoal} label="Current goal" />
      ) : (
        <p className="text-fg-muted">No current ambassador invite goal.</p>
      )}
      <GoalGroup title="Past growth periods" goals={pastGoals} />
      <GoalGroup title="Upcoming goals" goals={upcomingGoals} />
    </section>
  );
}

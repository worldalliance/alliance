import { millisecondsInDay } from "date-fns/constants";
import type { AmbassadorInviteGoalWithStatsDto } from "../client";

export const daysUntil = (date: Date, now = new Date()) =>
  Math.max(0, Math.ceil((date.getTime() - now.getTime()) / millisecondsInDay));

export const dateInputToEndOfDayIso = (value: string) =>
  new Date(`${value}T23:59:59`).toISOString();

export const dateInputToStartOfDayIso = (value: string) =>
  new Date(`${value}T00:00:00`).toISOString();

const padDatePart = (value: number) => String(value).padStart(2, "0");

export const dateToInputValue = (value: string | Date) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
};

export const todayDateInputValue = () => dateToInputValue(new Date());

export const oneMonthFromTodayDateInputValue = () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return dateToInputValue(nextMonth);
};

export const inviteGoalErrorMessage = (err: Error) => {
  if (err.message.toLowerCase().includes("overlap")) {
    return "Those dates overlap with an existing invite goal.";
  }
  return err.message;
};

/**
 * The goal to feature: the latest-started active goal, else the soonest
 * upcoming one, else the latest-due past one.
 */
export function selectCurrentInviteGoal(
  goals: AmbassadorInviteGoalWithStatsDto[],
  now = new Date(),
): AmbassadorInviteGoalWithStatsDto | undefined {
  const activeGoals = goals.filter((goal) => {
    const startAt = new Date(goal.goal.startAt);
    const dueAt = new Date(goal.goal.dueAt);
    return startAt <= now && dueAt >= now;
  });
  if (activeGoals.length > 0) {
    return [...activeGoals].sort(
      (a, b) =>
        new Date(b.goal.startAt).getTime() - new Date(a.goal.startAt).getTime(),
    )[0];
  }

  const futureGoals = goals.filter((goal) => new Date(goal.goal.startAt) > now);
  if (futureGoals.length > 0) {
    return [...futureGoals].sort(
      (a, b) =>
        new Date(a.goal.startAt).getTime() - new Date(b.goal.startAt).getTime(),
    )[0];
  }

  return [...goals].sort(
    (a, b) =>
      new Date(b.goal.dueAt).getTime() - new Date(a.goal.dueAt).getTime(),
  )[0];
}

export function selectPastInviteGoals(params: {
  goals: AmbassadorInviteGoalWithStatsDto[];
  currentGoal: AmbassadorInviteGoalWithStatsDto | undefined;
  now?: Date;
}): AmbassadorInviteGoalWithStatsDto[] {
  const { goals, currentGoal, now = new Date() } = params;
  return goals
    .filter(
      (goal) =>
        goal.goal.id !== currentGoal?.goal.id &&
        new Date(goal.goal.dueAt) < now,
    )
    .sort(
      (a, b) =>
        new Date(b.goal.dueAt).getTime() - new Date(a.goal.dueAt).getTime(),
    );
}

export const inviteGoalIsUp = (
  goal: AmbassadorInviteGoalWithStatsDto | undefined,
  now = new Date(),
) =>
  !goal ||
  new Date(goal.goal.dueAt) < now ||
  goal.stats.goalSuccessfulRecruits >= goal.goal.targetSuccessfulRecruits;

export function selectInviteGoals(
  goals: AmbassadorInviteGoalWithStatsDto[],
  now = new Date(),
) {
  const currentGoal = selectCurrentInviteGoal(goals, now);
  return {
    currentGoal,
    pastGoals: selectPastInviteGoals({ goals, currentGoal, now }),
  };
}

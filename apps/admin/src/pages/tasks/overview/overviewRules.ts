import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";

/** Rounded, or null when there is nothing to divide by. */
export const percentOf = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 100) : null;

export enum ReportStage {
  /** No events: a draft, with nothing to report. */
  Draft = "draft",
  /** Events exist, but members haven't started yet. */
  NotStarted = "not_started",
  Started = "started",
}

export const reportStage = (
  task: Pick<ParsedActionDto, "events">,
  now: Date,
): ReportStage => {
  if (task.events.length === 0) return ReportStage.Draft;
  return hasMemberActionStarted(task.events, now)
    ? ReportStage.Started
    : ReportStage.NotStarted;
};

/** Why a task that hasn't started has nothing to report, and when it will. */
export const notStartedNote = (
  task: Pick<ParsedActionDto, "memberActionStart">,
  now: Date,
): string => {
  const start = task.memberActionStart;
  if (start && new Date(start) > now) {
    return `Members start taking it ${formatDateTime(start, { weekday: true, timeZone: LAUNCH_TIME_ZONE })}. Completion, withdrawals and responses show here from then.`;
  }
  return "It has no Members taking action event, so completion, withdrawals and responses aren't reported here until one is added and starts.";
};

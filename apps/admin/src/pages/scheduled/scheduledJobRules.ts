import type {
  ActionSummaryDto,
  ProfileDto,
  ScheduledPlansOverviewDto,
} from "@alliance/shared/client/types.gen";
import { formatDate, formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";

export enum ScheduledJobKind {
  Suspension = "suspension",
  ForumAutocomplete = "forum-autocomplete",
}

export const JOB_KIND_LABELS: Record<ScheduledJobKind, string> = {
  [ScheduledJobKind.Suspension]: "Suspension",
  [ScheduledJobKind.ForumAutocomplete]: "Forum auto-complete",
};

export type ScheduledJob = {
  key: string;
  kind: ScheduledJobKind;
  date: string;
  users: ProfileDto[];
  /** The task a forum auto-complete completes; a suspension has none. */
  task: ActionSummaryDto | null;
};

/**
 * Every job due, soonest first. A suspension's date moves with each fetch, so
 * its key is its members, whom the server puts in one suspension only.
 */
export function scheduledJobs(
  plans: ScheduledPlansOverviewDto,
): ScheduledJob[] {
  return [
    ...plans.suspensionPlans.map((plan) => ({
      key: `suspension-${plan.users.map((user) => user.id).join("-")}`,
      kind: ScheduledJobKind.Suspension,
      date: plan.date,
      users: plan.users,
      task: null,
    })),
    ...plans.forumAutocompletePlans.map((plan) => ({
      key: `forum-${plan.action.id}`,
      kind: ScheduledJobKind.ForumAutocomplete,
      date: plan.date,
      users: plan.users,
      task: plan.action,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * When a job is due, at the server's precision, with the rest as a tooltip.
 * The endpoint samples suspensions every 6 hours from the range's start; a
 * forum auto-complete's date is 5 minutes before the task's deadline, and its
 * worker runs every 5 minutes.
 */
export function jobWhen(job: Pick<ScheduledJob, "kind" | "date">): {
  text: string;
  detail: string;
} {
  const zoned = { weekday: true, timeZone: LAUNCH_TIME_ZONE };
  const utc = formatDateTime(job.date, { weekday: true, timeZone: "UTC" });
  switch (job.kind) {
    case ScheduledJobKind.Suspension:
      return {
        text: `By ${formatDate(job.date, zoned)}`,
        detail: `Due by ${formatDateTime(job.date, zoned)} (${utc}). This list checks every 6 hours, so the suspension can come up to 6 hours sooner.`,
      };
    case ScheduledJobKind.ForumAutocomplete:
      return {
        text: formatDateTime(job.date, zoned),
        detail: `${utc}. 5 minutes before the task's deadline; the server runs it within 5 minutes of this time.`,
      };
    default:
      throw new Error(`unknown job kind: ${job.kind satisfies never}`);
  }
}

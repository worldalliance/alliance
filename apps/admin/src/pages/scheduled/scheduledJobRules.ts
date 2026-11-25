import type {
  ActionSummaryDto,
  ProfileDto,
  ScheduledPlansOverviewDto,
} from "@alliance/shared/client/types.gen";
import { href } from "react-router";

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

/** Every job the server plans to run, soonest first. */
export function scheduledJobs(
  plans: ScheduledPlansOverviewDto,
): ScheduledJob[] {
  return [
    ...plans.suspensionPlans.map((plan, index) => ({
      key: `suspension-${plan.date}-${index}`,
      kind: ScheduledJobKind.Suspension,
      date: plan.date,
      users: plan.users,
      task: null,
    })),
    ...plans.forumAutocompletePlans.map((plan, index) => ({
      key: `forum-${plan.date}-${plan.action.id}-${index}`,
      kind: ScheduledJobKind.ForumAutocomplete,
      date: plan.date,
      users: plan.users,
      task: plan.action,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export const taskHref = (task: { id: number }) =>
  href("/tasks/:actionId", { actionId: task.id.toString() });

export const memberHref = (user: { id: number }) =>
  href("/members/:userId", { userId: user.id.toString() });

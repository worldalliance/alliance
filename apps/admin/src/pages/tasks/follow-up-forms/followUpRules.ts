import type { CohortExpression } from "@alliance/common/cohort-expression";
import { isFollowUpFormActiveAt } from "@alliance/common/followUpForm";
import type { AdminFollowUpFormDto } from "@alliance/shared/client/types.gen";
import { isEqual } from "es-toolkit";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";

export enum FollowUpStatus {
  NoCohort = "noCohort",
  NoStart = "noStart",
  Scheduled = "scheduled",
  Open = "open",
  Ended = "ended",
}

export const FOLLOW_UP_STATUS_LABEL: Record<FollowUpStatus, string> = {
  [FollowUpStatus.NoCohort]: "No cohort",
  [FollowUpStatus.NoStart]: "No start date",
  [FollowUpStatus.Scheduled]: "Not started",
  [FollowUpStatus.Open]: "Open now",
  [FollowUpStatus.Ended]: "Ended",
};

/**
 * A member sees a follow-up form when they completed the task, are in its
 * cohort, and now falls in its window: a form without a start date never
 * opens, a form without a cohort matches nobody
 * (`server/src/actions/member-actions.service.ts`, `common/src/followUpForm.ts`).
 */
export function followUpStatus(
  form: Pick<
    AdminFollowUpFormDto,
    "cohortExpression" | "startDate" | "endDate"
  >,
  now: Date,
): FollowUpStatus {
  if (form.cohortExpression == null) return FollowUpStatus.NoCohort;
  if (!form.startDate) return FollowUpStatus.NoStart;
  if (new Date(form.startDate) > now) return FollowUpStatus.Scheduled;
  return isFollowUpFormActiveAt(form, now)
    ? FollowUpStatus.Open
    : FollowUpStatus.Ended;
}

const inLaunchZone = (iso: string) =>
  formatDateTime(iso, { timeZone: LAUNCH_TIME_ZONE });

/** The search param naming the follow-up form open in the tab. */
export const FOLLOW_UP_PARAM = "form";

/** "Nov 30, 9:00 AM PT to Dec 14, 9:00 AM PT", "From Nov 30, …", or "No start date". */
export function followUpWindow(
  form: Pick<AdminFollowUpFormDto, "startDate" | "endDate">,
): string {
  if (!form.startDate) return "No start date";
  const start = inLaunchZone(form.startDate);
  return form.endDate
    ? `${start} to ${inLaunchZone(form.endDate)}`
    : `From ${start}, no end date`;
}

export type FollowUpDraft = {
  name: string;
  instructions: string;
  /** A UTC instant, or "". */
  startDate: string;
  endDate: string;
  cohortExpression: CohortExpression | null;
};

export const draftOf = (
  form: AdminFollowUpFormDto,
  cohortExpression: CohortExpression | null,
): FollowUpDraft => ({
  name: form.name ?? "",
  instructions: form.instructions ?? "",
  startDate: form.startDate ?? "",
  endDate: form.endDate ?? "",
  cohortExpression,
});

const sameInstant = (a: string, b: string) =>
  a === b ||
  (a !== "" && b !== "" && new Date(a).getTime() === new Date(b).getTime());

export const isDraftDirty = (a: FollowUpDraft, b: FollowUpDraft): boolean =>
  a.name !== b.name ||
  a.instructions !== b.instructions ||
  !sameInstant(a.startDate, b.startDate) ||
  !sameInstant(a.endDate, b.endDate) ||
  !isEqual(a.cohortExpression, b.cohortExpression);

/** What `PATCH` stores: blank text becomes null, dates become ISO instants. */
export const updateBodyOf = (draft: FollowUpDraft) => ({
  name: draft.name.trim() || null,
  instructions: draft.instructions.trim() || null,
  startDate: draft.startDate ? new Date(draft.startDate).toISOString() : null,
  endDate: draft.endDate ? new Date(draft.endDate).toISOString() : null,
  cohortExpression: draft.cohortExpression,
});

/** Null when the dates are fine; otherwise how to fix them. */
export function windowError(draft: FollowUpDraft): string | null {
  if (
    draft.startDate &&
    draft.endDate &&
    new Date(draft.endDate) < new Date(draft.startDate)
  ) {
    return "Choose an end date after the start date";
  }
  return null;
}

export const UNREADABLE_COHORT_NOTE =
  "Saving is off: the stored cohort couldn't be read.";

/** What saving these fields does for members, from the draft being saved. */
export function saveNote(
  draft: FollowUpDraft,
  { cohortUnreadable }: { cohortUnreadable: boolean },
): string {
  if (cohortUnreadable) return UNREADABLE_COHORT_NOTE;
  if (draft.cohortExpression == null) {
    return "With no target cohort, nobody sees this form.";
  }
  if (!draft.startDate) {
    return "With no start date, no member sees this form yet.";
  }
  const until = draft.endDate
    ? `until ${inLaunchZone(draft.endDate)}`
    : "with no end date";
  return `Saving updates what members see on their next load: members in the cohort who completed the task see this form from ${inLaunchZone(draft.startDate)}, ${until}.`;
}

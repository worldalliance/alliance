import { isFollowUpFormActiveAt } from "@alliance/common/followUpForm";
import type {
  ActionEventDto,
  ActionStatus,
  AdminActionListItemDto,
  AdminFollowUpFormDto,
  GeneralUpdateAdminDto,
} from "@alliance/shared/client";

export enum PlacementBadge {
  ActiveTask = "active_task",
  Active = "active",
  Onboarding = "onboarding",
  AvailableAfterDeadline = "available_after_deadline",
  Scheduled = "scheduled",
  Draft = "draft",
  Unscheduled = "unscheduled",
  StaffPreview = "staff_preview",
}

export const PLACEMENT_BADGE_COPY: Record<
  PlacementBadge,
  { label: string; description: string }
> = {
  [PlacementBadge.ActiveTask]: {
    label: "Active task",
    description: "Open for members to act on now.",
  },
  [PlacementBadge.Active]: {
    label: "Active",
    description: "Started and not yet past its end date.",
  },
  [PlacementBadge.Onboarding]: {
    label: "Onboarding",
    description: "Assigned to new members as part of onboarding.",
  },
  [PlacementBadge.AvailableAfterDeadline]: {
    label: "Available after deadline",
    description:
      "Stays on the home page of members who haven't done it after the deadline passes.",
  },
  [PlacementBadge.Scheduled]: {
    label: "Scheduled",
    description:
      "Opens to members at a later date; a follow-up also waits for its parent action to open.",
  },
  [PlacementBadge.Draft]: {
    label: "Draft",
    description:
      "No member-action date yet, so not on ordinary member home pages.",
  },
  [PlacementBadge.Unscheduled]: {
    label: "Unscheduled",
    description: "No start date yet, so not on member home pages.",
  },
  [PlacementBadge.StaffPreview]: {
    label: "Staff preview",
    description: "Staff see it on their home page before it opens to members.",
  },
};

export enum InactiveReason {
  Archived = "archived",
  PublicOnly = "public_only",
  CompletionBlocked = "completion_blocked",
  Closed = "closed",
  Expired = "expired",
  Unscheduled = "unscheduled",
  EndsBeforeStart = "ends_before_start",
  EndsBeforeParentOpens = "ends_before_parent_opens",
  NoCohort = "no_cohort",
  ParentArchived = "parent_archived",
  ParentPublicOnly = "parent_public_only",
  ParentUnscheduled = "parent_unscheduled",
  ParentDraft = "parent_draft",
}

export const INACTIVE_REASON_COPY: Record<InactiveReason, string> = {
  [InactiveReason.Archived]: "Archived",
  [InactiveReason.PublicOnly]: "Public only: not a member task",
  [InactiveReason.CompletionBlocked]: "Completion blocked",
  [InactiveReason.Closed]:
    "No member action open, upcoming, or shown after its deadline",
  [InactiveReason.Expired]: "Past its end date",
  [InactiveReason.Unscheduled]: "No start date",
  [InactiveReason.EndsBeforeStart]: "Ends before it starts",
  [InactiveReason.EndsBeforeParentOpens]:
    "Ends before its parent action opens to members",
  [InactiveReason.NoCohort]: "No target cohort",
  [InactiveReason.ParentArchived]: "Parent action is archived",
  [InactiveReason.ParentPublicOnly]: "Parent action is public only",
  [InactiveReason.ParentUnscheduled]: "Parent action has no member-action date",
  [InactiveReason.ParentDraft]:
    "Parent action is in draft whenever the form is open",
};

export type HomePlacement =
  | { badges: PlacementBadge[]; inactive: null }
  | { badges: []; inactive: InactiveReason };

const inactive = (reason: InactiveReason): HomePlacement => ({
  badges: [],
  inactive: reason,
});

/**
 * Could the action reach any member's home page, now or later? Mirrors the
 * configuration half of `shouldCompleteAction` and `userCanSeeAction`; which
 * members it reaches depends on cohorts this does not evaluate.
 */
export function actionHomePlacement(params: {
  action: Pick<
    AdminActionListItemDto,
    | "archived"
    | "publicOnly"
    | "preventCompletion"
    | "staffPreview"
    | "onboarding"
    | "shouldCompleteAfterDeadline"
    | "events"
  >;
  now: Date;
}): HomePlacement {
  const { action, now } = params;
  if (action.archived) return inactive(InactiveReason.Archived);
  if (action.publicOnly) return inactive(InactiveReason.PublicOnly);

  const opens = memberActionDates(action.events);
  const started = opens.some((date) => date <= now);
  const scheduled = opens.some((date) => date > now);
  const staffPreview = action.staffPreview && !started;
  if (action.preventCompletion && !staffPreview) {
    return inactive(InactiveReason.CompletionBlocked);
  }

  const status = statusAt({ events: action.events, now });
  const active = status === "member_action";
  const afterDeadline =
    action.shouldCompleteAfterDeadline &&
    !action.preventCompletion &&
    (started ? status !== "draft" : scheduled);
  const unscheduledDraft =
    !started && !scheduled && (status === "draft" || status === "planned");
  if (
    !active &&
    !afterDeadline &&
    !scheduled &&
    !unscheduledDraft &&
    !staffPreview
  ) {
    return inactive(InactiveReason.Closed);
  }

  const badges: PlacementBadge[] = [];
  if (active) badges.push(PlacementBadge.ActiveTask);
  if (action.onboarding) badges.push(PlacementBadge.Onboarding);
  if (afterDeadline) badges.push(PlacementBadge.AvailableAfterDeadline);
  if (scheduled && !active && !action.preventCompletion) {
    badges.push(PlacementBadge.Scheduled);
  }
  if (unscheduledDraft) badges.push(PlacementBadge.Draft);
  if (staffPreview) badges.push(PlacementBadge.StaffPreview);
  return { badges, inactive: null };
}

function memberActionDates(events: ActionEventDto[]): Date[] {
  return events
    .filter((event) => event.newStatus === "member_action")
    .map((event) => new Date(event.date));
}

// Recomputes the server's `Action.status` getter at `now`, so a list fetched
// before an event passed still agrees with the event dates read here.
function statusAt(params: {
  events: ActionEventDto[];
  now: Date;
}): ActionStatus {
  const { events, now } = params;
  const past = events.filter((event) => new Date(event.date) < now);
  if (past.length === 0) return "draft";
  return past.reduce((latest, event) =>
    new Date(event.date) > new Date(latest.date) ? event : latest,
  ).newStatus;
}

export function generalUpdateHomePlacement(params: {
  generalUpdate: Pick<GeneralUpdateAdminDto, "startDate" | "endDate">;
  now: Date;
}): HomePlacement {
  const { generalUpdate, now } = params;
  if (generalUpdate.endDate && new Date(generalUpdate.endDate) <= now) {
    return inactive(InactiveReason.Expired);
  }
  if (!generalUpdate.startDate) {
    return { badges: [PlacementBadge.Unscheduled], inactive: null };
  }
  return {
    badges: [
      new Date(generalUpdate.startDate) > now
        ? PlacementBadge.Scheduled
        : PlacementBadge.Active,
    ],
    inactive: null,
  };
}

export function followUpHomePlacement(params: {
  followUpForm: Pick<
    AdminFollowUpFormDto,
    "startDate" | "endDate" | "cohortExpression"
  >;
  parent: Pick<AdminActionListItemDto, "archived" | "publicOnly" | "events">;
  now: Date;
}): HomePlacement {
  const { followUpForm, parent, now } = params;
  if (parent.archived) return inactive(InactiveReason.ParentArchived);
  if (parent.publicOnly) return inactive(InactiveReason.ParentPublicOnly);
  const parentOpens = memberActionDates(parent.events).map((date) =>
    date.getTime(),
  );
  if (parentOpens.length === 0) {
    return inactive(InactiveReason.ParentUnscheduled);
  }
  if (!followUpForm.cohortExpression) return inactive(InactiveReason.NoCohort);
  if (!followUpForm.startDate) return inactive(InactiveReason.Unscheduled);
  const start = new Date(followUpForm.startDate);
  if (!isFollowUpFormActiveAt(followUpForm, start)) {
    return inactive(InactiveReason.EndsBeforeStart);
  }
  const firstOpen = Math.min(...parentOpens);
  if (
    !isFollowUpFormActiveAt(
      followUpForm,
      new Date(Math.max(start.getTime(), firstOpen)),
    )
  ) {
    return inactive(InactiveReason.EndsBeforeParentOpens);
  }
  // Members receive it while the form is active and the parent has opened and
  // isn't in draft. Those only change at the form's start or a parent event.
  const reachesMembersAt = (time: number) =>
    firstOpen <= time &&
    isFollowUpFormActiveAt(followUpForm, new Date(time)) &&
    statusAt({ events: parent.events, now: new Date(time + 1) }) !== "draft";
  const firstReach = [
    now.getTime(),
    start.getTime(),
    ...parent.events.map((event) => new Date(event.date).getTime()),
  ]
    .filter((time) => time >= now.getTime())
    .sort((a, b) => a - b)
    .find(reachesMembersAt);
  if (firstReach === undefined) {
    return inactive(
      followUpForm.endDate && new Date(followUpForm.endDate) < now
        ? InactiveReason.Expired
        : InactiveReason.ParentDraft,
    );
  }
  return {
    badges: [
      firstReach === now.getTime()
        ? PlacementBadge.Active
        : PlacementBadge.Scheduled,
    ],
    inactive: null,
  };
}

import {
  eventInEffectAt,
  hasMemberActionStarted,
} from "@alliance/common/actionEvent";
import type {
  ActionEventDto,
  ActionStatus,
  VisibilityMode,
} from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";

export enum PhaseStepState {
  Past = "past",
  Current = "current",
  Upcoming = "upcoming",
}

export type PhaseStep = {
  id: number;
  status: ActionStatus;
  date: string;
  state: PhaseStepState;
};

/** The task's events as the phases it has been through and will enter, oldest first. */
export const phaseSteps = (
  events: readonly ActionEventDto[],
  now: Date,
): PhaseStep[] => {
  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const current = eventInEffectAt(sorted, now).event;
  return sorted.map((event) => ({
    id: event.id,
    status: event.newStatus,
    date: event.date,
    state:
      event.id === current?.id
        ? PhaseStepState.Current
        : new Date(event.date) <= now
          ? PhaseStepState.Past
          : PhaseStepState.Upcoming,
  }));
};

const SEEN_OUT_OF_DRAFT: Record<VisibilityMode, string> = {
  public: "Anyone, signed in or not",
  all_members: "Every signed-in member",
  participating_groups: "Members in the cohort",
};

export type TaskVisibility = {
  /** Who sees the task once any event other than Draft is in effect, unless archived. */
  outOfDraft: string;
  /** Who sees it while it is a draft. */
  asDraft: string;
  /** Whether the page opens to anyone who has its link, whatever the task's phase. */
  openByLink: boolean;
  notes: string[];
};

/**
 * The two visibility settings in words: who sees the task once out of draft, and
 * whether its page opens to anyone with the link at any time. Follows
 * `userCanSeeAction` and `userCanOpenAction` on the server.
 */
export const taskVisibility = (
  task: Pick<
    ParsedActionDto,
    "visibilityMode" | "publicOnly" | "staffPreview" | "archived"
  >,
): TaskVisibility => ({
  outOfDraft: SEEN_OUT_OF_DRAFT[task.visibilityMode],
  asDraft: task.publicOnly
    ? "Anyone who has the link, though no feed lists it"
    : task.staffPreview && !task.archived
      ? "Admins, and staff while staff preview is on"
      : "Admins only",
  openByLink: task.publicOnly,
  notes: [
    ...(task.visibilityMode === "public"
      ? ["The cohort still decides who is assigned, reminded and counted."]
      : []),
    ...(task.publicOnly
      ? [
          "Its page opens to anyone who has the link, signed in or not, even while the task is a draft or archived. Members' feeds leave it out.",
        ]
      : []),
    ...(task.archived
      ? [
          task.publicOnly
            ? "Archived, so it is out of members' feeds, but its page still opens by link."
            : "Archived, so only admins can open it.",
        ]
      : []),
  ],
});

export type UnarchiveConsequence = {
  message: string;
  /** Whether unarchiving shows the task to members, now or on a scheduled event. */
  exposes: boolean;
};

/**
 * What unarchiving does at `now`, for its confirmation. Follows `userCanSeeAction`,
 * which hides a task only while archived or while Draft is the event in effect.
 */
export const unarchiveConsequence = (
  task: Pick<ParsedActionDto, "events" | "staffPreview">,
  now: Date,
): UnarchiveConsequence => {
  const draftNow =
    (eventInEffectAt(task.events, now).event?.newStatus ?? "draft") === "draft";
  const leavesDraft = phaseSteps(task.events, now).find(
    (step) => step.state === PhaseStepState.Upcoming && step.status !== "draft",
  );
  const seen = !draftNow
    ? "It is out of draft, so everyone who could see it before it was archived sees it again at once."
    : leavesDraft
      ? `It is a draft until ${formatDateTime(leavesDraft.date, { weekday: true, timeZone: LAUNCH_TIME_ZONE })}, when its audience sees it without another step.`
      : "It is a draft, so it stays out of members' feeds.";
  const staff =
    draftNow && task.staffPreview && !hasMemberActionStarted(task.events, now)
      ? " Staff preview is on, so staff see it again at once."
      : "";
  return {
    message: `${seen}${staff} It also returns to the tasks list.`,
    exposes: !draftNow || leavesDraft !== undefined,
  };
};

/** What Duplicate copies, and what the copy exposes the moment it exists. */
export const duplicateConsequence = (
  task: Pick<ParsedActionDto, "staffPreview" | "publicOnly">,
): string =>
  [
    "The copy takes the saved details, suite, cohort, prerequisites and visibility settings, and a copy of the form. It gets no reviewers, events, variants, follow-up forms or updates, so it starts as a draft.",
    ...(task.staffPreview
      ? ["Staff preview is on, so staff see the copy at once."]
      : []),
    ...(task.publicOnly
      ? [
          "Its page opens by link, so anyone who has the copy's link can open it at once.",
        ]
      : []),
  ].join("\n");

import { eventInEffectAt } from "@alliance/common/actionEvent";
import type {
  ActionEventDto,
  ActionStatus,
  CreateActionEventDto,
} from "@alliance/shared/client";
import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { TZDate } from "@date-fns/tz";
import { addDays } from "date-fns";
import { DEFAULT_EVENT_NAMES } from "../../../lib/actionStatusDisplay";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { phaseLabel } from "../../../ui/PhaseBadge";
import type { ConfirmOptions } from "../../../ui/ToastProvider";
import { taskVisibility } from "../taskFacts";

export type AddActionEvent = ReturnType<typeof useActionAdmin>["addEvent"];

export const LAUNCH_CONFIRM_TEXT = "launch to real members";

/** The statuses in use, offered first. */
export const OFFERED_STATUSES: readonly ActionStatus[] = [
  "member_action",
  "office_action",
  "completed",
];

/** The rest, in phase order, behind "More statuses". */
export const MORE_STATUSES: readonly ActionStatus[] = [
  "draft",
  "planned",
  "resolution",
  "failed",
  "abandoned",
];

export type DeadlineStatus = Extract<
  ActionStatus,
  "office_action" | "completed"
>;

export const DEADLINE_STATUSES: readonly DeadlineStatus[] = [
  "office_action",
  "completed",
];

export enum EventTargetKind {
  Task = "task",
  Suite = "suite",
}

export type EventTarget =
  | {
      kind: EventTargetKind.Task;
      task: Pick<
        ParsedActionDto,
        "events" | "archived" | "publicOnly" | "staffPreview" | "visibilityMode"
      >;
    }
  | { kind: EventTargetKind.Suite };

export enum EventEffect {
  /** Members taking action: always the typed launch phrase. */
  Launch = "launch",
  /** Takes a draft out of Draft, so members can see it. */
  ShowsDraft = "shows-draft",
  /** A Draft event on a task members can see then. */
  HidesTask = "hides-task",
  None = "none",
}

const statusAt = (events: readonly ActionEventDto[], at: Date): ActionStatus =>
  eventInEffectAt([...events], at).event?.newStatus ?? "draft";

/**
 * What an event of `status` dated `at` does to who can see the task, from the
 * task's other events. A suite's tasks are not known here, so any non-Draft
 * event is taken to show a draft.
 */
export function eventEffect(params: {
  target: EventTarget;
  status: ActionStatus;
  at: Date;
}): EventEffect {
  const { target, status, at } = params;
  if (status === "member_action") return EventEffect.Launch;
  const before =
    target.kind === EventTargetKind.Task
      ? statusAt(target.task.events, at)
      : status === "draft"
        ? null
        : "draft";
  if (status === "draft") {
    return before === "draft" ? EventEffect.None : EventEffect.HidesTask;
  }
  return before === "draft" ? EventEffect.ShowsDraft : EventEffect.None;
}

const inPacific = (at: Date) =>
  formatDateTime(at, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

/**
 * The confirmation an event needs before it is sent, or `null` when it needs
 * none. `opensNow` is whether its time has come by the time staff are asked.
 */
export function eventConfirm(params: {
  effect: EventEffect;
  target: EventTarget;
  status: ActionStatus;
  at: Date;
  opensNow: boolean;
}): Omit<ConfirmOptions, "signal"> | null {
  const { effect, target, status, at, opensNow } = params;
  const suite = target.kind === EventTargetKind.Suite;
  const when = opensNow ? "immediately" : `on ${inPacific(at)}`;
  const skipsChecks = suite ? " This skips the suite launch checks." : "";
  const archived =
    target.kind === EventTargetKind.Task && target.task.archived
      ? " It is archived, so members see it only once it is unarchived."
      : "";
  switch (effect) {
    case EventEffect.Launch:
      return {
        title: opensNow ? "Launch to members now?" : "Schedule this launch?",
        message: `${suite ? "Every task in this suite" : "This task"} opens to its members ${when}.${skipsChecks}${archived}`,
        confirmLabel: "Launch",
        cancelLabel: "Cancel",
        requiredText: LAUNCH_CONFIRM_TEXT,
      };
    case EventEffect.ShowsDraft:
      return {
        title: suite
          ? "Make this suite's draft tasks visible to members?"
          : "Make this draft visible to members?",
        message: suite
          ? `An event setting ${phaseLabel(status)} takes every task in this suite that is still a draft out of Draft, so each becomes visible to its members ${when}.${skipsChecks}`
          : `This task is a draft. An event setting ${phaseLabel(status)} takes it out of Draft, so it becomes visible to its members ${when}.${archived}`,
        confirmLabel: "Add event",
        cancelLabel: "Cancel",
        requiredText: LAUNCH_CONFIRM_TEXT,
      };
    case EventEffect.HidesTask: {
      const from = opensNow ? "From now" : `From ${inPacific(at)}`;
      return {
        title: suite
          ? "Make this suite's tasks drafts again?"
          : "Make this task a draft again?",
        message:
          target.kind === EventTargetKind.Suite
            ? `${from}, every task in this suite is a draft, and members can no longer see them.`
            : `${from}, the task is a draft, and members can no longer see it. As a draft it is seen by: ${taskVisibility(target.task).asDraft.toLowerCase()}.${target.task.publicOnly ? " Its page still opens for anyone with the link." : ""}`,
        confirmLabel: "Add event",
        cancelLabel: "Cancel",
      };
    }
    case EventEffect.None:
      return null;
    default:
      throw new Error(`unknown effect: ${effect satisfies never}`);
  }
}

export type EventDraft = {
  status: ActionStatus | "";
  customTitle: boolean;
  title: string;
  description: string;
  takeEffectNow: boolean;
  /** UTC instant, or "" until picked. Never defaults to now. */
  date: string;
  deadline: boolean;
  deadlineDate: string;
  deadlineStatus: DeadlineStatus;
};

/** A week from today at 23:59 Pacific time. */
export const defaultDeadline = (now: Date): string => {
  const day = addDays(new TZDate(now, LAUNCH_TIME_ZONE), 7);
  day.setHours(23, 59, 0, 0);
  return new Date(day.getTime()).toISOString();
};

export const emptyEventDraft = (now: Date): EventDraft => ({
  status: "",
  customTitle: false,
  title: "",
  description: "",
  takeEffectNow: false,
  date: "",
  deadline: false,
  deadlineDate: defaultDeadline(now),
  deadlineStatus: "office_action",
});

export const DEADLINE_TOO_EARLY =
  "The deadline must come after the launch. Pick a later one.";

export const addsDeadline = (draft: EventDraft) =>
  draft.deadline && draft.status === "member_action";

export const deadlineTooEarly = (draft: EventDraft, at: Date) =>
  addsDeadline(draft) &&
  draft.deadlineDate !== "" &&
  new Date(draft.deadlineDate) <= at;

export type DraftErrors = Partial<
  Record<"status" | "title" | "date" | "deadlineDate", string>
>;

/** What's wrong with the draft, checked before anything is asked or sent. */
export function draftErrors(draft: EventDraft, now: Date): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.status === "") errors.status = "Choose a status";
  if (draft.customTitle && draft.title.trim() === "") {
    errors.title = "Enter a title";
  }
  if (!draft.takeEffectNow && draft.date === "") {
    errors.date = "Choose a date and time, or take effect now";
  }
  if (addsDeadline(draft)) {
    if (draft.deadlineDate === "") errors.deadlineDate = "Choose a deadline";
    else if (
      deadlineTooEarly(draft, draft.takeEffectNow ? now : new Date(draft.date))
    ) {
      errors.deadlineDate = DEADLINE_TOO_EARLY;
    }
  }
  return errors;
}

export const eventBody = (
  draft: EventDraft & { status: ActionStatus },
  at: Date,
): CreateActionEventDto => ({
  newStatus: draft.status,
  title: draft.customTitle
    ? draft.title.trim()
    : DEFAULT_EVENT_NAMES[draft.status],
  description: draft.customTitle ? draft.description : "",
  date: at.toISOString(),
});

export const deadlineBody = (draft: EventDraft): CreateActionEventDto => ({
  newStatus: draft.deadlineStatus,
  title: DEFAULT_EVENT_NAMES[draft.deadlineStatus],
  description: "",
  date: draft.deadlineDate,
});

/** What the event will do, said under the form before staff add it. */
export function effectNote(params: {
  target: EventTarget;
  draft: EventDraft;
  now: Date;
}): string {
  const { target, draft, now } = params;
  if (draft.status === "") return "";
  const at =
    draft.takeEffectNow || draft.date === "" ? now : new Date(draft.date);
  const suite = target.kind === EventTargetKind.Suite;
  const effect = eventEffect({ target, status: draft.status, at });
  switch (effect) {
    case EventEffect.Launch:
      return suite
        ? "Launches every task in this suite to its members from this date, without the suite launch checks."
        : "Launches the task to its members from this date.";
    case EventEffect.ShowsDraft:
      return suite
        ? "Takes the suite's draft tasks out of Draft: members can see them from this date."
        : "Takes the task out of Draft: members can see it from this date.";
    case EventEffect.HidesTask:
      return suite
        ? "Makes the suite's tasks drafts again from this date: members stop seeing them."
        : "Makes the task a draft again from this date: members stop seeing it.";
    case EventEffect.None:
      return draft.status === "draft"
        ? "The task is already a draft at this date, so members can't see it either way."
        : `Members who can see the task see it as ${phaseLabel(draft.status)} from this date.`;
    default:
      throw new Error(`unknown effect: ${effect satisfies never}`);
  }
}

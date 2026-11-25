import { memberActionPhase } from "@alliance/common/actionEvent";
import type {
  ActionDto,
  ActionEventDto,
  ActionEventNotifDto,
  ActionSuiteDto,
  PreviewNotificationPlanDto,
  ReminderCohortType,
  ReminderGroupDto,
} from "@alliance/shared/client";
import { groupSendStart } from "./groupSchedule";

export type MemberEvent = { event: ActionEventDto; task: ActionDto };

/** Every members taking action event of the suite's tasks, a group's possible home. */
export const suiteMemberEvents = (suite: ActionSuiteDto): MemberEvent[] =>
  suite.actions.flatMap((task) =>
    (task.events ?? [])
      .filter((event) => event.newStatus === "member_action")
      .map((event) => ({ event, task })),
  );

/**
 * The events whose groups make up the suite's reminders: each task's members
 * taking action events, and any event a group linked to the suite hangs on.
 */
export const reminderEventIds = (suite: ActionSuiteDto): number[] =>
  [
    ...new Set([
      ...suiteMemberEvents(suite).map(({ event }) => event.id),
      ...suite.reminderGroups.flatMap((group) =>
        group.memberActionEvent ? [group.memberActionEvent.id] : [],
      ),
    ]),
  ].sort((a, b) => a - b);

/**
 * Where a new group goes: the event most of the suite's groups already hang
 * on, so they share recipients; else the suite's shared members taking action
 * event, which launch gives the default reminders; else the first one.
 */
export const defaultEventId = (
  suite: ActionSuiteDto,
  groups: readonly ReminderGroupDto[],
): number | null => {
  const candidates = suiteMemberEvents(suite).map(({ event }) => event.id);
  const counts = new Map<number, number>();
  for (const group of groups) {
    const id = group.memberActionEvent?.id;
    if (id !== undefined && candidates.includes(id)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const [busiest] = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const shared = suite.events.find(
    (event) => event.newStatus === "member_action",
  );
  return busiest?.[0] ?? shared?.id ?? candidates[0] ?? null;
};

export const groupTask = (
  suite: ActionSuiteDto,
  group: ReminderGroupDto,
): ActionDto | null =>
  suiteMemberEvents(suite).find(
    ({ event }) => event.id === group.memberActionEvent?.id,
  )?.task ?? null;

/** The deadline that follows a members taking action event in its task. */
export const deadlineAfter = (
  task: ActionDto | null,
  eventId: number | null,
): ActionEventDto | null => {
  if (!task || eventId === null) return null;
  const phase = memberActionPhase(task.events ?? []);
  return phase.event?.id === eventId ? (phase.deadlineEvent ?? null) : null;
};

/**
 * What a deadline-relative group's send time counts from: its dependency
 * anchor when set, else its own deadline event.
 */
export const timingReference = (
  suite: ActionSuiteDto,
  group: ReminderGroupDto,
) =>
  group.timingAnchorEvent ??
  group.deadlineEvent ??
  deadlineAfter(groupTask(suite, group), group.memberActionEvent?.id ?? null);

export type SortedGroup = { group: ReminderGroupDto; sendStart: Date | null };

/** By first send, undated last, then by id. */
export const sortGroups = (
  suite: ActionSuiteDto,
  groups: readonly ReminderGroupDto[],
): SortedGroup[] =>
  groups
    .map((group) => ({
      group,
      sendStart: groupSendStart(group, timingReference(suite, group)),
    }))
    .sort(
      (a, b) =>
        (a.sendStart?.getTime() ?? Infinity) -
          (b.sendStart?.getTime() ?? Infinity) || a.group.id - b.group.id,
    );

export enum GroupState {
  Planned = "planned",
  Sent = "sent",
  Processed = "processed",
  NothingPlanned = "nothingPlanned",
}

/**
 * Where a group stands, from its stored flag and, once loaded, its plans and
 * sends. Null while its details are loading and it isn't flagged processed.
 */
export const groupState = (
  group: ReminderGroupDto,
  details:
    | { plans: PreviewNotificationPlanDto[]; sent: ActionEventNotifDto[] }
    | undefined,
): GroupState | null => {
  if (group.allSent) return GroupState.Processed;
  if (!details) return null;
  if (details.plans.length > 0) return GroupState.Planned;
  return details.sent.length > 0 ? GroupState.Sent : GroupState.NothingPlanned;
};

export const COHORT_LABELS: Record<ReminderCohortType, string> = {
  all_uncompleted: "All uncompleted",
  tag: "User tag",
  custom: "Custom recipients",
  group_leads_with_uncompleted: "Group leads with uncompleted members",
};

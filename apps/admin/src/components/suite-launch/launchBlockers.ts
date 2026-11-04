import { pickForCount } from "@alliance/common/plural";
import type { ActionEventDto } from "@alliance/shared/client";
import { ACTION_STATUS_LABELS } from "../../lib/actionStatusDisplay";
import {
  remindersBeforeLaunch,
  type ReminderSendWindow,
} from "./launchReminders";
import { scheduleProblems, type LaunchSchedule } from "./launchSchedule";
import type { LaunchAction, SuiteLaunchData } from "./useSuiteLaunchData";

/** Each value is the DOM id of the section that resolves the blocker. */
export enum LaunchSection {
  Contract = "launch-contract",
  Schedule = "launch-schedule",
  Reminders = "launch-reminders",
  Actions = "launch-actions",
  Text = "launch-text",
}

export type LaunchBlocker = { message: string; section: LaunchSection | null };

const plural = (count: number, one: string, many: string) =>
  `${count} ${pickForCount(count, one, many)}`;

export const hasLaunched = (
  events: readonly Pick<ActionEventDto, "newStatus">[],
) => events.some((event) => event.newStatus === "member_action");

/** Why the suite's own events already rule out launching, if they do. */
export function existingLaunchEvent(
  events: readonly Pick<ActionEventDto, "newStatus">[],
): string | null {
  if (hasLaunched(events)) {
    return "This suite already has a members taking action event.";
  }
  if (events.some((event) => event.newStatus === "office_action")) {
    return "This suite already has an office taking action event. Delete it from the suite's events, then launch.";
  }
  return null;
}

/**
 * Members' deadline is the first event after they start, whatever its
 * status, so an event dated from their start to the office deadline would
 * end their time early.
 */
export function eventBeforeDeadline(
  events: readonly Pick<ActionEventDto, "newStatus" | "date">[],
  schedule: LaunchSchedule,
): string | null {
  const early = events.find((event) => {
    const date = new Date(event.date);
    return date >= schedule.memberActionAt && date <= schedule.officeActionAt;
  });
  return early
    ? `This suite has a "${ACTION_STATUS_LABELS[early.newStatus]}" event before the office deadline, which would end members' time early. Move office taking action before it, or delete it on the suite page.`
    : null;
}

const CHECKLIST_KEY_PREFIX = "checklist:";

// One per missing item, so a newly missing item asks again and fixing one keeps the rest dismissed.
export const checklistKey = (actionId: number, itemId: string) =>
  `${CHECKLIST_KEY_PREFIX}${actionId}:${itemId}`;

type ChecklistEntry = {
  action: { id: number };
  unready: readonly { id: string }[];
};

export const checklistDismissKeys = (entry: ChecklistEntry) =>
  entry.unready.map((item) => checklistKey(entry.action.id, item.id));

/** Every dismissed checklist key of the action, including those of items fixed since. */
export const actionChecklistDismissals = (
  actionId: number,
  dismissedKeys: ReadonlySet<string>,
) =>
  [...dismissedKeys].filter((key) =>
    key.startsWith(checklistKey(actionId, "")),
  );

/**
 * Dismissed checklist keys whose items are no longer missing from `actions`,
 * which must be every action in the suite: an action taken out of it loses
 * its dismissals too.
 */
export const fixedChecklistDismissals = (
  actions: readonly ChecklistEntry[],
  dismissedKeys: ReadonlySet<string>,
) => {
  const missing = new Set(actions.flatMap(checklistDismissKeys));
  return [...dismissedKeys].filter(
    (key) => key.startsWith(CHECKLIST_KEY_PREFIX) && !missing.has(key),
  );
};

export const checklistBlocks = (
  entry: ChecklistEntry,
  dismissedKeys: ReadonlySet<string>,
) => checklistDismissKeys(entry).some((key) => !dismissedKeys.has(key));

export function launchBlockers(params: {
  data: Pick<
    SuiteLaunchData,
    | "recipientCount"
    | "textFindings"
    | "errors"
    | "loading"
    | "spellcheckLoading"
  > & {
    actions: (Pick<LaunchAction, "unready" | "ownMemberStart"> & {
      action: { id: number };
    })[];
  };
  schedule: LaunchSchedule;
  reminderWindows: ReminderSendWindow[];
  suiteEvents: readonly Pick<ActionEventDto, "newStatus" | "date">[];
  checkedActionIds: ReadonlySet<number>;
  dismissedKeys: ReadonlySet<string>;
  violations: readonly string[];
  violationsAcknowledged: boolean;
  now: Date;
}): LaunchBlocker[] {
  const {
    data,
    schedule,
    reminderWindows,
    suiteEvents,
    checkedActionIds,
    dismissedKeys,
    violations,
    violationsAcknowledged,
    now,
  } = params;
  const existing = existingLaunchEvent(suiteEvents);
  if (existing) return [{ message: existing, section: null }];
  if (data.loading || data.spellcheckLoading) {
    return [{ message: "Checks are loading.", section: null }];
  }

  const blockers: LaunchBlocker[] = [];
  const block = (section: LaunchSection | null, message: string) =>
    blockers.push({ message, section });
  if (data.errors.length > 0) block(null, "Some checks failed to load.");
  for (const problem of scheduleProblems(schedule, now)) {
    block(LaunchSection.Schedule, problem);
  }
  const eventInWindow = eventBeforeDeadline(suiteEvents, schedule);
  if (eventInWindow) block(LaunchSection.Schedule, eventInWindow);
  const early = remindersBeforeLaunch(reminderWindows, schedule);
  if (early.length > 0) {
    block(
      LaunchSection.Reminders,
      `${plural(early.length, "reminder would", "reminders would")} send before members start. Move office taking action later.`,
    );
  }
  if (data.recipientCount === 0) {
    block(LaunchSection.Actions, "No member is assigned any action.");
  }
  if (data.recipientCount === null) {
    block(LaunchSection.Actions, "The member count is unknown.");
  }
  const ownEvents = data.actions.filter(
    ({ ownMemberStart }) => ownMemberStart !== null,
  );
  if (ownEvents.length > 0) {
    block(
      LaunchSection.Actions,
      `${plural(ownEvents.length, "action already has its", "actions already have their")} own members taking action event. Delete it, or take the action out of the suite, before launching.`,
    );
  }
  const unready = data.actions.filter((entry) =>
    checklistBlocks(entry, dismissedKeys),
  );
  if (unready.length > 0) {
    block(
      LaunchSection.Actions,
      `${plural(unready.length, "action has", "actions have")} unfinished checklist items.`,
    );
  }
  if (violations.length > 0 && !violationsAcknowledged) {
    block(
      LaunchSection.Contract,
      `${plural(violations.length, "contract violation", "contract violations")} to fix or accept.`,
    );
  }
  const unchecked = data.actions.filter(
    ({ action }) => !checkedActionIds.has(action.id),
  );
  if (unchecked.length > 0) {
    block(
      LaunchSection.Actions,
      `${plural(unchecked.length, "action isn't", "actions aren't")} marked ready to launch.`,
    );
  }
  const open = new Set(
    data.textFindings
      .map((finding) => finding.dismissKey)
      .filter((key) => !dismissedKeys.has(key)),
  );
  if (open.size > 0) {
    block(
      LaunchSection.Text,
      `${plural(open.size, "text finding", "text findings")} to fix or dismiss.`,
    );
  }
  return blockers;
}

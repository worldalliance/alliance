import type { ActionEventDto } from "@alliance/shared/client";
import { contractViolations } from "./contractViolations";
import {
  remindersBeforeLaunch,
  type ReminderSendWindow,
} from "./launchReminders";
import type { LaunchSchedule } from "./launchSchedule";
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
  `${count} ${count === 1 ? one : many}`;

/** Why the suite's own events already rule out launching, if they do. */
export function existingLaunchEvent(
  events: readonly Pick<ActionEventDto, "newStatus">[],
): string | null {
  if (events.some((event) => event.newStatus === "member_action")) {
    return "This suite already has a members taking action event.";
  }
  if (events.some((event) => event.newStatus === "office_action")) {
    return "This suite already has an office taking action event. Delete it on the suite page, then launch.";
  }
  return null;
}

/** Keyed by the missing items, so another item going missing asks again. */
export const checklistDismissKey = (entry: {
  action: { id: number };
  unready: readonly { id: string }[];
}) =>
  `checklist:${entry.action.id}:${entry.unready
    .map((item) => item.id)
    .sort()
    .join(",")}`;

export function launchBlockers(params: {
  data: Pick<
    SuiteLaunchData,
    | "loads"
    | "recipientCount"
    | "textFindings"
    | "errors"
    | "loading"
    | "spellcheckLoading"
  > & {
    actions: { action: { id: number }; unready: LaunchAction["unready"] }[];
  };
  schedule: LaunchSchedule;
  reminderWindows: ReminderSendWindow[];
  suiteEvents: readonly Pick<ActionEventDto, "newStatus">[];
  checkedActionIds: ReadonlySet<number>;
  dismissedFindingKeys: ReadonlySet<string>;
  violationsAcknowledged: boolean;
  now: Date;
}): LaunchBlocker[] {
  const {
    data,
    schedule,
    reminderWindows,
    suiteEvents,
    checkedActionIds,
    dismissedFindingKeys,
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
  if (schedule.memberActionAt <= now) {
    block(
      LaunchSection.Schedule,
      "Members taking action must start in the future.",
    );
  }
  if (schedule.officeActionAt <= schedule.memberActionAt) {
    block(
      LaunchSection.Schedule,
      "Office taking action must come after members start.",
    );
  }
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
  const unready = data.actions.filter(
    (entry) =>
      entry.unready.length > 0 &&
      !dismissedFindingKeys.has(checklistDismissKey(entry)),
  );
  if (unready.length > 0) {
    block(
      LaunchSection.Actions,
      `${plural(unready.length, "action has", "actions have")} unfinished checklist items.`,
    );
  }
  const violations = contractViolations({ loads: data.loads, schedule });
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
      .filter((key) => !dismissedFindingKeys.has(key)),
  );
  if (open.size > 0) {
    block(
      LaunchSection.Text,
      `${plural(open.size, "text finding", "text findings")} to fix or dismiss.`,
    );
  }
  return blockers;
}

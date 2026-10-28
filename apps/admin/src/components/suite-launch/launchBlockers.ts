import { contractViolations } from "./contractViolations";
import {
  remindersBeforeLaunch,
  type ReminderSendWindow,
} from "./launchReminders";
import type { LaunchSchedule } from "./launchSchedule";
import type { LaunchAction, SuiteLaunchData } from "./useSuiteLaunchData";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

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
  hasMemberActionEvent: boolean;
  checkedActionIds: ReadonlySet<number>;
  dismissedFindingKeys: ReadonlySet<string>;
  violationsAcknowledged: boolean;
  now: Date;
}): string[] {
  const {
    data,
    schedule,
    reminderWindows,
    hasMemberActionEvent,
    checkedActionIds,
    dismissedFindingKeys,
    violationsAcknowledged,
    now,
  } = params;
  if (hasMemberActionEvent) {
    return ["This suite already has a members taking action event."];
  }
  if (data.loading || data.spellcheckLoading) return ["Checks are loading."];

  const blockers: string[] = [];
  if (data.errors.length > 0) blockers.push("Some checks failed to load.");
  if (schedule.memberActionAt <= now) {
    blockers.push("Members taking action must start in the future.");
  }
  if (schedule.officeActionAt <= schedule.memberActionAt) {
    blockers.push("Office taking action must come after members start.");
  }
  const early = remindersBeforeLaunch(reminderWindows, schedule);
  if (early.length > 0) {
    blockers.push(
      `${plural(early.length, "reminder would", "reminders would")} send before members start. Move office taking action later.`,
    );
  }
  if (data.recipientCount === 0) {
    blockers.push("No member is assigned any action.");
  }
  const unready = data.actions.filter(({ unready }) => unready.length > 0);
  if (unready.length > 0) {
    blockers.push(
      `${plural(unready.length, "action has", "actions have")} unfinished checklist items.`,
    );
  }
  const violations = contractViolations({ loads: data.loads, schedule });
  if (violations.length > 0 && !violationsAcknowledged) {
    blockers.push(
      `${plural(violations.length, "contract violation", "contract violations")} to fix or accept.`,
    );
  }
  const unchecked = data.actions.filter(
    ({ action }) => !checkedActionIds.has(action.id),
  );
  if (unchecked.length > 0) {
    blockers.push(
      `${plural(unchecked.length, "action isn't", "actions aren't")} marked ready to launch.`,
    );
  }
  const open = data.textFindings.filter(
    (finding) => !dismissedFindingKeys.has(finding.key),
  );
  if (open.length > 0) {
    blockers.push(
      `${plural(open.length, "text finding", "text findings")} to fix or dismiss.`,
    );
  }
  return blockers;
}

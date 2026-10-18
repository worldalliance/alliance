import {
  ReminderCohortType,
  type ReminderGroup,
} from "src/actions/entities/reminder-group.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { isMissedSuiteReminderGroup } from "./missed-suite-notice";

const COHORT_KIND: Record<ReminderCohortType, NotificationKind> = {
  [ReminderCohortType.AllUncompleted]: NotificationKind.ActionReminders,
  [ReminderCohortType.Tag]: NotificationKind.ActionReminders,
  [ReminderCohortType.Custom]: NotificationKind.ActionReminders,
  [ReminderCohortType.GroupLeadsWithUncompleted]:
    NotificationKind.GroupMembersWithUncompletedTasks,
};

export function reminderGroupKind(
  group: Pick<ReminderGroup, "cohortType" | "emailSubject" | "emailMessage">,
): NotificationKind {
  return isMissedSuiteReminderGroup(group)
    ? NotificationKind.MissedDeadline
    : COHORT_KIND[group.cohortType];
}

import { ReminderCohortType } from "src/actions/entities/reminder-group.entity";
import { NotificationKind } from "src/notification-settings/notification-kind";
import { reminderGroupKind } from "./reminder-group-kind";

describe("reminderGroupKind", () => {
  const group = {
    cohortType: ReminderCohortType.AllUncompleted,
    emailSubject: "",
    emailMessage: "",
  };

  it("classifies group-lead nudges apart from other cohorts", () => {
    expect(reminderGroupKind(group)).toBe(NotificationKind.ActionReminders);
    expect(
      reminderGroupKind({
        ...group,
        cohortType: ReminderCohortType.GroupLeadsWithUncompleted,
      }),
    ).toBe(NotificationKind.GroupMembersWithUncompletedTasks);
  });

  it("classifies a missed-suite group as a missed deadline", () => {
    expect(
      reminderGroupKind({
        ...group,
        emailMessage: "You missed #{missedactioncontext}",
      }),
    ).toBe(NotificationKind.MissedDeadline);
  });
});

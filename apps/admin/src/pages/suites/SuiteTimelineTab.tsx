import type { ActionSuiteDto } from "@alliance/shared/client";
import ActionTimeline from "../../components/ActionTimeline";

/** The suite's tasks on a timeline, with its reminders over them. */
export function SuiteTimelineTab({
  suite,
  onReminderClick,
}: {
  suite: ActionSuiteDto;
  /** Opens the Reminders tab on the reminder. */
  onReminderClick: (reminderId: number) => void;
}) {
  return (
    <ActionTimeline
      actions={suite.actions}
      reminders={suite.reminderGroups}
      onReminderClick={onReminderClick}
    />
  );
}

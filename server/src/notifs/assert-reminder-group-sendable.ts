import { BadRequestException } from "@nestjs/common";
import {
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";

/** Rejects a group, deadline attached, whose timing could never compute a send time. */
export function assertReminderGroupSendable(
  group: Pick<
    ReminderGroup,
    | "timingMode"
    | "deadlineEvent"
    | "timingAnchorEvent"
    | "send_range_start"
    | "send_range_end"
  >,
): void {
  switch (group.timingMode) {
    case ReminderGroupTimingMode.FromDeadline:
    case ReminderGroupTimingMode.WithinRelativeRange:
      if (!group.deadlineEvent && !group.timingAnchorEvent) {
        throw new BadRequestException(
          "Deadline or anchor event is required for relative timing modes",
        );
      }
      return;
    case ReminderGroupTimingMode.WithinRange:
      if (
        group.send_range_start &&
        group.send_range_end &&
        group.send_range_start.getTime() > group.send_range_end.getTime()
      ) {
        throw new BadRequestException(
          "Send range start must be before the end",
        );
      }
      return;
    case ReminderGroupTimingMode.Absolute:
    case ReminderGroupTimingMode.EventLaunch:
      return;
    default:
      throw new Error(
        `unknown timing mode: ${group.timingMode satisfies never}`,
      );
  }
}

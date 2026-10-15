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
    | "sendAtAbsolute"
    | "sendAtSecondsFromDeadline"
    | "send_range_start"
    | "send_range_end"
    | "relative_range_start_seconds_from_deadline"
    | "relative_range_end_seconds_from_deadline"
  >,
): void {
  const requireDeadlineOrAnchor = () => {
    if (!group.deadlineEvent && !group.timingAnchorEvent) {
      throw new BadRequestException(
        "Deadline or anchor event is required for relative timing modes",
      );
    }
  };
  if (
    group.send_range_start &&
    group.send_range_end &&
    group.send_range_start.getTime() > group.send_range_end.getTime()
  ) {
    throw new BadRequestException("Send range start must be before the end");
  }
  if (
    group.relative_range_start_seconds_from_deadline != null &&
    group.relative_range_end_seconds_from_deadline != null &&
    group.relative_range_start_seconds_from_deadline <
      group.relative_range_end_seconds_from_deadline
  ) {
    throw new BadRequestException(
      "Relative range start must be before the end",
    );
  }
  switch (group.timingMode) {
    case ReminderGroupTimingMode.Absolute:
      if (group.sendAtAbsolute == null) {
        throw new BadRequestException("Absolute timing requires a send time");
      }
      return;
    case ReminderGroupTimingMode.FromDeadline:
      if (group.sendAtSecondsFromDeadline == null) {
        throw new BadRequestException(
          "From-deadline timing requires an offset from the deadline",
        );
      }
      requireDeadlineOrAnchor();
      return;
    case ReminderGroupTimingMode.WithinRange:
      if (group.send_range_start == null || group.send_range_end == null) {
        throw new BadRequestException(
          "Send range timing requires a start and an end",
        );
      }
      return;
    case ReminderGroupTimingMode.WithinRelativeRange:
      if (
        group.relative_range_start_seconds_from_deadline == null ||
        group.relative_range_end_seconds_from_deadline == null
      ) {
        throw new BadRequestException(
          "Relative range timing requires a start and an end",
        );
      }
      requireDeadlineOrAnchor();
      return;
    case ReminderGroupTimingMode.EventLaunch:
      return;
    default:
      throw new Error(
        `unknown timing mode: ${group.timingMode satisfies never}`,
      );
  }
}

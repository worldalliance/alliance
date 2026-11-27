import { R, type Result } from "@alliance/common/result";
import type {
  CreateReminderGroupDto,
  ReminderCohortType,
  ReminderGroupDto,
  ReminderGroupTimingMode,
} from "@alliance/shared/client";
import { secondsInHour } from "date-fns/constants";
import type { ReminderGroupDraft } from "./reminderGroupDraft";

type ReminderGroupContentFields = Pick<
  ReminderGroupDto,
  | "name"
  | "cohortType"
  | "timingMode"
  | "emailSubject"
  | "emailMessage"
  | "textMessage"
  | "pushMessage"
  | "useSuiteTaskCount"
  | "excludeOptionalActions"
  | "excludePreviouslyNotified"
>;

type ReminderGroupScheduleFields = Pick<
  CreateReminderGroupDto,
  | "sendAtAbsolute"
  | "sendAtSecondsFromDeadline"
  | "send_range_start"
  | "send_range_end"
  | "relative_range_start_seconds_from_deadline"
  | "relative_range_end_seconds_from_deadline"
>;

type ReminderGroupUserFields = Pick<
  CreateReminderGroupDto,
  "userIds" | "userTagId" | "timingAnchorEventId"
>;

type ReminderGroupRequestFields = ReminderGroupContentFields &
  ReminderGroupScheduleFields &
  ReminderGroupUserFields;

export type ActionReminderGroupFormSubmitPayload =
  ReminderGroupRequestFields & {
    memberActionEventId: number;
  };

const anchorAppliesByMode: Record<ReminderGroupTimingMode, boolean> = {
  absolute: false,
  from_deadline: true,
  within_range: false,
  within_relative_range: true,
  event_launch: false,
};

export const anchorApplies = (timingMode: ReminderGroupTimingMode) =>
  anchorAppliesByMode[timingMode];

// Group-leads nudges are about *other* users' tasks, so "already notified
// for this event" doesn't apply to them (the server rejects the combination).
const excludePreviouslyNotifiedAppliesByCohort: Record<
  ReminderCohortType,
  boolean
> = {
  all_uncompleted: true,
  tag: true,
  custom: true,
  group_leads_with_uncompleted: false,
};

export const excludePreviouslyNotifiedApplies = (
  cohortType: ReminderCohortType,
) => excludePreviouslyNotifiedAppliesByCohort[cohortType];

export function reminderGroupRequestFields(
  draft: ReminderGroupDraft,
): ReminderGroupRequestFields {
  const { cohortType, timingMode } = draft;
  return {
    name: draft.name,
    cohortType,
    emailSubject: draft.emailSubject,
    emailMessage: draft.emailMessage,
    textMessage: draft.textMessage,
    pushMessage: draft.pushMessage,
    timingMode,
    userIds: cohortType === "custom" ? draft.userIds : undefined,
    userTagId:
      cohortType === "tag" ? (draft.userTagId ?? undefined) : undefined,
    sendAtAbsolute:
      timingMode === "absolute" ? draft.sendAtAbsolute : undefined,
    sendAtSecondsFromDeadline:
      timingMode === "from_deadline"
        ? draft.sendAtHoursFromDeadline * secondsInHour
        : undefined,
    send_range_start:
      timingMode === "within_range" ? draft.sendRangeStart : undefined,
    send_range_end:
      timingMode === "within_range" ? draft.sendRangeEnd : undefined,
    relative_range_start_seconds_from_deadline:
      timingMode === "within_relative_range"
        ? draft.relativeRangeStartHours * secondsInHour
        : undefined,
    relative_range_end_seconds_from_deadline:
      timingMode === "within_relative_range"
        ? draft.relativeRangeEndHours * secondsInHour
        : undefined,
    useSuiteTaskCount: draft.useSuiteTaskCount,
    excludeOptionalActions: draft.excludeOptionalActions,
    excludePreviouslyNotified:
      excludePreviouslyNotifiedApplies(cohortType) &&
      draft.excludePreviouslyNotified,
    timingAnchorEventId: anchorApplies(timingMode)
      ? (draft.timingAnchorEventId ?? undefined)
      : undefined,
  };
}

export const relativeRangeIsValid = ({
  relativeRangeStartHours: start,
  relativeRangeEndHours: end,
}: Pick<
  ReminderGroupDraft,
  "relativeRangeStartHours" | "relativeRangeEndHours"
>) => !Number.isNaN(start) && !Number.isNaN(end) && start >= end;

function validSchedule(
  draft: ReminderGroupDraft,
): Result<ReminderGroupDraft, string> {
  switch (draft.timingMode) {
    case "absolute": {
      if (!draft.sendAtAbsolute) return R.failure("Select a send time.");
      const sendAt = new Date(draft.sendAtAbsolute);
      if (Number.isNaN(sendAt.getTime())) {
        return R.failure("Invalid send time.");
      }
      return R.success({ ...draft, sendAtAbsolute: sendAt.toISOString() });
    }
    case "from_deadline":
      if (Number.isNaN(draft.sendAtHoursFromDeadline)) {
        return R.failure("Enter the number of hours relative to the deadline.");
      }
      return R.success(draft);
    case "within_range": {
      if (!draft.sendRangeStart || !draft.sendRangeEnd) {
        return R.failure("Select both the start and end of the send range.");
      }
      const start = new Date(draft.sendRangeStart);
      const end = new Date(draft.sendRangeEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return R.failure("Invalid range selection.");
      }
      if (start.getTime() > end.getTime()) {
        return R.failure("Send range start must be before the end.");
      }
      return R.success({
        ...draft,
        sendRangeStart: start.toISOString(),
        sendRangeEnd: end.toISOString(),
      });
    }
    case "within_relative_range":
      if (
        Number.isNaN(draft.relativeRangeStartHours) ||
        Number.isNaN(draft.relativeRangeEndHours)
      ) {
        return R.failure(
          "Enter both the start and end hours before the deadline.",
        );
      }
      if (!relativeRangeIsValid(draft)) {
        return R.failure(
          "Window start must be greater than or equal to the window end.",
        );
      }
      return R.success(draft);
    case "event_launch":
      return R.success(draft);
    default:
      throw new Error(
        `unknown timing mode: ${draft.timingMode satisfies never}`,
      );
  }
}

export function reminderGroupSubmitPayload({
  draft,
  memberActionEventId,
}: {
  draft: ReminderGroupDraft;
  memberActionEventId: number | null;
}): Result<ActionReminderGroupFormSubmitPayload, string> {
  if (!memberActionEventId) {
    return R.failure("Select a member action event first.");
  }
  if (draft.cohortType === "custom" && draft.userIds.length === 0) {
    return R.failure("Select at least one user.");
  }
  if (draft.cohortType === "tag" && !draft.userTagId) {
    return R.failure("Select a user group.");
  }
  return R.map(validSchedule(draft), (valid) => ({
    ...reminderGroupRequestFields(valid),
    memberActionEventId,
  }));
}

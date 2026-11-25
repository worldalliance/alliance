import {
  defaultEmailContents,
  defaultEmailSubject,
  defaultPushMessage,
  defaultTextMessage,
} from "@alliance/common/reminderPresetCopy";
import type {
  CreateReminderGroupDto,
  ReminderCohortType,
  ReminderGroupTimingMode,
  Tag,
  User,
} from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { secondsInHour } from "date-fns/constants";

export type ActionReminderGroupFormInitialValues = {
  memberActionEventId: number;
  reminderGroup:
    | (CreateReminderGroupDto & {
        userTag?: Pick<Tag, "id">;
        timingAnchorEvent?: { id: number };
      })
    | null;
  users: Pick<User, "id">[];
};

export type ReminderGroupDraft = {
  name: string;
  cohortType: ReminderCohortType;
  timingMode: ReminderGroupTimingMode;
  sendAtAbsolute: string;
  sendAtHoursFromDeadline: number;
  sendRangeStart: string;
  sendRangeEnd: string;
  relativeRangeStartHours: number;
  relativeRangeEndHours: number;
  timingAnchorEventId: number | null;
  emailSubject: string;
  emailMessage: string;
  textMessage: string;
  pushMessage: string;
  userIds: number[];
  userTagId: string | null;
  useSuiteTaskCount: boolean;
  excludeOptionalActions: boolean;
  excludePreviouslyNotified: boolean;
};

const hoursFromSeconds = (seconds: number | null | undefined) =>
  seconds != null ? seconds / secondsInHour : 0;

export function draftFromInitialValues({
  reminderGroup: group,
  users,
}: ActionReminderGroupFormInitialValues): ReminderGroupDraft {
  return {
    name: group?.name ?? "",
    cohortType: group?.cohortType ?? "all_uncompleted",
    timingMode: group?.timingMode ?? "within_range",
    sendAtAbsolute: group?.sendAtAbsolute ?? new Date().toISOString(),
    sendAtHoursFromDeadline: hoursFromSeconds(group?.sendAtSecondsFromDeadline),
    sendRangeStart: group?.send_range_start ?? new Date().toISOString(),
    sendRangeEnd:
      group?.send_range_end ??
      new Date(Date.now() + milliseconds({ hours: 1 })).toISOString(),
    relativeRangeStartHours: hoursFromSeconds(
      group?.relative_range_start_seconds_from_deadline,
    ),
    relativeRangeEndHours: hoursFromSeconds(
      group?.relative_range_end_seconds_from_deadline,
    ),
    timingAnchorEventId:
      group?.timingAnchorEvent?.id ?? group?.timingAnchorEventId ?? null,
    emailSubject: group?.emailSubject ?? defaultEmailSubject,
    emailMessage: group?.emailMessage ?? defaultEmailContents,
    textMessage: group?.textMessage ?? defaultTextMessage,
    pushMessage: group?.pushMessage ?? defaultPushMessage,
    userIds: users.map((user) => user.id),
    userTagId: group?.userTag?.id ?? null,
    useSuiteTaskCount: group?.useSuiteTaskCount ?? true,
    excludeOptionalActions: group?.excludeOptionalActions ?? false,
    excludePreviouslyNotified: group?.excludePreviouslyNotified ?? false,
  };
}

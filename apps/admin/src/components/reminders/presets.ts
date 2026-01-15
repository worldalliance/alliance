import { CreateReminderGroupDto } from "@alliance/shared/client";
import {
  defaultAnnouncementEmailContents,
  defaultAnnouncementEmailSubject,
  defaultAnnouncementPushMessage,
  defaultAnnouncementTextMessage,
  defaultEmailContents,
  defaultEmailSubject,
  defaultMissedDeadlineEmailContents,
  defaultMissedDeadlineEmailSubject,
  defaultMissedDeadlineTextMessage,
  defaultPushMessage,
  defaultTextMessage,
} from "./defaultReminderContents";

export type ReminderPresetName =
  | "Announcement"
  | "Two Day Range"
  | "One Day Range"
  | "Three Hour"
  | "Missed Deadline";

export const presetNames: ReminderPresetName[] = [
  "Announcement",
  "Two Day Range",
  "One Day Range",
  "Three Hour",
  "Missed Deadline",
];

export const reminderPresets: Record<
  ReminderPresetName,
  Omit<CreateReminderGroupDto, "suiteId">
> = {
  Announcement: {
    timingMode: "event_launch",
    cohortType: "all_uncompleted",
    textMessage: defaultAnnouncementTextMessage,
    name: "Member Action announcement",
    emailMessage: defaultAnnouncementEmailContents,
    emailSubject: defaultAnnouncementEmailSubject,
    pushMessage: defaultAnnouncementPushMessage,
    useSuiteTaskCount: true,
  },
  "Two Day Range": {
    timingMode: "within_relative_range",
    relative_range_start_seconds_from_deadline: 48 * 60 * 60,
    relative_range_end_seconds_from_deadline: 24 * 60 * 60,
    cohortType: "all_uncompleted",
    textMessage: defaultTextMessage,
    emailSubject: defaultEmailSubject,
    emailMessage: defaultEmailContents,
    name: "24-48h reminder",
    pushMessage: defaultPushMessage,
    useSuiteTaskCount: true,
  },
  "One Day Range": {
    timingMode: "within_relative_range",
    relative_range_start_seconds_from_deadline: 24 * 60 * 60,
    relative_range_end_seconds_from_deadline: 6 * 60 * 60,
    cohortType: "all_uncompleted",
    textMessage: defaultTextMessage,
    emailSubject: defaultEmailSubject,
    emailMessage: defaultEmailContents,
    name: "6-24h reminder",
    pushMessage: defaultPushMessage,
    useSuiteTaskCount: true,
  },
  "Three Hour": {
    timingMode: "from_deadline",
    sendAtSecondsFromDeadline: 3 * 60 * 60,
    cohortType: "all_uncompleted",
    textMessage: defaultTextMessage,
    emailSubject: defaultEmailSubject,
    emailMessage: defaultEmailContents,
    name: "3 hour reminder",
    pushMessage: defaultPushMessage,
    useSuiteTaskCount: true,
  },
  "Missed Deadline": {
    timingMode: "from_deadline",
    sendAtSecondsFromDeadline: 0,
    cohortType: "all_uncompleted",
    textMessage: defaultMissedDeadlineTextMessage,
    emailMessage: defaultMissedDeadlineEmailContents,
    emailSubject: defaultMissedDeadlineEmailSubject,
    name: "Missed deadline message",
    pushMessage: defaultMissedDeadlineTextMessage,
    useSuiteTaskCount: true,
  },
};

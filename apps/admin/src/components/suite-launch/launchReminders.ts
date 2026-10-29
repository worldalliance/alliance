import {
  FIRST_MISS_REPORT_TEMPLATES,
  isMissedSuiteReminderGroup,
  SECOND_MISS_REPORT_TEMPLATES,
} from "@alliance/common/missedSuiteNotice";
import { renderReminderKeywords } from "@alliance/common/reminderKeywords";
import { DEFAULT_TIME_ZONE } from "@alliance/common/timezone";
import type { CreateReminderGroupDto } from "@alliance/shared/client";
import { TZDate } from "@date-fns/tz";
import { subSeconds } from "date-fns";
import type { LaunchSchedule } from "./launchSchedule";

export type ReminderSendWindow = { name: string; start: Date; end: Date };

const fromDeadline = (
  schedule: LaunchSchedule,
  seconds: number | null | undefined,
) => {
  if (seconds == null) {
    throw new Error("a launch reminder needs its offsets from the deadline");
  }
  return subSeconds(schedule.officeActionAt, seconds);
};

/** When each reminder sends, with the office action event as the deadline. */
export function reminderSendWindows(params: {
  bodies: CreateReminderGroupDto[];
  schedule: LaunchSchedule;
}): ReminderSendWindow[] {
  const { bodies, schedule } = params;
  return bodies.map((body) => {
    const { name } = body;
    switch (body.timingMode) {
      case "event_launch":
        return {
          name,
          start: schedule.memberActionAt,
          end: schedule.memberActionAt,
        };
      case "from_deadline": {
        const at = fromDeadline(schedule, body.sendAtSecondsFromDeadline);
        return { name, start: at, end: at };
      }
      case "within_relative_range":
        return {
          name,
          start: fromDeadline(
            schedule,
            body.relative_range_start_seconds_from_deadline,
          ),
          end: fromDeadline(
            schedule,
            body.relative_range_end_seconds_from_deadline,
          ),
        };
      case "absolute":
      case "within_range":
        throw new Error(
          `a launch reminder can't use fixed dates: ${body.timingMode}`,
        );
      default:
        throw new Error(
          `unknown timing mode: ${body.timingMode satisfies never}`,
        );
    }
  });
}

export const remindersBeforeLaunch = (
  windows: ReminderSendWindow[],
  schedule: LaunchSchedule,
) => windows.filter((window) => window.start < schedule.memberActionAt);

const NIGHT_STARTS_AT_HOUR = 22;
const NIGHT_ENDS_AT_HOUR = 8;

/**
 * How many of the given members a reminder reaches between 10pm and 8am in
 * their own zone. A range reminder sends at each member's preferred time, so
 * only one sent at a single instant for everyone can land at night.
 */
export function nightRecipientCount(params: {
  window: ReminderSendWindow;
  timeZones: readonly (string | null)[];
}): number {
  const { window, timeZones } = params;
  if (window.start.getTime() !== window.end.getTime()) return 0;
  return timeZones.filter((timeZone) => {
    const hour = new TZDate(
      window.start,
      timeZone ?? DEFAULT_TIME_ZONE,
    ).getHours();
    return hour >= NIGHT_STARTS_AT_HOUR || hour < NIGHT_ENDS_AT_HOUR;
  }).length;
}

type RenderedReminder = {
  emailSubject: string | null;
  emailMessage: string | null;
  textMessage: string | null;
  pushMessage: string | null;
};

/** Sample group size a group leads reminder is rendered with. */
export const SAMPLE_GROUP_UNFINISHED = 3;

export type ReminderVariant = {
  label: string | null;
  body: CreateReminderGroupDto;
  isFirstAssignedSuite: boolean;
};

/**
 * A missed-deadline group sends its own copy only on a first miss in the
 * MissedSuiteFirstNotice experiment's control arm, where
 * #{missedactioncontext} reads differently on a member's first assigned
 * suite; the variant arm and a second miss send fixed copy.
 */
export const reminderVariants = (
  body: CreateReminderGroupDto,
): ReminderVariant[] =>
  isMissedSuiteReminderGroup(body)
    ? [
        {
          label: "First miss (control arm), on a member's first assigned suite",
          body,
          isFirstAssignedSuite: true,
        },
        {
          label:
            "First miss (control arm), for a member assigned suites before",
          body,
          isFirstAssignedSuite: false,
        },
        {
          label: "First miss (variant arm)",
          body: { ...body, ...FIRST_MISS_REPORT_TEMPLATES },
          isFirstAssignedSuite: false,
        },
        {
          label: "Second miss in a row",
          body: { ...body, ...SECOND_MISS_REPORT_TEMPLATES },
          isFirstAssignedSuite: false,
        },
      ]
    : [{ label: null, body, isFirstAssignedSuite: false }];

/**
 * A reminder as the given member receives it at its send time, before they
 * finish anything, as the server renders it.
 */
export function renderLaunchReminder(params: {
  body: CreateReminderGroupDto;
  window: ReminderSendWindow;
  schedule: LaunchSchedule;
  member: { id: number; name: string };
  memberActions: {
    name: string;
    timeEstimate: number | null;
    optional: boolean;
  }[];
  suiteActionName: string;
  siteUrl: string;
  isFirstAssignedSuite: boolean;
}): RenderedReminder {
  const {
    body,
    window,
    schedule,
    member,
    memberActions,
    suiteActionName,
    siteUrl,
    isFirstAssignedSuite,
  } = params;
  const tasks = body.excludeOptionalActions
    ? memberActions.filter((action) => !action.optional)
    : memberActions;
  const render = (text: string | null | undefined) =>
    text
      ? renderReminderKeywords(text, {
          user: member,
          action: { name: suiteActionName },
          deadlineEvent: { date: schedule.officeActionAt },
          uncompletedTasksCount: tasks.length,
          uncompletedTasksTime: `${tasks.reduce((total, task) => total + (task.timeEstimate ?? 0), 0)} minutes`,
          uncompletedTasksNames: tasks.map((task) => task.name),
          dateNow: window.start,
          uncompletedMembersInGroupCount:
            body.cohortType === "group_leads_with_uncompleted"
              ? SAMPLE_GROUP_UNFINISHED
              : undefined,
          siteUrl,
          isFirstAssignedSuite,
        })
      : null;
  return {
    emailSubject: render(body.emailSubject),
    emailMessage: render(body.emailMessage),
    textMessage: render(body.textMessage),
    pushMessage: render(body.pushMessage),
  };
}

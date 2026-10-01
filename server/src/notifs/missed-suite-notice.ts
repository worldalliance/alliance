import { R, type Result } from "@alliance/common/result";
import type { ActionSuite } from "src/actions/entities/action-suite.entity";
import type { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import type { SuiteOutcome } from "src/actions/missed-suite-streak";
import { MissedSuiteNoticeCopy } from "./entities/action-event-notif.entity";

export type ChannelTemplates = Pick<
  ReminderGroup,
  "pushMessage" | "textMessage" | "emailSubject" | "emailMessage"
>;

/** Reminder groups that announce a missed suite, recognized by their keywords. */
export function isMissedSuiteReminderGroup(
  group: Pick<ReminderGroup, "emailSubject" | "emailMessage">,
): boolean {
  return [group.emailSubject, group.emailMessage].some(
    (message) =>
      message.includes("#{missedactioncontext}") ||
      message.includes("#{secondmisswarning}"),
  );
}

/** The suite a missed-suite group's notices cover, once it has closed. */
export function closedNoticeSuite(
  group: Pick<ReminderGroup, "actionSuite">,
  closedSuites: Pick<SuiteOutcome, "suiteId">[],
): Result<ActionSuite, string> {
  const suite = group.actionSuite;
  if (!suite) return R.failure("has no suite");
  if (!closedSuites.some((closed) => closed.suiteId === suite.id)) {
    return R.failure(
      `suite ${suite.id} has not closed: a required action has a later deadline than this group, or none`,
    );
  }
  return R.success(suite);
}

export const missedSuiteNoticeKey = (suiteId: number, userId: number) =>
  `missed-suite:${suiteId}:${userId}`;

export function missedSuiteNoticeTemplates(
  copy: MissedSuiteNoticeCopy,
  group: ChannelTemplates,
): ChannelTemplates {
  switch (copy) {
    case MissedSuiteNoticeCopy.FirstMissControl:
      return {
        pushMessage: group.pushMessage,
        textMessage: group.textMessage,
        emailSubject: group.emailSubject,
        emailMessage: group.emailMessage,
      };
    case MissedSuiteNoticeCopy.SecondMissReportV1:
      return {
        pushMessage:
          "You have missed two consecutive weeks. One more pauses your agreement automatically.",
        textMessage:
          "You have missed two consecutive weeks of tasks. If any non-optional tasks are missed again next week, your agreement will be paused automatically. #{link}",
        emailSubject: "You have missed two consecutive weeks of tasks.",
        emailMessage: [
          "Hi #{firstname},",
          "You have missed two consecutive weeks of tasks. If any non-optional tasks are missed again next week, your agreement will be paused automatically.",
          "Completing this week's task resets the count.",
          "If something has changed on your end or isn’t functioning in the platform, contact us.",
          "#{link}",
        ].join("\n"),
      };
    default:
      throw new Error(`unknown missed-suite copy: ${copy satisfies never}`);
  }
}

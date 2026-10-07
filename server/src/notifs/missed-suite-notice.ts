import { usesMissedSuiteKeyword } from "@alliance/common/missed-suite-keywords";
import type { ActionSuite } from "src/actions/entities/action-suite.entity";
import type { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import {
  findMissedSuiteStanding,
  SUSPENSION_MISSED_SUITE_COUNT,
  type MissedSuiteStanding,
  type SuiteOutcome,
} from "src/actions/missed-suite-streak";
import { MissedSuiteNoticeCopy } from "./entities/action-event-notif.entity";
import { ExperimentArm } from "./entities/experiment-assignment.entity";

export type ChannelTemplates = Pick<
  ReminderGroup,
  "pushMessage" | "textMessage" | "emailSubject" | "emailMessage"
>;

/** Reminder groups that announce a missed suite, recognized by their keywords. */
export function isMissedSuiteReminderGroup(
  group: Pick<ReminderGroup, "emailSubject" | "emailMessage">,
): boolean {
  return usesMissedSuiteKeyword(group);
}

export enum MissedSuitePlanKind {
  Ordinary = "ordinary",
  NoSuite = "no_suite",
  SuiteOpen = "suite_open",
  Due = "due",
}

export type MissedSuitePlanResolution =
  | { kind: MissedSuitePlanKind.Ordinary }
  | { kind: MissedSuitePlanKind.NoSuite }
  | { kind: MissedSuitePlanKind.SuiteOpen; suite: ActionSuite }
  | {
      kind: MissedSuitePlanKind.Due;
      suite: ActionSuite;
      standing: MissedSuiteStanding | null;
    };

/** How dispatch treats one member's plan for a reminder group. */
export function resolveMissedSuitePlan(params: {
  group: Pick<ReminderGroup, "actionSuite" | "emailSubject" | "emailMessage">;
  userId: number;
  closedSuites: SuiteOutcome[];
}): MissedSuitePlanResolution {
  const { group, userId, closedSuites } = params;
  if (!isMissedSuiteReminderGroup(group)) {
    return { kind: MissedSuitePlanKind.Ordinary };
  }
  const suite = group.actionSuite;
  if (!suite) return { kind: MissedSuitePlanKind.NoSuite };
  if (!closedSuites.some((closed) => closed.suiteId === suite.id)) {
    return { kind: MissedSuitePlanKind.SuiteOpen, suite };
  }
  return {
    kind: MissedSuitePlanKind.Due,
    suite,
    standing: findMissedSuiteStanding({
      suites: closedSuites,
      userId,
      suiteId: suite.id,
    }),
  };
}

/** A third consecutive miss gets the suspension notice instead. */
export const getsMissedSuiteNotice = (
  standing: MissedSuiteStanding | null,
): standing is MissedSuiteStanding =>
  standing !== null && standing.missNumber < SUSPENSION_MISSED_SUITE_COUNT;

export const missedSuiteNoticeKey = (suiteId: number, userId: number) =>
  `missed-suite:${suiteId}:${userId}`;

export const FIRST_MISS_COPY: Record<ExperimentArm, MissedSuiteNoticeCopy> = {
  [ExperimentArm.Control]: MissedSuiteNoticeCopy.FirstMissControl,
  [ExperimentArm.Variant]: MissedSuiteNoticeCopy.FirstMissReportV1,
};

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
    case MissedSuiteNoticeCopy.FirstMissReportV1:
      return {
        pushMessage:
          "The deadline for #{tasknames} passed without your completion.",
        textMessage:
          "The deadline for #{tasknames} passed without your completion. If you did complete #{it|them}, contact us. #{link}",
        emailSubject:
          "The deadline for #{tasknames} passed without your completion.",
        emailMessage: [
          "Hi #{firstname},",
          "The deadline for #{tasknames} passed and we have no completion recorded for you. If you did complete #{it|them}, contact us; we may have made a mistake.",
          "Each action is planned around the number of members expected to participate.",
          "#{link}",
        ].join("\n"),
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
          "Completing this week's tasks resets the count.",
          "If something has changed on your end or isn’t functioning in the platform, contact us.",
          "#{link}",
        ].join("\n"),
      };
    default:
      throw new Error(`unknown missed-suite copy: ${copy satisfies never}`);
  }
}

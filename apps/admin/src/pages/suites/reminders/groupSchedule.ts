import { withCount } from "@alliance/common/plural";
import type { ActionEvent, ReminderGroupDto } from "@alliance/shared/client";
import { formatDistanceStrict, isValid, parseISO, subSeconds } from "date-fns";
import {
  millisecondsInMinute,
  millisecondsInSecond,
  minutesInDay,
  minutesInHour,
} from "date-fns/constants";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";

export type GroupScheduleLabels = {
  primary: string;
  secondary?: string | null;
  pastTense: string;
};

type ReferenceEvent = Pick<ActionEvent, "date" | "title">;

const when = (date: Date) =>
  formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

const parseDate = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? parseISO(value) : value;
  return isValid(date) ? date : null;
};

const formatDisplayDate = (value?: string | Date | null) => {
  const date = parseDate(value);
  return date ? when(date) : null;
};

const describeOffset = (seconds: number) => {
  if (seconds === 0) {
    return "at the deadline";
  }
  const distance = formatDistanceStrict(
    new Date(0),
    new Date(Math.abs(seconds) * millisecondsInSecond),
    { roundingMethod: "floor" },
  );
  return `${distance} ${seconds >= 0 ? "before" : "after"}`;
};

/**
 * `referenceEvent` is the event a deadline-relative group's send time counts
 * from; `anchorLabel` names it when it is a dependency action's deadline.
 */
export const describeGroupSchedule = ({
  group,
  referenceEvent,
  anchorLabel,
}: {
  group: ReminderGroupDto;
  referenceEvent: ReferenceEvent | null;
  anchorLabel: string | null;
}): GroupScheduleLabels => {
  switch (group.timingMode) {
    case "absolute": {
      const sendAtLabel = formatDisplayDate(group.sendAtAbsolute);
      return {
        primary: sendAtLabel
          ? `Sends ${sendAtLabel}`
          : "Absolute schedule configured",
        secondary: sendAtLabel ? "Absolute schedule" : null,
        pastTense: `at ${sendAtLabel}`,
      };
    }
    case "from_deadline": {
      const deadlineDate = parseDate(referenceEvent?.date);
      const seconds = group.sendAtSecondsFromDeadline ?? 0;
      if (deadlineDate) {
        const sendDate = subSeconds(deadlineDate, seconds);
        const referenceTitle =
          anchorLabel ??
          (referenceEvent?.title?.trim() ||
            `deadline on ${when(deadlineDate)}`);
        if (seconds === 0) {
          return {
            primary: anchorLabel
              ? `Sends at ${referenceTitle}`
              : `Sends when ${referenceTitle} begins`,
            secondary: `${when(sendDate)} • Deadline ${when(deadlineDate)}`,
            pastTense: `at ${when(sendDate)}`,
          };
        }
        const distance = formatDistanceStrict(deadlineDate, sendDate, {
          roundingMethod: "floor",
        });
        return {
          primary: `Sends ${distance} ${
            seconds >= 0 ? "before" : "after"
          } ${referenceTitle}`,
          secondary: `${when(sendDate)} • Deadline ${when(deadlineDate)}`,
          pastTense: `${distance} ${
            seconds >= 0 ? "before" : "after"
          } ${referenceTitle}`,
        };
      }
      return {
        primary: "Relative schedule",
        secondary: "Error: no deadline event found to schedule from",
        pastTense: "Relative schedule",
      };
    }
    case "within_range": {
      const start = parseDate(group.send_range_start);
      const end = parseDate(group.send_range_end);
      if (start && end) {
        return {
          primary: `Sends between ${when(start)} and ${when(end)}`,
          secondary: "Personalized window",
          pastTense: `between ${when(start)} and ${when(end)}`,
        };
      }
      return {
        primary: "Personalized window",
        secondary: "Range not fully configured",
        pastTense: "Relative schedule",
      };
    }
    case "within_relative_range": {
      const startSeconds =
        group.relative_range_start_seconds_from_deadline ?? null;
      const endSeconds = group.relative_range_end_seconds_from_deadline ?? null;
      const deadlineDate = parseDate(referenceEvent?.date);
      if (startSeconds === null || endSeconds === null || !deadlineDate) {
        return {
          primary: "Relative personalized window",
          secondary: "Error: no deadline event found to schedule from",
          pastTense: "Relative personalized window",
        };
      }

      const startLabel = describeOffset(startSeconds);
      const endLabel = describeOffset(endSeconds);
      const referenceTitle =
        anchorLabel ??
        (referenceEvent?.title?.trim() || `deadline on ${when(deadlineDate)}`);
      const startDate = subSeconds(deadlineDate, startSeconds);
      const endDate = subSeconds(deadlineDate, endSeconds);
      const deadlineLabel = when(deadlineDate);

      return {
        primary:
          startSeconds === endSeconds
            ? `Sends ${startLabel} ${referenceTitle}`
            : `Sends between ${startLabel} and ${endLabel} ${referenceTitle}`,
        secondary: `${when(startDate)} – ${when(endDate)} • Deadline ${deadlineLabel}`,
        pastTense:
          startSeconds === endSeconds
            ? `${startLabel} ${referenceTitle}`
            : `between ${startLabel} and ${endLabel} ${referenceTitle}`,
      };
    }
    case "event_launch": {
      const launchDate = parseDate(group.memberActionEvent?.date);
      return {
        primary: launchDate
          ? `Sends when launch event begins (${when(launchDate)})`
          : "Sends when launch event begins",
        secondary: null,
        pastTense: launchDate
          ? `when launch event began (${when(launchDate)})`
          : "when launch event began",
      };
    }
    default:
      group.timingMode satisfies never;
      return {
        primary: "Scheduled group reminder",
        secondary: null,
        pastTense: "Scheduled group reminder",
      };
  }
};

export const relativeSendLabel = (sendStart: Date, now: Date) => {
  const totalMinutes = Math.floor(
    Math.abs(sendStart.getTime() - now.getTime()) / millisecondsInMinute,
  );
  if (totalMinutes === 0) return "now";
  const days = Math.floor(totalMinutes / minutesInDay);
  const hours = Math.floor((totalMinutes % minutesInDay) / minutesInHour);
  const minutes = totalMinutes % minutesInHour;
  const parts = (
    days > 0
      ? [withCount(days, "day"), hours > 0 && withCount(hours, "hour")]
      : [
          hours > 0 && withCount(hours, "hour"),
          minutes > 0 && withCount(minutes, "minute"),
        ]
  ).filter(Boolean);
  const span = parts.join(" ");
  return sendStart > now ? `in ${span}` : `${span} ago`;
};

export const groupSendStart = (
  group: ReminderGroupDto,
  referenceEvent: ReferenceEvent | null,
): Date | null => {
  switch (group.timingMode) {
    case "absolute":
      return parseDate(group.sendAtAbsolute);
    case "from_deadline": {
      const deadlineDate = parseDate(referenceEvent?.date);
      return deadlineDate
        ? subSeconds(deadlineDate, group.sendAtSecondsFromDeadline ?? 0)
        : null;
    }
    case "within_range":
      return (
        parseDate(group.send_range_start) ?? parseDate(group.send_range_end)
      );
    case "within_relative_range": {
      const deadlineDate = parseDate(referenceEvent?.date);
      const startSeconds =
        group.relative_range_start_seconds_from_deadline ?? null;
      return deadlineDate && startSeconds !== null
        ? subSeconds(deadlineDate, startSeconds)
        : null;
    }
    case "event_launch":
      return parseDate(group.memberActionEvent?.date);
    default:
      group.timingMode satisfies never;
      return (
        parseDate(group.sendAtAbsolute) ??
        parseDate(group.send_range_start) ??
        parseDate(group.send_range_end)
      );
  }
};

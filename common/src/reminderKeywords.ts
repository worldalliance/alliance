import { millisecondsInDay, millisecondsInHour } from "date-fns/constants";
import { hoursInDay } from "./duration";
import { nameParts } from "./nameParts";
import { withCount } from "./plural";

/** Full URLs the `#{link}` and `#{grouplink}` keywords expand to. */
export type ReminderLinks = { tasks: string; groupMembers: string };

export enum ActionListStyle {
  Comma = "comma",
  Numbered = "numbered",
}

export function formatActionList(
  names: string[],
  style: ActionListStyle,
): string {
  switch (style) {
    case ActionListStyle.Comma:
      return names.join(", ");
    case ActionListStyle.Numbered:
      return names.length === 1
        ? names.join(", ")
        : names.map((name, index) => `${index + 1}. ${name}`).join("\n");
    default:
      throw new Error(`unknown action list style: ${style satisfies never}`);
  }
}

export function getTimeLeftString(
  deadlineEvent: { date: Date },
  dateNow: Date,
  mode: "both" | "days" | "hours" = "both",
): string {
  if (dateNow.getTime() > deadlineEvent.date.getTime()) {
    return withCount(0, mode === "days" ? "day" : "hour");
  }
  let days = Math.floor(
    (deadlineEvent.date.getTime() - dateNow.getTime()) / millisecondsInDay,
  );
  let hours = Math.round(
    (deadlineEvent.date.getTime() -
      dateNow.getTime() -
      days * millisecondsInDay) /
      millisecondsInHour,
  );

  if (hours === hoursInDay) {
    days += 1;
    hours = 0;
  }

  if (mode === "hours") {
    return withCount(hours, "hour");
  }
  if (mode === "days") {
    return withCount(days, "day");
  }

  if (days === 0) {
    return withCount(hours, "hour");
  }
  if (hours === 0) {
    return withCount(days, "day");
  }

  const daysString = withCount(days, "day");
  const hoursString = withCount(hours, "hour");

  return `${daysString}, ${hoursString}`;
}

function interpretEscapes(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

export function renderReminderKeywords(
  text: string,
  context: {
    user: { id: number; name: string };
    action: { name: string };
    deadlineEvent?: { date: Date };
    uncompletedTasksCount: number;
    uncompletedTasksTime: string;
    uncompletedTasksNames: string[];
    dateNow?: Date;
    uncompletedMembersInGroupCount?: number;
    isFirstAssignedSuite?: boolean;
    links: ReminderLinks;
  },
): string {
  const dateNow = context.dateNow ?? new Date();
  const { firstname, lastname } = nameParts(context.user.name);
  if (!lastname) {
    console.error(`User ${context.user.id} has no last name`);
  }
  let str = text
    .replaceAll("#{fullname}", context.user.name)
    .replaceAll("#{firstname}", firstname)
    .replaceAll("#{nmembers}", () =>
      context.uncompletedMembersInGroupCount === undefined
        ? "0"
        : context.uncompletedMembersInGroupCount.toString(),
    )
    .replaceAll("#{grouplink}", context.links.groupMembers)
    .replaceAll("#{lastname}", lastname)
    .replaceAll("#{action}", context.action.name)
    .replaceAll(
      "#{tasknames}",
      formatActionList(context.uncompletedTasksNames, ActionListStyle.Comma),
    )
    .replaceAll("#{n}", context.uncompletedTasksCount.toString())
    .replaceAll("#{tasktime}", context.uncompletedTasksTime)
    .replaceAll(
      "#{missedactioncontext}",
      context.isFirstAssignedSuite
        ? 'The Alliance counts on every member. We plan precise actions based on the number of people we expect to participate.\n\nTo learn more about our model, you can watch <a href="https://www.youtube.com/watch?v=fR7Upo0DlYs&t=125s">this video</a>.\n\nPlease know that if you miss several actions in a row, we will suspend your contract and no longer assign you tasks.'
        : "Remember that we plan each action around the number of members we expect to participate.",
    )
    // Only marks a missed-suite group; a second miss sends its own copy.
    .replaceAll("#{secondmisswarning}", "")
    .replaceAll("#{s}", context.uncompletedTasksCount === 1 ? "" : "s")
    .replaceAll(
      "#{days}",
      context.deadlineEvent
        ? getTimeLeftString(context.deadlineEvent, dateNow, "days")
        : "[err]",
    )
    .replaceAll(
      "#{hours}",
      context.deadlineEvent
        ? getTimeLeftString(context.deadlineEvent, dateNow, "hours")
        : "[err]",
    )
    .replaceAll(
      "#{timeremaining}",
      context.deadlineEvent
        ? getTimeLeftString(context.deadlineEvent, dateNow)
        : "[err]",
    )
    .replaceAll("#{link}", context.links.tasks)
    .replaceAll(
      "#{formattedtasklist}",
      formatActionList(context.uncompletedTasksNames, ActionListStyle.Numbered),
    );

  while (str.includes("|") && str.includes("#{") && str.includes("}")) {
    const idx_start = str.indexOf("#{");
    const idx_separator = str.indexOf("|", idx_start);
    const idx_end = str.indexOf("}", idx_separator);
    const st_one = interpretEscapes(
      str.substring(idx_start + 2, idx_separator),
    );
    const st_many = interpretEscapes(str.substring(idx_separator + 1, idx_end));
    if (context.uncompletedTasksCount === 1) {
      str = str.substring(0, idx_start) + st_one + str.substring(idx_end + 1);
    } else {
      str = str.substring(0, idx_start) + st_many + str.substring(idx_end + 1);
    }
  }

  return str;
}

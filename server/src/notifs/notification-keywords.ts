import { nameParts } from "@alliance/common/nameParts";
import { ActionEvent } from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { groupMembersListUrl, tasksUrl } from "src/search/approutes";
import { User } from "src/user/entities/user.entity";
import { ActionListStyle, formatActionList } from "./notification-content";
import { getTimeLeftString } from "./textnotifcontents";

function interpretEscapes(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

export function processKeywordReplacements(
  text: string,
  context: {
    user: Pick<User, "id" | "name">;
    action: Pick<Action, "name">;
    deadlineEvent?: Pick<ActionEvent, "date">;
    uncompletedTasksCount: number;
    uncompletedTasksTime: string;
    uncompletedTasksNames: string[];
    dateNow?: Date;
    uncompletedMembersInGroupCount?: number;
    isFirstAssignedSuite?: boolean;
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
    .replaceAll("#{grouplink}", groupMembersListUrl(true))
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
    .replaceAll("#{link}", tasksUrl(true))
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

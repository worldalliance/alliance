import { withCount } from "@alliance/common/plural";
import { ActionEvent } from "src/actions/entities/action-event.entity";

export function getTimeLeftString(
  deadlineEvent: ActionEvent,
  dateNow: Date,
  mode: "both" | "days" | "hours" = "both",
): string {
  if (dateNow.getTime() > deadlineEvent.date.getTime()) {
    return withCount(0, mode === "days" ? "day" : "hour");
  }
  let days = Math.floor(
    (deadlineEvent.date.getTime() - dateNow.getTime()) / (1000 * 60 * 60 * 24),
  );
  let hours = Math.round(
    (deadlineEvent.date.getTime() -
      dateNow.getTime() -
      days * 1000 * 60 * 60 * 24) /
      (1000 * 60 * 60),
  );

  if (hours === 24) {
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

export const welcomeMessage = `Thanks for opting in to action notifications from the Alliance! You'll get a text here when a new action is ready to complete. Reply STOP to opt out.`;

export const suspensionMessage = `You missed all assigned non-optional actions for 3 weeks in a row, so we've suspended your Alliance contract automatically. `;

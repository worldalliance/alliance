import { ActionDto, ActionEventDto } from "../client";
import { format } from "date-fns";

export interface TaskTimeInfoPropsShared {
  action: ActionDto;
  nextEvent: ActionEventDto | null;
  lastEvent: ActionEventDto | null;
  absoluteDeadline?: boolean;
}

export function deadlineColor(
  nextEvent: ActionEventDto | null,
  action: ActionDto
) {
  return !!nextEvent &&
    new Date(nextEvent.date).getTime() - Date.now() < 172800000 &&
    !action.optional // 2 days
    ? "#dc2626"
    : "#71717a";
}

export function formatDeadline(date: string) {
  return format(new Date(date), "MMMM d h:mm a");
}

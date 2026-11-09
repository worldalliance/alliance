import {
  hasTakenEffect,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type { AdminActionDto } from "@alliance/shared/client";

export enum ActionPhase {
  Draft = "draft",
  StaffTesting = "staff_testing",
  Scheduled = "scheduled",
  Live = "live",
  Closed = "closed",
}

export const actionPhase = (
  action: Pick<AdminActionDto, "staffPreview" | "events">,
  now: Date,
): ActionPhase => {
  const { event, deadlineEvent } = memberActionPhase(action.events);
  if (!event) {
    return action.staffPreview ? ActionPhase.StaffTesting : ActionPhase.Draft;
  }
  if (!hasTakenEffect(event.date, now)) return ActionPhase.Scheduled;
  if (deadlineEvent && hasTakenEffect(deadlineEvent.date, now)) {
    return ActionPhase.Closed;
  }
  return ActionPhase.Live;
};

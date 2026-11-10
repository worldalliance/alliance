import {
  hasTakenEffect,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type { ActionStatus, AdminActionDto } from "@alliance/shared/client";

export enum ActionPhase {
  Draft = "draft",
  StaffTesting = "staff_testing",
  Scheduled = "scheduled",
  Live = "live",
  Closed = "closed",
}

const CLOSES_UNLAUNCHED: Record<ActionStatus, boolean> = {
  draft: false,
  planned: false,
  member_action: false,
  office_action: false,
  resolution: false,
  completed: true,
  failed: true,
  abandoned: true,
};

export const actionPhase = (
  action: Pick<AdminActionDto, "staffPreview" | "events" | "status">,
  now: Date,
): ActionPhase => {
  const { event, deadlineEvent } = memberActionPhase(action.events);
  if (!event) {
    if (CLOSES_UNLAUNCHED[action.status]) return ActionPhase.Closed;
    return action.staffPreview ? ActionPhase.StaffTesting : ActionPhase.Draft;
  }
  if (!hasTakenEffect(event.date, now)) return ActionPhase.Scheduled;
  if (deadlineEvent && hasTakenEffect(deadlineEvent.date, now)) {
    return ActionPhase.Closed;
  }
  return ActionPhase.Live;
};

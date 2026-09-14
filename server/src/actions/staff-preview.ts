import { ForbiddenException } from "@nestjs/common";
import { hasMemberActionStarted } from "src/utils/action-user";
import type { Action } from "./entities/action.entity";

export function isStaffPreviewActive(
  action: Pick<Action, "staffPreview" | "events">,
  now: Date,
): boolean {
  if (!action.events) {
    throw new Error("`events` relation is not loaded");
  }
  return action.staffPreview && !hasMemberActionStarted(action.events, now);
}

export function assertNotInStaffPreview(
  action: Pick<Action, "staffPreview" | "events">,
): void {
  if (isStaffPreviewActive(action, new Date())) {
    throw new ForbiddenException("This action is in staff preview");
  }
}

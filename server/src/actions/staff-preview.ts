import { ForbiddenException } from "@nestjs/common";
import type { User } from "src/user/entities/user.entity";
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

export function isStaffPreviewActiveFor(params: {
  user: Pick<User, "staff">;
  action: Pick<Action, "staffPreview" | "events" | "archived">;
  now: Date;
}): boolean {
  const { user, action, now } = params;
  return user.staff && !action.archived && isStaffPreviewActive(action, now);
}

export function assertNotInStaffPreview(
  action: Pick<Action, "staffPreview" | "events">,
): void {
  if (isStaffPreviewActive(action, new Date())) {
    throw new ForbiddenException("This action is in staff preview");
  }
}

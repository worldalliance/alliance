import { ActionDto, ActionEventDto, type TaskAwayStatus } from "../client";
import { ActionWithAwayStatus, deadlineHasPassed } from "./actionUtils";
import { taskHeaders } from "./copy";

export interface LargeActionCardPropsShared {
  action: ActionWithAwayStatus;
  onUpdateActionState: () => void;
  dismissProps?: {
    header: string;
    message: string;
    onDismiss: () => void;
  };
}

const AWAY_STATUS_MESSAGES = {
  away_currently: taskHeaders.homePage.away.description.currentlyAway,
  away_later: taskHeaders.homePage.away.description.willBeAway,
  away_previously: taskHeaders.homePage.away.description.wasAway,
} as const satisfies Record<Exclude<TaskAwayStatus, "not_away">, string>;

/**
 * Pure data computation — returns the banner header/message for a task that can
 * be dismissed (away, deadline passed, or optional).  The caller is responsible
 * for attaching the `onDismiss` callback before passing to a component.
 */
export function getTaskDismissInfo(
  action: ActionWithAwayStatus,
): { header: string; message: string } | undefined {
  if (action.onboarding) return undefined;

  // Viewer-first with the legacy flat-field fallback (see the note in
  // actionUtils.ts). Both carry the same 4-valued TaskAwayStatus.
  const away = action.viewer ? action.viewer.away : action.awayStatus;
  switch (away) {
    case "away_currently":
    case "away_later":
    case "away_previously":
      return {
        header: taskHeaders.homePage.away.title,
        message: AWAY_STATUS_MESSAGES[away],
      };
    case "not_away":
      break;
    default:
      away satisfies never;
      return undefined;
  }

  if (deadlineHasPassed(action)) {
    return {
      header: taskHeaders.homePage.deadline.title,
      message: taskHeaders.homePage.deadline.description,
    };
  }

  if (action.optional) {
    return {
      header: taskHeaders.homePage.optional.title,
      message: taskHeaders.homePage.optional.description,
    };
  }

  return undefined;
}

export function getNextEvent(action: ActionDto): ActionEventDto | null {
  const now = new Date();
  const futureEvents = action.events.filter(
    (event) => new Date(event.date) > now,
  );
  return futureEvents.length > 0 ? futureEvents[0] : null;
}

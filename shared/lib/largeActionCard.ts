import { ActionDto, ActionEventDto } from "../client";
import {
  ActionWithAwayStatus,
  TaskAwayStatus,
  deadlineHasPassed,
} from "./actionUtils";
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
  [TaskAwayStatus.AWAY_CURRENTLY]:
    taskHeaders.homePage.away.description.currentlyAway,
  [TaskAwayStatus.AWAY_LATER]: taskHeaders.homePage.away.description.willBeAway,
  [TaskAwayStatus.AWAY_PREVIOUSLY]:
    taskHeaders.homePage.away.description.wasAway,
} as const satisfies Record<
  Exclude<TaskAwayStatus, TaskAwayStatus.NOT_AWAY>,
  string
>;

/**
 * Pure data computation — returns the banner header/message for a task that can
 * be dismissed (away, deadline passed, or optional).  The caller is responsible
 * for attaching the `onDismiss` callback before passing to a component.
 */
export function getTaskDismissInfo(
  action: ActionWithAwayStatus,
): { header: string; message: string } | undefined {
  if (action.onboarding) return undefined;

  if (action.awayStatus !== TaskAwayStatus.NOT_AWAY) {
    return {
      header: taskHeaders.homePage.away.title,
      message: AWAY_STATUS_MESSAGES[action.awayStatus],
    };
  }

  if (deadlineHasPassed(action, new Date())) {
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

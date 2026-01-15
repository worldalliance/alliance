import { ActionDto, UserActionRelation } from "../client";
import { ActionWithAwayStatus } from "./actionUtils";

export interface LargeActionCardPropsShared {
  action: ActionWithAwayStatus;
  userRelation: UserActionRelation;
  onUpdateActionState: () => void;
  dismissProps?: {
    message: string;
  };
  handleDismiss: () => void;
}
export function getLastAndNextEvent(action: ActionDto) {
  const pastEvents = action.events.filter(
    (event) => new Date(event.date) <= new Date()
  );

  const futureEvents = action.events.filter(
    (event) => new Date(event.date) > new Date()
  );

  const lastEvent =
    pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;
  const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;

  return { lastEvent, nextEvent };
}

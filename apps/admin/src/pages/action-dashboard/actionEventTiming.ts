import { hasTakenEffect } from "@alliance/common/actionEvent";
import type { ActionEventDto } from "@alliance/shared/client";

export function currentEventIdAt(
  events: ActionEventDto[],
  now: Date,
): number | undefined {
  return events
    .filter((event) => hasTakenEffect(event.date, now))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    ?.id;
}

export function hasMemberActionStartedAt(
  events: ActionEventDto[],
  now: Date,
): boolean {
  return events.some(
    (event) =>
      event.newStatus === "member_action" && hasTakenEffect(event.date, now),
  );
}

import { hasTakenEffect } from "@alliance/common/actionEvent";
import type { ActionEventDto } from "@alliance/shared/client";
import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";

export function currentEventIdAt(
  events: ActionEventDto[],
  now: Date,
): number | undefined {
  return sortByDateDescending(
    events.filter((event) => hasTakenEffect(event.date, now)),
  )[0]?.id;
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

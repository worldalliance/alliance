import { ActionDto, ActionEventDto, ActionUpdateDto } from "../client";

/**
 * ActionEvent extended with associated updates
 */
export type ActionEventWithUpdates = ActionEventDto & {
  updates?: ActionUpdateDto[];
};

/**
 * Union type for interleaved timeline items
 */
export type TimelineItem = ActionEventWithUpdates | ActionUpdateDto;

/**
 * Check if a timeline item is an event (has newStatus property)
 */
export function isActionEvent(
  item: TimelineItem,
): item is ActionEventWithUpdates {
  return "newStatus" in item;
}

/**
 * Filter events to exclude 'planned' status unless it's the only event
 */
export function filterEvents(events: ActionEventDto[]): ActionEventDto[] {
  return events.length > 1
    ? events.filter((event) => event.newStatus !== "planned")
    : events;
}

/**
 * Add draft event if action is in draft status with no events
 */
export function addDraftEventIfNeeded(
  events: ActionEventDto[],
  status: string,
): ActionEventDto[] {
  if (status === "draft" && events.length === 0) {
    return [
      {
        id: 0,
        title: "Draft",
        description: "This action is being viewed as a draft preview",
        date: new Date().toISOString(),
        newStatus: "draft",
        suiteManaged: false,
      },
    ];
  }
  return events;
}

/**
 * Associate updates with their corresponding events
 */
export function associateUpdatesWithEvents(
  events: ActionEventDto[],
  updates: ActionUpdateDto[],
): ActionEventWithUpdates[] {
  const now = new Date().getTime();

  return events.map((event) => ({
    ...event,
    updates: updates.filter(
      (update) =>
        update.associatedEventId !== undefined &&
        update.associatedEventId === event.id &&
        new Date(update.date).getTime() <= now, // don't show future updates
    ),
  }));
}

/**
 * Get updates that are not associated with any event
 */
export function getUpdatesWithoutEvents(
  updates: ActionUpdateDto[],
): ActionUpdateDto[] {
  return updates.filter((update) => !update.associatedEventId);
}

/**
 * Filter out future items (updates/events)
 */
export function filterFutureItems<T extends { date: string }>(items: T[]): T[] {
  const now = new Date().getTime();
  return items.filter((item) => new Date(item.date).getTime() <= now);
}

/**
 * Sort items by date descending (newest first)
 */
export function sortByDateDescending<T extends { date: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * Process action data into an interleaved timeline
 */
export function processActionTimeline(action: ActionDto): {
  interleaved: TimelineItem[];
  highlightedId: number | undefined;
  highlightedIndex: number;
} {
  // Filter and prepare events
  let events = filterEvents(action.events);
  events = addDraftEventIfNeeded(events, action.status);

  // Associate updates with events
  const eventsWithUpdates = associateUpdatesWithEvents(events, action.updates);

  // Get standalone updates (not associated with events)
  const updatesWithoutEvents = getUpdatesWithoutEvents(action.updates);
  const filteredUpdates = filterFutureItems(updatesWithoutEvents);

  // Interleave and sort
  const interleaved = sortByDateDescending([
    ...eventsWithUpdates,
    ...filteredUpdates,
  ]);

  // Find highlighted item (latest event/update that isn't in the future)
  const now = new Date().getTime();
  const highlightedIndex = interleaved.findIndex(
    (e) => new Date(e.date).getTime() <= now,
  );
  const highlightedId =
    highlightedIndex !== -1 ? interleaved[highlightedIndex].id : undefined;

  return {
    interleaved,
    highlightedId,
    highlightedIndex,
  };
}

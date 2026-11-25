import type {
  ActionSuiteDto,
  CreateActionEventDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import SuiteEventList from "../../components/SuiteEventList";

/**
 * The suite's shared events. A refused edit or delete goes to `reportError`,
 * which the page shows as its banner.
 */
export function SuiteEventsTab({
  suite,
  addEvent,
  updateEvent,
  deleteEvent,
}: {
  suite: ActionSuiteDto;
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  updateEvent: (eventId: number, body: UpdateActionEventDto) => void;
  deleteEvent: (eventId: number) => void;
}) {
  return (
    <SuiteEventList
      events={suite.events}
      addToSuite={addEvent}
      onEdit={updateEvent}
      onDelete={deleteEvent}
    />
  );
}

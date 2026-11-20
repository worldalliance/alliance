import { AdminActionDto } from "@alliance/shared/client";
import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";
import { formatDateTimeWithZone } from "@alliance/shared/lib/dateFormatters";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import CreateEventForm, { type AddActionEvent } from "./CreateEventForm";
import { ActionStatusPill } from "./ui/StatusPill";

// Status options for event creation

export interface EventManagementTabProps {
  action: AdminActionDto;
  addEvent: AddActionEvent;
}

const EventManagementTab = ({ action, addEvent }: EventManagementTabProps) => {
  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);
  const [eventCreatedSuccess, setEventCreatedSuccess] =
    useState<boolean>(false);

  const [addEventExpanded, setAddEventExpanded] = useState(true);

  return (
    <div className="space-y-4">
      <Card style={CardStyle.White}>
        <div className="flex flex-row items-center justify-start gap-x-2">
          <button
            onClick={() => setAddEventExpanded(!addEventExpanded)}
            style={{
              transform: addEventExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDown className="h-3 w-3 text-black" />
          </button>
          <h2 className="text-lg font-semibold">Add new event</h2>
        </div>
        {addEventExpanded && (
          <CreateEventForm
            addToAction={addEvent}
            setEventCreatedSuccess={setEventCreatedSuccess}
            eventCreatedSuccess={eventCreatedSuccess}
            creatingEvent={creatingEvent}
            setCreatingEvent={setCreatingEvent}
            suiteMode={false}
          />
        )}
      </Card>
      <h2 className="text-lg font-semibold mb-4">All events</h2>
      <div className="space-y-3 mb-3">
        {action.events && action.events.length > 0 ? (
          sortByDateDescending(action.events).map((event) => (
            <div
              key={event.id}
              className="border border-gray-200 rounded-lg p-3 bg-white"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900 text-sm">
                  {event.title}
                </h3>
                <ActionStatusPill status={event.newStatus} />
              </div>

              {event.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {event.description}
                </p>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <div>Date: {formatDateTimeWithZone(new Date(event.date))}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No events created yet. Add an event to change the action status.
          </div>
        )}
      </div>
    </div>
  );
};

export default EventManagementTab;

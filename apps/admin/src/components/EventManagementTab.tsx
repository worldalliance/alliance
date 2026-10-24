import { AdminActionDto } from "@alliance/shared/client";
import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  ACTION_STATUS_COLORS,
  ACTION_STATUS_LABELS,
} from "../lib/actionStatusDisplay";
import CreateEventForm, { type AddActionEvent } from "./CreateEventForm";

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
          <h2 className="text-lg font-semibold">Add New Event</h2>
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
      <h2 className="text-lg font-semibold mb-4">All Events</h2>
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
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                    ACTION_STATUS_COLORS[event.newStatus],
                  )}
                >
                  {ACTION_STATUS_LABELS[event.newStatus]}
                </span>
              </div>

              {event.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {event.description}
                </p>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  Date:{" "}
                  {new Date(event.date).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })}
                </div>
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

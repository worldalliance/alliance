import { ActionDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import DatabaseIcon from "@alliance/shared/ui/icons/DatabaseIcon";
import DropdownIcon from "@alliance/shared/ui/icons/DropdownIcon";
import { useState } from "react";
import { formatStatus, getStatusColor } from "../pages/ActionDashboard";
import CreateEventForm from "./CreateEventForm";

// Status options for event creation

export interface EventManagementTabProps {
  action: ActionDto;
  setAction: (action: ActionDto) => unknown;
}

const EventManagementTab = ({ action, setAction }: EventManagementTabProps) => {
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
            <DropdownIcon size="small" fill="black" />
          </button>
          <h2 className="text-lg font-semibold">Add New Event</h2>
        </div>
        {addEventExpanded && (
          <CreateEventForm
            action={action}
            setAction={setAction}
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
          action.events
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .map((event) => (
              <div
                key={event.id}
                className="border border-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">
                    {event.title}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      event.newStatus
                    )}`}
                  >
                    {formatStatus(event.newStatus)}
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
                  <div>
                    Timeline: {event.showInTimeline ? "Visible" : "Hidden"}
                  </div>
                </div>

                <div className="pt-2 mt-2 flex flex-row gap-x-2">
                  <Button
                    onClick={() =>
                      window.open(
                        `/database?table=action_event&id=${event.id}`,
                        "_blank"
                      )
                    }
                    color={ButtonColor.White}
                    className="!px-3 !text-xs gap-x-1"
                  >
                    <DatabaseIcon />
                    Edit in Database
                  </Button>
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

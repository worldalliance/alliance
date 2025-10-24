import {
  ActionDto,
  actionsAddEvent,
  actionsCreateReminder,
  actionsEventNotifData,
  ActionStatus,
  CreateActionEventDto,
  PreEventNotifDataDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import DatabaseIcon from "@alliance/shared/ui/icons/DatabaseIcon";
import DropdownIcon from "@alliance/shared/ui/icons/DropdownIcon";
import { formatDate } from "date-fns";
import { useEffect, useState } from "react";
import { formatStatus, getStatusColor } from "../pages/ActionDashboard";
import DateTimePicker, {
  DateTimePickerChange,
} from "@alliance/shared/ui/DateTimePicker";
import {
  defaultEmailContents,
  defaultEmailSubject,
  defaultTextMessage,
} from "./ActionRemindersTab";

// Status options for event creation
const statusOptions: Record<ActionStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  gathering_commitments: "Gathering Commitments",
  office_action: "Office Action",
  member_action: "Member Action",
  resolution: "Resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

const defaultEventNames: Record<ActionStatus, string> = {
  draft: "",
  gathering_commitments: "Gathering commitments",
  office_action: "Pending office action",
  member_action: "Members taking action",
  resolution: "Pending office resolution",
  completed: "Action successful",
  failed: "Action failed",
  abandoned: "Action dropped",
  upcoming: "",
};

export interface EventManagementTabProps {
  action: ActionDto;
  setAction: (action: ActionDto) => unknown;
}

const EventManagementTab = ({ action, setAction }: EventManagementTabProps) => {
  const [eventForm, setEventForm] = useState<CreateActionEventDto>({
    title: "",
    description: "",
    newStatus: action.commitmentless
      ? "member_action"
      : "gathering_commitments",
    date: new Date().toISOString(),
    showInTimeline: true,
    sendNotifsTo: "all",
  });

  const [useCustomName, setUseCustomName] = useState<boolean>(false);
  const [launchNow, setLaunchNow] = useState<boolean>(true);
  const [useDeadlineEvent, setUseDeadlineEvent] = useState<boolean>(false);
  const [createReminders, setCreateReminders] = useState<boolean>(false);
  const [notifData, setNotifData] = useState<PreEventNotifDataDto | null>(null);

  const [creatingEvent, setCreatingEvent] = useState<boolean>(false);
  const [eventCreatedSuccess, setEventCreatedSuccess] =
    useState<boolean>(false);

  const [addEventExpanded, setAddEventExpanded] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    setCreatingEvent(true);

    try {
      const eventData = {
        ...eventForm,
        title: useCustomName
          ? eventForm.title
          : defaultEventNames[eventForm.newStatus as ActionStatus],
        description: useCustomName ? eventForm.description : "",
        date: launchNow
          ? new Date().toISOString()
          : new Date(eventForm.date).toISOString(),
      };

      const response = await actionsAddEvent({
        path: { id: action.id },
        body: eventData,
      });
      const addedEvent = response.data;
      let addedOfficeActionEvent = null;

      if (
        useDeadlineEvent &&
        !response.error &&
        (eventForm.newStatus === "member_action" ||
          eventForm.newStatus === "gathering_commitments")
      ) {
        const officeActionEvent = {
          title: defaultEventNames["office_action"],
          date: new Date(
            new Date(eventForm.date).getTime() + 604800000
          ).toISOString(),
          newStatus: "office_action",
          sendNotifsTo: "none",
          showInTimeline: false,
          description: "",
        } satisfies CreateActionEventDto;

        const officeActionEventResponse = await actionsAddEvent({
          path: { id: action.id },
          body: officeActionEvent,
        });
        addedOfficeActionEvent = officeActionEventResponse.data;

        if (officeActionEventResponse.error) {
          setError("Failed to add office action event");
          console.error(officeActionEventResponse.error);
        }

        if (createReminders && addedEvent) {
          const newEventId = addedEvent.id;
          const threeDayReminderResponse = await actionsCreateReminder({
            path: { actionId: action.id, eventId: newEventId },
            body: {
              cohortType: "all_uncompleted",
              timingMode: "from_deadline",
              sendAtSecondsFromDeadline: 3 * 24 * 60 * 60,
              emailSubject: defaultEmailSubject,
              emailMessage: defaultEmailContents,
              textMessage: defaultTextMessage,
            },
          });
          if (threeDayReminderResponse.error) {
            setError("Failed to add 3 day reminder");
            console.error(threeDayReminderResponse.error);
          }
          const oneDayReminderResponse = await actionsCreateReminder({
            path: { actionId: action.id, eventId: newEventId },
            body: {
              cohortType: "all_uncompleted",
              timingMode: "from_deadline",
              sendAtSecondsFromDeadline: 1 * 24 * 60 * 60,
              emailSubject: defaultEmailSubject,
              emailMessage: defaultEmailContents,
              textMessage: defaultTextMessage,
            },
          });
          if (oneDayReminderResponse.error) {
            setError("Failed to add 1 day reminder");
            console.error(oneDayReminderResponse.error);
          }
        }
      }

      if (addedEvent) {
        setAction({
          ...action,
          events: !!addedOfficeActionEvent
            ? [...action.events, addedEvent, addedOfficeActionEvent]
            : [...action.events, addedEvent],
        });

        // Show success feedback
        setEventCreatedSuccess(true);
        setTimeout(() => setEventCreatedSuccess(false), 3000);

        // Reset form
        setEventForm({
          title: "",
          description: "",
          newStatus: "gathering_commitments",
          date: new Date().toISOString(),
          showInTimeline: true,
          sendNotifsTo: "all",
        });
        setUseCustomName(false);
        setLaunchNow(true);
      } else {
        setError("Failed to add event");
      }
    } catch (err) {
      setError("Failed to add event");
      console.error(err);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleEventInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setEventForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleDateInputChange = (change: DateTimePickerChange) => {
    setEventForm((prev) => ({
      ...prev,
      date: change.utcValue || "",
    }));
  };

  useEffect(() => {
    const loadNotifData = async () => {
      const response = await actionsEventNotifData({
        path: { id: action.id },
        query: {
          type: eventForm.newStatus,
          sendNotifsTo: eventForm.sendNotifsTo,
        },
      });
      if (response.data) {
        setNotifData(response.data);
      }
    };
    loadNotifData();
  }, [eventForm.newStatus, eventForm.sendNotifsTo, action.id]);

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500">{error}</p>}
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
          <form onSubmit={handleAddEvent} className="space-y-4 mt-4">
            <div className="mb-4 flex flex-row items-center">
              <label htmlFor="newStatus" className="block text-black min-w-25">
                New Status
              </label>
              <select
                id="newStatus"
                name="newStatus"
                value={eventForm.newStatus}
                onChange={handleEventInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(statusOptions).map(([key, label]) => {
                  // Don't allow selecting gathering_commitments if action is commitmentless
                  if (
                    key === "gathering_commitments" &&
                    action.commitmentless
                  ) {
                    return null;
                  }
                  return (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div
              className={`${
                useCustomName ? "bg-zinc-100" : ""
              } p-2 -m-1 rounded-md`}
            >
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="useCustomName"
                  checked={useCustomName}
                  onChange={(e) => setUseCustomName(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="useCustomName"
                  className="ml-2 block text-black"
                >
                  Use custom name
                </label>
              </div>
              {!useCustomName && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Using default title:</strong>{" "}
                    {defaultEventNames[eventForm.newStatus as ActionStatus] ||
                      "No default name for this status"}
                  </p>
                </div>
              )}

              {useCustomName && (
                <>
                  <div>
                    <label
                      htmlFor="eventTitle"
                      className="block text-black mb-1"
                    >
                      Event Title *
                    </label>
                    <input
                      type="text"
                      id="eventTitle"
                      name="title"
                      value={eventForm.title}
                      onChange={handleEventInputChange}
                      required={useCustomName}
                      placeholder="e.g., Launch Event, Office Action"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="eventDescription"
                      className="block text-black mb-1"
                    >
                      Description
                    </label>
                    <textarea
                      id="eventDescription"
                      name="description"
                      value={eventForm.description}
                      onChange={handleEventInputChange}
                      rows={2}
                      placeholder="Describe what happened or what this event represents"
                      className="bg-white w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div
              className={`${
                !launchNow ? "bg-zinc-100 mb-2" : ""
              } p-2 -m-1 rounded-md mt-4`}
            >
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="launchNow"
                  checked={launchNow}
                  onChange={(e) => setLaunchNow(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="launchNow" className="ml-2 block text-black">
                  Launch now
                </label>
              </div>

              {!launchNow && (
                <div>
                  <label htmlFor="eventDate" className="block text-black mb-1">
                    Launch time (
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    ):
                  </label>
                  <DateTimePicker
                    id="eventDate"
                    name="date"
                    value={eventForm.date}
                    onChange={handleDateInputChange}
                    required
                    className="max-w-80"
                  />
                </div>
              )}
            </div>

            {(eventForm.newStatus === "member_action" ||
              eventForm.newStatus === "gathering_commitments") && (
              <div
                className={`${
                  useDeadlineEvent ? "bg-zinc-100 mb-2" : ""
                } p-2 -m-1 rounded-md`}
              >
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="deadlineExists"
                    checked={useDeadlineEvent}
                    onChange={(e) => setUseDeadlineEvent(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="deadlineExists"
                    className="ml-2 block text-black"
                  >
                    Automatically create office action transition 1 week after
                    launch
                  </label>
                </div>

                {useDeadlineEvent && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      This will create a second action event timed to one week
                      after the launch of this one, providing a deadline for
                      members.
                    </p>
                    {eventForm.date && (
                      <p className="text-sm text-gray-600 mb-1">
                        Date:{" "}
                        {formatDate(
                          new Date(eventForm.date).getTime() + 604800000,
                          "MM/dd/yyyy hh:mm a"
                        )}
                      </p>
                    )}
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id="deadlineExists"
                        checked={createReminders}
                        onChange={(e) => setCreateReminders(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="deadlineExists"
                        className="ml-2 block text-black"
                      >
                        Automatically create 3 and 1 day reminders before
                        deadline
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="sendNotifsTo" className="block text-black mb-1">
                  Send Notifications To
                </label>
                <select
                  id="sendNotifsTo"
                  name="sendNotifsTo"
                  value={eventForm.sendNotifsTo}
                  onChange={handleEventInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="none">None</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showInTimeline"
                  name="showInTimeline"
                  checked={eventForm.showInTimeline}
                  onChange={handleEventInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-10"
                />
                <label
                  htmlFor="showInTimeline"
                  className="ml-2 block text-black"
                >
                  Show in public timeline
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingEvent}
              className={`w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                creatingEvent
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : eventCreatedSuccess
                  ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
                  : "bg-[#333] text-white hover:bg-[#444] focus:ring-blue-500"
              }`}
            >
              {creatingEvent ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Adding Event...
                </span>
              ) : eventCreatedSuccess ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Event Added!
                </span>
              ) : (
                "Add Event"
              )}
            </button>
            {!(
              typeof window !== "undefined" &&
              window.location.href.includes("localhost")
            ) && (
              <div className="flex justify-between items-center">
                <p
                  className={`px-4 py-2 rounded self-start ${
                    notifData?.emails.length || notifData?.texts.length
                      ? "bg-yellow-600 text-white"
                      : "border border-gray-200"
                  }`}
                >
                  ⚠️ This will send <b>{notifData?.emails.length}</b> emails and{" "}
                  <b>{notifData?.texts.length}</b> texts
                </p>
              </div>
            )}
          </form>
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
                    Notifications: {event.sendNotifsTo} | Timeline:{" "}
                    {event.showInTimeline ? "Visible" : "Hidden"}
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
                  <Button
                    onClick={() =>
                      (window.location.href = `/event/${event.id}`)
                    }
                    color={ButtonColor.White}
                    className="!px-3 !text-xs gap-x-1"
                  >
                    See notifications
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

import {
  ActionDto,
  ActionEventDto,
  actionsAddEvent,
  actionsAddSuiteEvent,
  ActionStatus,
  ActionSuiteDto,
  CreateActionEventDto,
} from "@alliance/shared/client";
import DateTimePicker, {
  DateTimePickerChange,
} from "@alliance/shared/ui/DateTimePicker";
import { useState } from "react";

export type CreateEventFormProps = {
  action: ActionDto;
  creatingEvent: boolean;
  setCreatingEvent: (creatingEvent: boolean) => void;
  setEventCreatedSuccess: (eventCreatedSuccess: boolean) => void;
  eventCreatedSuccess: boolean;
} & (
  | {
      suiteMode: false;
      setAction: (action: ActionDto) => void;
    }
  | {
      suiteMode: true;
      suiteId: number;
      setSuite: (suite: ActionSuiteDto) => void;
    }
);

const statusOptions: Record<ActionStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  gathering_commitments: "Gathering Commitments",
  office_action: "Office Action",
  member_action: "Member Action",
  resolution: "Resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

const defaultEventNames: Record<ActionStatus, string> = {
  draft: "Draft",
  gathering_commitments: "Gathering commitments",
  office_action: "Pending office action",
  member_action: "Members taking action",
  resolution: "Pending office resolution",
  completed: "Action completed",
  failed: "Action failed",
  abandoned: "Action dropped",
  planned: "Planned",
};

const CreateEventForm = (props: CreateEventFormProps) => {
  const {
    action,
    creatingEvent,
    suiteMode,
    setCreatingEvent,
    setEventCreatedSuccess,
    eventCreatedSuccess,
  } = props;
  const [useCustomName, setUseCustomName] = useState<boolean>(false);
  const [launchNow, setLaunchNow] = useState<boolean>(true);
  const [useDeadlineEvent, setUseDeadlineEvent] = useState<boolean>(false);
  const [deadlineEventDate, setDeadlineEventDate] = useState<string>(
    new Date(new Date().getTime() + 604800000).toISOString()
  );
  const [error, setError] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<CreateActionEventDto>({
    title: "",
    description: "",
    newStatus: action.commitmentless
      ? "member_action"
      : "gathering_commitments",
    date: new Date().toISOString(),
  });

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

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    setCreatingEvent(true);

    let updatedSuite: ActionSuiteDto | null = null;
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
      let response;

      if (suiteMode) {
        response = await actionsAddSuiteEvent({
          path: { suiteId: props.suiteId },
          body: eventData,
        });
        if (response.data) {
          updatedSuite = response.data;
        }
      } else {
        response = await actionsAddEvent({
          path: { id: action.id },
          body: eventData,
        });
      }
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
          date: deadlineEventDate,
          newStatus: "office_action",
          description: "",
        } satisfies CreateActionEventDto;

        let officeActionEventResponse;
        if (suiteMode) {
          officeActionEventResponse = await actionsAddSuiteEvent({
            path: { suiteId: props.suiteId },
            body: officeActionEvent,
          });
          if (officeActionEventResponse.data) {
            updatedSuite = officeActionEventResponse.data;
          }
          if (officeActionEventResponse.error) {
            setError("Failed to add office action event");
            console.error(officeActionEventResponse.error);
          }
        } else {
          officeActionEventResponse = await actionsAddEvent({
            path: { id: action.id },
            body: officeActionEvent,
          });
          addedOfficeActionEvent = officeActionEventResponse.data;
          if (officeActionEventResponse.error) {
            setError("Failed to add office action event");
            console.error(officeActionEventResponse.error);
          }
        }
      }

      if (addedEvent) {
        if (!suiteMode) {
          props.setAction({
            ...action,
            events: !!addedOfficeActionEvent
              ? [
                  ...action.events,
                  addedOfficeActionEvent,
                  addedEvent as ActionEventDto,
                ]
              : [...action.events, addedEvent as ActionEventDto],
          });
        }
        if (suiteMode && updatedSuite) {
          props.setSuite(updatedSuite);
        }

        // Show success feedback
        setEventCreatedSuccess(true);
        setTimeout(() => setEventCreatedSuccess(false), 3000);

        // Reset form
        setEventForm({
          title: "",
          description: "",
          newStatus: action.commitmentless
            ? "member_action"
            : "gathering_commitments",
          date: new Date().toISOString(),
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

  return (
    <form onSubmit={handleAddEvent} className="space-y-4 mt-4">
      {error && <p className="text-red-500">{error}</p>}
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
            if (key === "gathering_commitments" && action.commitmentless) {
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
        className={`${useCustomName ? "bg-zinc-100" : ""} p-2 -m-1 rounded-md`}
      >
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="useCustomName"
            checked={useCustomName}
            onChange={(e) => setUseCustomName(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="useCustomName" className="ml-2 block text-black">
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
              <label htmlFor="eventTitle" className="block text-black mb-1">
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
              Launch time ({Intl.DateTimeFormat().resolvedOptions().timeZone}
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
            <label htmlFor="deadlineExists" className="ml-2 block text-black">
              Automatically create office action transition event
            </label>
          </div>

          {useDeadlineEvent && (
            <div>
              <p className="text-sm text-gray-600 mb-1">
                This will create a second action event timed after the launch of
                this one, providing a deadline for members.
              </p>
              <div>
                <label htmlFor="eventDate" className="block text-black mb-1">
                  Deadline event time (
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  ):
                </label>
                <DateTimePicker
                  id="eventDate"
                  name="date"
                  value={deadlineEventDate}
                  onChange={(change) =>
                    setDeadlineEventDate(change.utcValue || "")
                  }
                  required
                  className="max-w-80"
                />
              </div>
            </div>
          )}
        </div>
      )}

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
    </form>
  );
};

export default CreateEventForm;

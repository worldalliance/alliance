import {
  ActionEventDto,
  CreateActionReminderDto,
  ReminderCohortType,
  ReminderTimingMode,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import DateTimePicker from "@alliance/shared/ui/DateTimePicker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import TextareaWithHighlights from "./TextareaWithHighlights";

export interface ActionReminderFormUser {
  id: number;
  name?: string | null;
  email?: string | null;
  displayName?: string | null;
}

export type ActionReminderFormInitialValues = {
  memberActionEventId: number;
  reminder: CreateActionReminderDto;
  selectedUsers: ActionReminderFormUser[];
};

export type ActionReminderFormSubmitPayload = CreateActionReminderDto & {
  memberActionEventId: number;
};

interface ActionReminderFormProps {
  memberEvents: ActionEventDto[];
  users: ActionReminderFormUser[];
  loadingUsers: boolean;
  initialValues: ActionReminderFormInitialValues;
  submitting?: boolean;
  submitLabel?: string;
  serverError?: string | null;
  serverSuccess?: string | null;
  disableEventSelection?: boolean;
  onCancel?: () => void;
  onEventChange?: (eventId: number) => void;
  onSubmit: (payload: ActionReminderFormSubmitPayload) => Promise<void> | void;
}

const DEFAULT_SEND_AT_OFFSET_MS = 0;

const keywords = ["#{name}", "#{action}", "#{days}", "#{link}"];

const ActionReminderForm: React.FC<ActionReminderFormProps> = ({
  memberEvents,
  users,
  loadingUsers,
  initialValues,
  submitting = false,
  submitLabel = "Save Reminder",
  serverError = null,
  serverSuccess = null,
  disableEventSelection = false,
  onCancel,
  onEventChange,
  onSubmit,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    initialValues.memberActionEventId ?? null
  );
  const [timingMode, setTimingMode] = useState<ReminderTimingMode>(
    initialValues.reminder.timingMode
  );
  const [sendAt, setSendAt] = useState<string>(
    initialValues.reminder.sendAtAbsolute ??
      new Date(Date.now() + DEFAULT_SEND_AT_OFFSET_MS).toISOString()
  );
  const [sendAtSecondsFromDeadline, setSendAtSecondsFromDeadline] =
    useState<number>(initialValues.reminder.sendAtSecondsFromDeadline ?? 0);
  const [emailSubject, setEmailSubject] = useState<string>(
    initialValues.reminder.emailSubject
  );
  const [emailMessage, setEmailMessage] = useState<string>(
    initialValues.reminder.emailMessage
  );
  const [textMessage, setTextMessage] = useState<string>(
    initialValues.reminder.textMessage
  );
  const [cohortType, setCohortType] = useState<ReminderCohortType>(
    initialValues.reminder.cohortType
  );
  const [selectedUsers, setSelectedUsers] = useState<ActionReminderFormUser[]>(
    initialValues.selectedUsers
  );
  const [userQuery, setUserQuery] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const initialSnapshotRef = useRef<string>("");

  const computedInitialSnapshot = useMemo(() => {
    const userIds = [
      ...initialValues.selectedUsers.map((user) => user.id),
    ].sort((a, b) => a - b);
    return JSON.stringify({
      memberActionEventId: initialValues.memberActionEventId,
      reminder: {
        ...initialValues.reminder,
        userIds: initialValues.reminder.userIds ?? [],
      },
      selectedUsers: userIds,
    });
  }, [initialValues]);

  useEffect(() => {
    if (computedInitialSnapshot === initialSnapshotRef.current) {
      return;
    }
    initialSnapshotRef.current = computedInitialSnapshot;

    setSelectedEventId(initialValues.memberActionEventId);
    onEventChange?.(initialValues.memberActionEventId);
    setTimingMode(initialValues.reminder.timingMode);
    setSendAt(
      initialValues.reminder.sendAtAbsolute ??
        new Date(Date.now() + DEFAULT_SEND_AT_OFFSET_MS).toISOString()
    );
    setSendAtSecondsFromDeadline(
      initialValues.reminder.sendAtSecondsFromDeadline ?? 0
    );
    setEmailSubject(initialValues.reminder.emailSubject);
    setEmailMessage(initialValues.reminder.emailMessage);
    setTextMessage(initialValues.reminder.textMessage);
    setCohortType(initialValues.reminder.cohortType);
    setSelectedUsers(initialValues.selectedUsers);
    setUserQuery("");
    setLocalError(null);
  }, [
    computedInitialSnapshot,
    initialValues,
    memberEvents,
    onEventChange,
    disableEventSelection,
  ]);

  const filteredUsers = useMemo(() => {
    const term = userQuery.trim().toLowerCase();
    if (!term) {
      return [];
    }
    const selectedIds = new Set(selectedUsers.map((user) => user.id));
    return users
      .filter((user) => !selectedIds.has(user.id))
      .filter((user) => {
        const haystack = `${user.name ?? ""} ${user.displayName ?? ""} ${
          user.email ?? ""
        }`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [userQuery, users, selectedUsers]);

  const addUser = (user: ActionReminderFormUser) => {
    setSelectedUsers((prev) => {
      if (prev.some((existing) => existing.id === user.id)) {
        return prev;
      }
      return [...prev, user];
    });
    setUserQuery("");
  };

  const handleEventSelection = (value: string) => {
    const nextId = value ? Number(value) : null;
    if (nextId) {
      setSelectedEventId(nextId);
      onEventChange?.(nextId);
    }
  };

  const removeUser = (userId: number) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!selectedEventId) {
      setLocalError("Select a member action event first.");
      return;
    }

    if (cohortType === "custom" && selectedUsers.length === 0) {
      setLocalError("Select at least one user.");
      return;
    }

    if (timingMode === "absolute") {
      if (!sendAt) {
        setLocalError("Select a send time.");
        return;
      }
      const parsed = new Date(sendAt);
      if (Number.isNaN(parsed.getTime())) {
        setLocalError("Invalid send time.");
        return;
      }
    }

    if (timingMode === "from_deadline") {
      if (
        sendAtSecondsFromDeadline === null ||
        Number.isNaN(sendAtSecondsFromDeadline)
      ) {
        setLocalError("Enter the number of seconds relative to the deadline.");
        return;
      }
    }

    const baseReminder: CreateActionReminderDto = {
      ...initialValues.reminder,
      timingMode,
      emailSubject,
      emailMessage,
      textMessage,
      cohortType,
      sendAtAbsolute:
        timingMode === "absolute" ? new Date(sendAt).toISOString() : undefined,
      sendAtSecondsFromDeadline:
        timingMode === "from_deadline"
          ? sendAtSecondsFromDeadline ?? 0
          : undefined,
      userIds:
        cohortType === "custom"
          ? selectedUsers.map((user) => user.id)
          : undefined,
    };

    await onSubmit({
      memberActionEventId: selectedEventId,
      ...baseReminder,
    });
  };

  const combinedError = localError ?? serverError ?? null;

  const [keywordsHelpExpanded, setKeywordsHelpExpanded] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Member Action Event
        </label>
        <select
          value={selectedEventId ?? ""}
          onChange={(event) => handleEventSelection(event.target.value)}
          disabled={disableEventSelection}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="" disabled>
            Select an event
          </option>
          {memberEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title || `Event #${event.id}`} —{" "}
              {new Date(event.date).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timing mode
          </label>
          <select
            value={timingMode}
            onChange={(event) =>
              setTimingMode(event.target.value as ReminderTimingMode)
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="absolute">Absolute</option>
            <option value="from_deadline">Relative to deadline</option>
          </select>
        </div>

        {timingMode === "absolute" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send date
            </label>
            <DateTimePicker
              value={sendAt}
              onChange={(change) => setSendAt(change.utcValue || "")}
              className="w-full !py-1"
              required
            />
          </div>
        )}

        {timingMode === "from_deadline" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seconds from deadline
            </label>
            <input
              type="number"
              value={sendAtSecondsFromDeadline}
              onChange={(event) =>
                setSendAtSecondsFromDeadline(Number(event.target.value))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Subject
        </label>
        <TextareaWithHighlights
          keywords={keywords}
          value={emailSubject}
          onChange={setEmailSubject}
          rows={1}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Message
        </label>
        <TextareaWithHighlights
          keywords={keywords}
          value={emailMessage}
          onChange={setEmailMessage}
          rows={5}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Text Message
        </label>
        <TextareaWithHighlights
          keywords={keywords}
          value={textMessage}
          onChange={setTextMessage}
          rows={2}
        />
      </div>

      <div
        className={`p-2 border border-gray-200 rounded-md bg-zinc-100 ${
          !keywordsHelpExpanded ? "hover:border-gray-300" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setKeywordsHelpExpanded(!keywordsHelpExpanded)}
          className="text-sm"
        >
          Keyword replacement syntax{keywordsHelpExpanded ? " " : "..."}
        </button>
        {keywordsHelpExpanded && (
          <div className="mt-2 text-sm">
            <table id="keywordstable" style={{ width: "100%" }}>
              <tr>
                <th>Keyword</th>
                <th>Example Value</th>
                <th>Description</th>
              </tr>
              <tr>
                <td>{"#{name}"}</td>
                <td>John Doe</td>
                <td>Member&apos;s full name</td>
              </tr>
              <tr>
                <td>{"#{action}"}</td>
                <td>Sign a petition to use less cups</td>
                <td>The name of the action</td>
              </tr>
              <tr>
                <td>{"#{days}"}</td>
                <td>2 days</td>
                <td>
                  The number of days until the action is due, with
                  &apos;days&apos; attached
                </td>
              </tr>
              <tr>
                <td>{"#{link}"}</td>
                <td>https://www.worldalliance.org/actions/123?cid=123</td>
                <td>The link to the action, with tracking CID included</td>
              </tr>
            </table>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Recipients
        </label>
        <select
          value={cohortType}
          onChange={(event) =>
            setCohortType(event.target.value as ReminderCohortType)
          }
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="all_uncompleted">All uncompleted</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {cohortType === "custom" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipients
          </label>
          <input
            type="text"
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder={
              loadingUsers ? "Loading users…" : "Search by name or email"
            }
            disabled={loadingUsers}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
          />
          {userQuery && filteredUsers.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-md shadow-sm bg-white max-h-48 overflow-y-auto">
              {filteredUsers.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => addUser(user)}
                >
                  <span className="font-medium">
                    {user.name ?? user.displayName ?? `User #${user.id}`}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {user.email}
                  </span>
                </button>
              ))}
            </div>
          )}
          {userQuery && !filteredUsers.length && !loadingUsers && (
            <p className="mt-2 text-xs text-gray-500">
              No users match that search.
            </p>
          )}
          <div className="mt-3 space-y-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50"
              >
                <div>
                  <p className="font-medium">
                    {user.name ?? user.displayName ?? `User #${user.id}`}
                  </p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeUser(user.id)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove ✕
                </button>
              </div>
            ))}
            {selectedUsers.length === 0 && (
              <p className="text-xs text-gray-500">
                Selected users will appear here.
              </p>
            )}
          </div>
        </div>
      )}

      {combinedError && (
        <p className="text-red-600 text-sm" role="alert">
          {combinedError}
        </p>
      )}
      {serverSuccess && (
        <p className="text-green-600 text-sm">{serverSuccess}</p>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button
            type="button"
            color={ButtonColor.Light}
            className="px-4 py-2"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting || loadingUsers}
          color={ButtonColor.Black}
          className="px-4 py-2"
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default ActionReminderForm;

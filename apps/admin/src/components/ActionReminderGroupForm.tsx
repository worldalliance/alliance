import {
  actionsTentativePlansForGroup,
  type ActionEventDto,
  type CreateTodReminderGroupDto,
  type GroupDto,
  type NotificationPlan,
  type ReminderCohortType,
  type ReminderGroup,
  type ReminderGroupTimingMode,
  type User,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import DateTimePicker from "@alliance/shared/ui/DateTimePicker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import TextareaWithHighlights from "./TextareaWithHighlights";
import UserSelect, { UserSelectUser } from "./UserSelect";
import {
  defaultEmailContents,
  defaultEmailSubject,
  defaultTextMessage,
} from "./defaultReminderContents";

type ReminderGroupContentFields = Pick<
  ReminderGroup,
  | "name"
  | "cohortType"
  | "timingMode"
  | "emailSubject"
  | "emailMessage"
  | "textMessage"
>;

type ReminderGroupScheduleFields = Pick<
  ReminderGroup,
  | "sendAtAbsolute"
  | "sendAtSecondsFromDeadline"
  | "send_range_start"
  | "send_range_end"
>;

type ReminderGroupUserFields = Pick<
  CreateTodReminderGroupDto,
  "userIds" | "userGroupId"
>;

export type ActionReminderGroupFormSubmitPayload = ReminderGroupContentFields &
  ReminderGroupScheduleFields &
  ReminderGroupUserFields & {
    memberActionEventId: number;
  };

export type ActionReminderGroupFormInitialValues = {
  memberActionEventId: number;
  reminderGroup: ReminderGroup | null;
  users: User[];
};

export const keywords = [
  "#{fullname}",
  "#{firstname}",
  "#{lastname}",
  "#{action}",
  "#{days}",
  "#{hours}",
  "#{link}",
  "#{n}",
];

const TIMING_MODE_OPTIONS: Array<{
  value: ReminderGroupTimingMode;
  label: string;
}> = [
  { value: "within_range", label: "Personalized window" },
  { value: "absolute", label: "Absolute time" },
  { value: "from_deadline", label: "Relative to deadline" },
  { value: "event_launch", label: "Event launch" },
];

const COHORT_OPTIONS: Array<{ value: ReminderCohortType; label: string }> = [
  { value: "all_uncompleted", label: "All uncompleted" },
  { value: "group", label: "User group" },
  { value: "custom", label: "Custom recipients" },
];

interface ActionReminderFormProps {
  memberEvents: ActionEventDto[];
  users: UserSelectUser[];
  loadingUsers: boolean;
  userGroups: GroupDto[];
  loadingUserGroups: boolean;
  userGroupsError?: string | null;
  initialValues: ActionReminderGroupFormInitialValues;
  submitting?: boolean;
  submitLabel?: string;
  serverError?: string | null;
  serverSuccess?: string | null;
  disableEventSelection?: boolean;
  onCancel?: () => void;
  onEventChange?: (eventId: number) => void;
  onSubmit: (
    payload: ActionReminderGroupFormSubmitPayload
  ) => Promise<void> | void;
}

const ActionReminderGroupForm: React.FC<ActionReminderFormProps> = ({
  memberEvents,
  users,
  loadingUsers,
  userGroups,
  loadingUserGroups,
  userGroupsError = null,
  initialValues,
  submitting = false,
  submitLabel = "Create Reminders",
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
  const initialGroup = initialValues.reminderGroup;
  const initialTimingMode: ReminderGroupTimingMode =
    initialGroup?.timingMode ?? "within_range";
  const initialSendAtAbsolute =
    initialGroup?.sendAtAbsolute ?? new Date().toISOString();
  const initialSendAtSeconds = initialGroup?.sendAtSecondsFromDeadline ?? 0;
  const initialRangeStart =
    initialGroup?.send_range_start ?? new Date().toISOString();
  const initialRangeEnd =
    initialGroup?.send_range_end ??
    new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const [timingMode, setTimingMode] =
    useState<ReminderGroupTimingMode>(initialTimingMode);
  const [sendAtAbsolute, setSendAtAbsolute] = useState<string>(
    initialSendAtAbsolute
  );
  const [sendAtSecondsFromDeadline, setSendAtSecondsFromDeadline] =
    useState<number>(initialSendAtSeconds);
  const [sendRangeStart, setSendRangeStart] =
    useState<string>(initialRangeStart);
  const [sendRangeEnd, setSendRangeEnd] = useState<string>(initialRangeEnd);
  const [name, setName] = useState<string>(
    initialValues.reminderGroup?.name ?? ""
  );

  const [tentativePlans, setTentativePlans] = useState<NotificationPlan[]>([]);

  const [emailSubject, setEmailSubject] = useState<string>(
    initialValues.reminderGroup?.emailSubject ?? defaultEmailSubject
  );
  const [emailMessage, setEmailMessage] = useState<string>(
    initialValues.reminderGroup?.emailMessage ?? defaultEmailContents
  );
  const [textMessage, setTextMessage] = useState<string>(
    initialValues.reminderGroup?.textMessage ?? defaultTextMessage
  );
  const [cohortType, setCohortType] = useState<ReminderCohortType>(
    initialValues.reminderGroup?.cohortType ?? "all_uncompleted"
  );
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(
    initialValues.users.map((user) => user.id)
  );
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    initialValues.reminderGroup?.userGroup?.id ?? null
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const initialSnapshotRef = useRef<string>("");

  const computedInitialSnapshot = useMemo(() => {
    const userIds = [...initialValues.users.map((user) => user.id)].sort(
      (a, b) => a - b
    );
    const reminder = initialValues.reminderGroup;
    return JSON.stringify({
      memberActionEventId: initialValues.memberActionEventId,
      reminder: {
        ...reminder,
        userIds: userIds,
        userGroupId: initialValues.reminderGroup?.userGroup?.id ?? null,
        timingMode: reminder?.timingMode ?? null,
        sendAtAbsolute: reminder?.sendAtAbsolute ?? null,
        sendAtSecondsFromDeadline: reminder?.sendAtSecondsFromDeadline ?? null,
        sendRangeStart: reminder?.send_range_start ?? null,
        sendRangeEnd: reminder?.send_range_end ?? null,
      },
      selectedUsers: userIds,
    });
  }, [initialValues]);

  useEffect(() => {
    if (selectedEventId) {
      if (cohortType === "group" && !selectedGroupId) {
        setTentativePlans([]);
        return;
      }
      actionsTentativePlansForGroup({
        path: {
          eventId: selectedEventId,
        },
        body: {
          name,
          cohortType,
          emailSubject,
          emailMessage,
          textMessage,
          timingMode,
          userGroupId:
            cohortType === "group" ? selectedGroupId ?? undefined : undefined,
          userIds: cohortType === "custom" ? selectedUserIds : undefined,
          sendAtAbsolute:
            timingMode === "absolute" ? sendAtAbsolute : undefined,
          sendAtSecondsFromDeadline:
            timingMode === "from_deadline"
              ? sendAtSecondsFromDeadline ?? 0
              : undefined,
          send_range_start:
            timingMode === "within_range" ? sendRangeStart : undefined,
          send_range_end:
            timingMode === "within_range" ? sendRangeEnd : undefined,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setTentativePlans(response.data ?? []);
      });
    }
  }, [
    selectedEventId,
    name,
    cohortType,
    emailSubject,
    emailMessage,
    textMessage,
    timingMode,
    sendAtAbsolute,
    sendAtSecondsFromDeadline,
    sendRangeStart,
    sendRangeEnd,
    selectedGroupId,
    selectedUserIds,
  ]);

  useEffect(() => {
    if (computedInitialSnapshot === initialSnapshotRef.current) {
      return;
    }
    initialSnapshotRef.current = computedInitialSnapshot;

    setSelectedEventId(initialValues.memberActionEventId);
    onEventChange?.(initialValues.memberActionEventId);
    const nextGroup = initialValues.reminderGroup;
    setTimingMode(nextGroup?.timingMode ?? "within_range");
    setSendAtAbsolute(nextGroup?.sendAtAbsolute ?? new Date().toISOString());
    setSendAtSecondsFromDeadline(nextGroup?.sendAtSecondsFromDeadline ?? 0);
    setSendRangeStart(nextGroup?.send_range_start ?? new Date().toISOString());
    setSendRangeEnd(
      nextGroup?.send_range_end ??
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
    );
    setName(initialValues.reminderGroup?.name ?? "");
    setEmailSubject(
      initialValues.reminderGroup?.emailSubject ?? defaultEmailSubject
    );
    setEmailMessage(
      initialValues.reminderGroup?.emailMessage ?? defaultEmailContents
    );
    setTextMessage(
      initialValues.reminderGroup?.textMessage ?? defaultTextMessage
    );
    setCohortType(initialValues.reminderGroup?.cohortType ?? "all_uncompleted");
    setSelectedUserIds(initialValues.users.map((user) => user.id));
    setSelectedGroupId(initialValues.reminderGroup?.userGroup?.id ?? null);
    setLocalError(null);
  }, [
    computedInitialSnapshot,
    initialValues,
    memberEvents,
    onEventChange,
    disableEventSelection,
  ]);

  const handleEventSelection = (value: string) => {
    const nextId = value ? Number(value) : null;
    if (nextId) {
      setSelectedEventId(nextId);
      onEventChange?.(nextId);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!selectedEventId) {
      setLocalError("Select a member action event first.");
      return;
    }

    if (cohortType === "custom" && selectedUserIds.length === 0) {
      setLocalError("Select at least one user.");
      return;
    }

    if (cohortType === "group" && !selectedGroupId) {
      setLocalError("Select a user group.");
      return;
    }

    let normalizedSendAtAbsolute: string | undefined;
    let normalizedRangeStart: string | undefined;
    let normalizedRangeEnd: string | undefined;

    if (timingMode === "absolute") {
      if (!sendAtAbsolute) {
        setLocalError("Select a send time.");
        return;
      }
      const parsed = new Date(sendAtAbsolute);
      if (Number.isNaN(parsed.getTime())) {
        setLocalError("Invalid send time.");
        return;
      }
      normalizedSendAtAbsolute = parsed.toISOString();
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

    if (timingMode === "within_range") {
      if (!sendRangeStart || !sendRangeEnd) {
        setLocalError("Select both the start and end of the send range.");
        return;
      }
      const start = new Date(sendRangeStart);
      const end = new Date(sendRangeEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setLocalError("Invalid range selection.");
        return;
      }
      if (start.getTime() > end.getTime()) {
        setLocalError("Send range start must be before the end.");
        return;
      }
      normalizedRangeStart = start.toISOString();
      normalizedRangeEnd = end.toISOString();
    }

    const userIds = cohortType === "custom" ? selectedUserIds : undefined;

    const payload = {
      name,
      cohortType,
      emailSubject,
      emailMessage,
      textMessage,
      timingMode,
      memberActionEventId: selectedEventId,
      userIds,
      userGroupId:
        cohortType === "group" ? selectedGroupId ?? undefined : undefined,
      sendAtAbsolute:
        timingMode === "absolute" ? normalizedSendAtAbsolute : undefined,
      sendAtSecondsFromDeadline:
        timingMode === "from_deadline"
          ? sendAtSecondsFromDeadline ?? 0
          : undefined,
      send_range_start:
        timingMode === "within_range" ? normalizedRangeStart : undefined,
      send_range_end:
        timingMode === "within_range" ? normalizedRangeEnd : undefined,
    } satisfies ActionReminderGroupFormSubmitPayload;

    console.log(payload);

    await onSubmit(payload);
  };

  const combinedError = localError ?? serverError ?? null;

  const [keywordsHelpExpanded, setKeywordsHelpExpanded] = useState(false);

  const sortedPlans = tentativePlans.sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  );
  const firstTentativePlan = sortedPlans[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
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
            Reminder name
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="admin-only identifier"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timing mode
          </label>
          <select
            value={timingMode}
            onChange={(event) =>
              setTimingMode(event.target.value as ReminderGroupTimingMode)
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {TIMING_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {timingMode === "absolute" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Send at
          </label>
          <DateTimePicker
            value={sendAtAbsolute}
            onChange={(change) => setSendAtAbsolute(change.utcValue ?? "")}
            className="w-full !py-1"
            required
          />
        </div>
      )}

      {timingMode === "from_deadline" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seconds to deadline
          </label>
          <input
            type="number"
            value={
              Number.isFinite(sendAtSecondsFromDeadline)
                ? sendAtSecondsFromDeadline
                : ""
            }
            onChange={(event) => {
              const value = event.target.value;
              setSendAtSecondsFromDeadline(value === "" ? NaN : Number(value));
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      )}

      {timingMode === "within_range" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send range start
            </label>
            <DateTimePicker
              value={sendRangeStart}
              onChange={(change) => setSendRangeStart(change.utcValue ?? "")}
              className="w-full !py-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send range end
            </label>
            <DateTimePicker
              value={sendRangeEnd}
              onChange={(change) => setSendRangeEnd(change.utcValue ?? "")}
              className="w-full !py-1"
              required
            />
          </div>
        </div>
      )}

      {timingMode === "event_launch" && (
        <p className="text-sm text-gray-600">
          Reminders send when the member action event begins (i.e. announcement)
        </p>
      )}

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
          {COHORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {cohortType === "group" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User group
          </label>
          <select
            value={selectedGroupId ?? ""}
            onChange={(event) =>
              setSelectedGroupId(
                event.target.value ? Number(event.target.value) : null
              )
            }
            disabled={loadingUserGroups}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="" disabled>
              {loadingUserGroups ? "Loading groups…" : "Select a group"}
            </option>
            {userGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {!loadingUserGroups && userGroupsError && (
            <p className="mt-2 text-xs text-red-600">{userGroupsError}</p>
          )}
          {!loadingUserGroups &&
            !userGroupsError &&
            userGroups.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                No groups available. Create a group before scheduling.
              </p>
            )}
        </div>
      )}

      {cohortType === "custom" && (
        <UserSelect
          users={users}
          selectedUserIds={selectedUserIds}
          onChange={setSelectedUserIds}
          loading={loadingUsers}
        />
      )}

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
          className="text-sm w-full text-left"
        >
          Keyword replacement syntax{keywordsHelpExpanded ? " " : "..."}
        </button>
        {keywordsHelpExpanded && (
          <div className="mt-2 text-sm">
            <table id="keywordstable" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Example Value</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{"#{fullname}"}</td>
                  <td>John Fitzgerald Doe</td>
                  <td>Member&apos;s full name</td>
                </tr>
                <tr>
                  <td>{"#{firstname}"}</td>
                  <td>John</td>
                  <td>Member&apos;s first name</td>
                </tr>
                <tr>
                  <td>{"#{lastname}"}</td>
                  <td>Doe</td>
                  <td>Member&apos;s last name</td>
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
                  <td>{"#{n}"}</td>
                  <td>2</td>
                  <td>Total uncompleted tasks for this user</td>
                </tr>
                <tr>
                  <td>{"#{hours}"}</td>
                  <td>1 hour</td>
                  <td>
                    The number of hours until the action is due, with
                    &apos;hours&apos; attached. Note: assumes usage with days,
                    so will not show more than 24 hours. (ie an action due in 25
                    hours will show &quot;1 hour&quot;) to allow rendering
                    &quot;1 day 1 hour remaning&quot;
                  </td>
                </tr>
                <tr>
                  <td>{"#{link}"}</td>
                  <td>https://worldalliance.org/tasks?cid=123</td>
                  <td>
                    The link to the user&apos;s tasks page, with tracking CID
                    included
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {combinedError && (
        <p className="text-red-600 text-sm" role="alert">
          {combinedError}
        </p>
      )}
      {serverSuccess && (
        <p className="text-green-600 text-sm">{serverSuccess}</p>
      )}

      <div className="flex justify-end gap-3">
        {tentativePlans.length > 0 &&
          !(
            typeof window !== "undefined" &&
            window.location.href.includes("localhost")
          ) && (
            <p
              className={`px-4 py-2 rounded self-start ${
                tentativePlans.length > 0
                  ? "bg-yellow-600 text-white"
                  : "border border-gray-200"
              }`}
            >
              ⚠️ This will send <b>{tentativePlans.length}</b> reminders
              {firstTentativePlan && (
                <span>
                  , starting at{" "}
                  {new Date(firstTentativePlan.scheduledFor).toLocaleString()}
                </span>
              )}
            </p>
          )}
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

export default ActionReminderGroupForm;

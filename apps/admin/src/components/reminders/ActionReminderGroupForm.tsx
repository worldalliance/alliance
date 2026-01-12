import {
  actionsPreviewEmailHtml,
  actionsPreviewTextMessage,
  actionsTentativePlansForGroup,
  Tag,
  TagDto,
  type ActionEventDto,
  type CreateReminderGroupDto,
  type PreviewNotificationPlan,
  type ReminderCohortType,
  type ReminderGroup,
  type ReminderGroupTimingMode,
  type User,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import TextareaWithHighlights from "../TextareaWithHighlights";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import {
  defaultEmailContents,
  defaultEmailSubject,
  defaultPushMessage,
  defaultTextMessage,
} from "./defaultReminderContents";
import Card from "@alliance/sharedweb/ui/Card";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";

type ReminderGroupContentFields = Pick<
  ReminderGroup,
  | "name"
  | "cohortType"
  | "timingMode"
  | "emailSubject"
  | "emailMessage"
  | "textMessage"
  | "pushMessage"
  | "useSuiteTaskCount"
>;

type ReminderGroupScheduleFields = Pick<
  ReminderGroup,
  | "sendAtAbsolute"
  | "sendAtSecondsFromDeadline"
  | "send_range_start"
  | "send_range_end"
  | "relative_range_start_seconds_from_deadline"
  | "relative_range_end_seconds_from_deadline"
>;

type ReminderGroupUserFields = Pick<
  CreateReminderGroupDto,
  "userIds" | "userTagId"
>;

export type ActionReminderGroupFormSubmitPayload = ReminderGroupContentFields &
  ReminderGroupScheduleFields &
  ReminderGroupUserFields & {
    memberActionEventId: number;
  };

export type ActionReminderGroupFormInitialValues = {
  memberActionEventId: number;
  reminderGroup: (CreateReminderGroupDto & { userTag?: Tag }) | null;
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
  "#{s}",
  "#{timeremaining}",
  "#{tasktime}",
  "#{tasknames}",
];

const TIMING_MODE_OPTIONS: Array<{
  value: ReminderGroupTimingMode;
  label: string;
}> = [
  { value: "within_range", label: "Personalized window" },
  { value: "absolute", label: "Absolute time" },
  { value: "from_deadline", label: "Relative to deadline" },
  {
    value: "within_relative_range",
    label: "Relative personalized window",
  },
  { value: "event_launch", label: "Event launch" },
];

const COHORT_OPTIONS: Array<{ value: ReminderCohortType; label: string }> = [
  { value: "all_uncompleted", label: "All uncompleted" },
  { value: "tag", label: "User tag" },
  { value: "custom", label: "Custom recipients" },
];

interface ActionReminderFormProps {
  memberEvents: ActionEventDto[];
  users: UserSelectUser[];
  loadingUsers: boolean;
  userTags: TagDto[];
  loadingUserTags: boolean;
  userTagsError?: string | null;
  initialValues: ActionReminderGroupFormInitialValues;
  submitting?: boolean;
  submitLabel?: string;
  serverError?: string | null;
  serverSuccess?: string | null;
  disableEventSelection?: boolean;
  onCancel?: () => void;
  onEventChange?: (eventId: number) => void;
  onSubmit: (
    payload: ActionReminderGroupFormSubmitPayload,
    recipientCount: number
  ) => Promise<void> | void;
}

const ActionReminderGroupForm: React.FC<ActionReminderFormProps> = ({
  memberEvents,
  users,
  loadingUsers,
  userTags,
  loadingUserTags,
  userTagsError = null,
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
  const initialSendAtHours =
    initialGroup?.sendAtSecondsFromDeadline != null
      ? initialGroup.sendAtSecondsFromDeadline / 3600
      : 0;
  const initialRelativeRangeStartHours =
    initialGroup?.relative_range_start_seconds_from_deadline != null
      ? initialGroup.relative_range_start_seconds_from_deadline / 3600
      : 0;
  const initialRelativeRangeEndHours =
    initialGroup?.relative_range_end_seconds_from_deadline != null
      ? initialGroup.relative_range_end_seconds_from_deadline / 3600
      : 0;
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
  const [sendAtHoursFromDeadline, setSendAtHoursFromDeadline] =
    useState<number>(initialSendAtHours);
  const [relativeRangeStartHours, setRelativeRangeStartHours] =
    useState<number>(initialRelativeRangeStartHours);
  const [relativeRangeEndHours, setRelativeRangeEndHours] = useState<number>(
    initialRelativeRangeEndHours
  );
  const [sendRangeStart, setSendRangeStart] =
    useState<string>(initialRangeStart);
  const [sendRangeEnd, setSendRangeEnd] = useState<string>(initialRangeEnd);
  const [name, setName] = useState<string>(
    initialValues.reminderGroup?.name ?? ""
  );

  const [useSuiteTaskCount, setUseSuiteTaskCount] = useState<boolean>(
    initialValues.reminderGroup?.useSuiteTaskCount ?? true
  );

  useEffect(() => {
    if (timingMode === "within_relative_range") {
      if (relativeRangeStartHours < relativeRangeEndHours) {
        setLocalError("Window start must be before the window end.");
      }
    }
  }, [timingMode, relativeRangeStartHours, relativeRangeEndHours]);

  const [tentativePlans, setTentativePlans] = useState<
    PreviewNotificationPlan[]
  >([]);

  const [emailSubject, setEmailSubject] = useState<string>(
    initialValues.reminderGroup?.emailSubject ?? defaultEmailSubject
  );
  const [emailMessage, setEmailMessage] = useState<string>(
    initialValues.reminderGroup?.emailMessage ?? defaultEmailContents
  );
  const [textMessage, setTextMessage] = useState<string>(
    initialValues.reminderGroup?.textMessage ?? defaultTextMessage
  );
  const [pushMessage, setPushMessage] = useState<string>(
    initialValues.reminderGroup?.pushMessage ?? defaultPushMessage
  );
  const [cohortType, setCohortType] = useState<ReminderCohortType>(
    initialValues.reminderGroup?.cohortType ?? "all_uncompleted"
  );
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(
    initialValues.users.map((user) => user.id)
  );
  const [selectedTagId, setSelectedTagId] = useState<number | null>(
    initialValues.reminderGroup?.userTag?.id ?? null
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const initialSnapshotRef = useRef<string>("");

  const [previewingEmail1Task, setPreviewingEmail1Task] = useState(false);
  const [previewEmail1TaskHtml, setPreviewEmail1TaskHtml] = useState<
    string | null
  >(null);

  const [previewingEmail2Task, setPreviewingEmail2Task] = useState(false);
  const [previewEmail2TaskHtml, setPreviewEmail2TaskHtml] = useState<
    string | null
  >(null);

  const [previewingText1Task, setPreviewingText1Task] = useState(false);
  const [previewText1Task, setPreviewText1Task] = useState<string | null>(null);
  const [previewingText2Task, setPreviewingText2Task] = useState(false);
  const [previewText2Task, setPreviewText2Task] = useState<string | null>(null);

  const [previewingPushTask, setPreviewingPushTask] = useState(false);
  const [previewPushTask, setPreviewPushTask] = useState<string | null>(null);
  const [previewingPush2Task, setPreviewingPush2Task] = useState(false);
  const [previewPush2Task, setPreviewPush2Task] = useState<string | null>(null);

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
        userTagId: initialValues.reminderGroup?.userTag?.id ?? null,
        timingMode: reminder?.timingMode ?? null,
        sendAtAbsolute: reminder?.sendAtAbsolute ?? null,
        sendAtSecondsFromDeadline: reminder?.sendAtSecondsFromDeadline ?? null,
        sendRangeStart: reminder?.send_range_start ?? null,
        sendRangeEnd: reminder?.send_range_end ?? null,
        relativeRangeStartSecondsFromDeadline:
          reminder?.relative_range_start_seconds_from_deadline ?? null,
        relativeRangeEndSecondsFromDeadline:
          reminder?.relative_range_end_seconds_from_deadline ?? null,
      },
      selectedUsers: userIds,
    });
  }, [initialValues]);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }
    if (cohortType === "tag" && !selectedTagId) {
      setTentativePlans([]);
      return;
    }
    if (
      timingMode === "within_relative_range" &&
      (Number.isNaN(relativeRangeStartHours) ||
        Number.isNaN(relativeRangeEndHours) ||
        relativeRangeStartHours < relativeRangeEndHours)
    ) {
      setTentativePlans([]);
      return;
    }

    const sendAtSecondsFromDeadline = sendAtHoursFromDeadline * 3600;
    const relativeRangeStartSeconds = relativeRangeStartHours * 3600;
    const relativeRangeEndSeconds = relativeRangeEndHours * 3600;

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
        pushMessage,
        timingMode,
        useSuiteTaskCount,
        userTagId:
          cohortType === "tag" ? selectedTagId ?? undefined : undefined,
        userIds: cohortType === "custom" ? selectedUserIds : undefined,
        sendAtAbsolute: timingMode === "absolute" ? sendAtAbsolute : undefined,
        sendAtSecondsFromDeadline:
          timingMode === "from_deadline"
            ? sendAtSecondsFromDeadline ?? 0
            : undefined,
        send_range_start:
          timingMode === "within_range" ? sendRangeStart : undefined,
        send_range_end:
          timingMode === "within_range" ? sendRangeEnd : undefined,
        relative_range_start_seconds_from_deadline:
          timingMode === "within_relative_range"
            ? relativeRangeStartSeconds
            : undefined,
        relative_range_end_seconds_from_deadline:
          timingMode === "within_relative_range"
            ? relativeRangeEndSeconds
            : undefined,
      },
    }).then((response) => {
      if (response.error) {
        setLocalError((response.error as Error).message);
        setTentativePlans([]);
        return;
      }
      setLocalError(null);
      setTentativePlans(response.data ?? []);
    });
  }, [
    selectedEventId,
    name,
    cohortType,
    emailSubject,
    emailMessage,
    textMessage,
    pushMessage,
    timingMode,
    sendAtAbsolute,
    sendAtHoursFromDeadline,
    sendRangeStart,
    sendRangeEnd,
    selectedTagId,
    selectedUserIds,
    relativeRangeStartHours,
    relativeRangeEndHours,
    useSuiteTaskCount,
  ]);

  useEffect(() => {
    if (previewingEmail1Task) {
      actionsPreviewEmailHtml({
        path: {
          eventId: selectedEventId ?? 0,
        },
        body: {
          emailMessage,
          emailSubject,
          taskCount: 1,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setPreviewEmail1TaskHtml(response.data ?? "");
      });
    }
    if (previewingEmail2Task) {
      actionsPreviewEmailHtml({
        path: {
          eventId: selectedEventId ?? 0,
        },
        body: {
          emailMessage,
          emailSubject,
          taskCount: 2,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setPreviewEmail2TaskHtml(response.data ?? "");
      });
    }
  }, [
    previewingEmail1Task,
    previewingEmail2Task,
    emailMessage,
    emailSubject,
    selectedEventId,
  ]);

  useEffect(() => {
    if (previewingText1Task) {
      actionsPreviewTextMessage({
        path: {
          eventId: selectedEventId ?? 0,
        },
        body: {
          textMessage,
          taskCount: 1,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setPreviewText1Task(response.data?.text ?? "");
      });
    }
    if (previewingText2Task) {
      actionsPreviewTextMessage({
        path: {
          eventId: selectedEventId ?? 0,
        },
        body: {
          textMessage,
          taskCount: 2,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setPreviewText2Task(response.data?.text ?? "");
      });
    }
  }, [previewingText1Task, previewingText2Task, textMessage, selectedEventId]);

  useEffect(() => {
    if (previewingPushTask) {
      actionsPreviewTextMessage({
        path: {
          eventId: selectedEventId ?? 0,
        },
        body: {
          textMessage: pushMessage,
          taskCount: 1,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setPreviewPushTask(response.data?.text ?? "");
      });
    }
    if (previewingPush2Task) {
      actionsPreviewTextMessage({
        path: {
          eventId: selectedEventId ?? 0,
        },
        body: {
          textMessage: pushMessage,
          taskCount: 2,
        },
      }).then((response) => {
        if (response.error) {
          setLocalError((response.error as Error).message);
          return;
        }
        setPreviewPush2Task(response.data?.text ?? "");
      });
    }
  }, [previewingPushTask, previewingPush2Task, pushMessage, selectedEventId]);

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
    setSendAtHoursFromDeadline(
      nextGroup?.sendAtSecondsFromDeadline != null
        ? nextGroup.sendAtSecondsFromDeadline / 3600
        : 0
    );
    setSendRangeStart(nextGroup?.send_range_start ?? new Date().toISOString());
    setSendRangeEnd(
      nextGroup?.send_range_end ??
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
    );
    setRelativeRangeStartHours(
      nextGroup?.relative_range_start_seconds_from_deadline != null
        ? nextGroup.relative_range_start_seconds_from_deadline / 3600
        : 0
    );
    setRelativeRangeEndHours(
      nextGroup?.relative_range_end_seconds_from_deadline != null
        ? nextGroup.relative_range_end_seconds_from_deadline / 3600
        : 0
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
    setSelectedTagId(initialValues.reminderGroup?.userTag?.id ?? null);
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

  const anchor = useRef<HTMLButtonElement>(null);

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

    if (cohortType === "tag" && !selectedTagId) {
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
        sendAtHoursFromDeadline === null ||
        Number.isNaN(sendAtHoursFromDeadline)
      ) {
        setLocalError("Enter the number of hours relative to the deadline.");
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

    if (timingMode === "within_relative_range") {
      if (
        Number.isNaN(relativeRangeStartHours) ||
        Number.isNaN(relativeRangeEndHours)
      ) {
        setLocalError(
          "Enter both the start and end hours before the deadline."
        );
        return;
      }
      if (relativeRangeStartHours < relativeRangeEndHours) {
        setLocalError(
          "Window start must be greater than or equal to the window end."
        );
        return;
      }
    }

    const userIds = cohortType === "custom" ? selectedUserIds : undefined;

    const sendAtSecondsFromDeadline = sendAtHoursFromDeadline * 3600;
    const relativeRangeStartSeconds = relativeRangeStartHours * 3600;
    const relativeRangeEndSeconds = relativeRangeEndHours * 3600;
    const payload = {
      name,
      cohortType,
      emailSubject,
      emailMessage,
      textMessage,
      pushMessage,
      timingMode,
      memberActionEventId: selectedEventId,
      userIds,
      userTagId: cohortType === "tag" ? selectedTagId ?? undefined : undefined,
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
      relative_range_start_seconds_from_deadline:
        timingMode === "within_relative_range"
          ? relativeRangeStartSeconds
          : undefined,
      relative_range_end_seconds_from_deadline:
        timingMode === "within_relative_range"
          ? relativeRangeEndSeconds
          : undefined,
      useSuiteTaskCount,
    } satisfies ActionReminderGroupFormSubmitPayload;

    console.log(payload);

    await onSubmit(payload, tentativePlans.length);
  };

  const combinedError = localError ?? serverError ?? null;

  const [keywordsHelpExpanded, setKeywordsHelpExpanded] = useState(false);

  const sortedPlans = tentativePlans.sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  );
  const firstTentativePlan = sortedPlans[0];

  const isProd = !(
    typeof window !== "undefined" && window.location.href.includes("localhost")
  );

  const handlePreviewEmail2Task = async () => {
    setPreviewingEmail2Task(!previewingEmail2Task);
    setPreviewingEmail1Task(false);
  };

  const handlePreviewEmail1Task = async () => {
    setPreviewingEmail1Task(!previewingEmail1Task);
    setPreviewingEmail2Task(false);
  };

  const handlePreviewText1Task = async () => {
    setPreviewingText1Task(!previewingText1Task);
    setPreviewingText2Task(false);
  };

  const handlePreviewText2Task = async () => {
    setPreviewingText2Task(!previewingText2Task);
    setPreviewingText1Task(false);
  };

  const handlePreviewPushTask = async () => {
    setPreviewingPushTask(!previewingPushTask);
    setPreviewingPush2Task(false);
  };

  const handlePreviewPush2Task = async () => {
    setPreviewingPush2Task(!previewingPush2Task);
    setPreviewingPushTask(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {combinedError && (
        <p className="text-red-600 text-sm" role="alert">
          {combinedError}
        </p>
      )}
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
            hours to deadline
          </label>
          <input
            type="number"
            value={sendAtHoursFromDeadline}
            onChange={(event) => {
              const value = event.target.value;
              setSendAtHoursFromDeadline(value === "" ? NaN : Number(value));
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

      {timingMode === "within_relative_range" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window starts (hours before deadline)
            </label>
            <input
              type="number"
              value={relativeRangeStartHours}
              min={0}
              onChange={(event) => {
                const value = event.target.value;
                setRelativeRangeStartHours(value === "" ? NaN : Number(value));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window ends (hours before deadline)
            </label>
            <input
              type="number"
              value={relativeRangeEndHours}
              min={0}
              onChange={(event) => {
                const value = event.target.value;
                setRelativeRangeEndHours(value === "" ? NaN : Number(value));
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
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

      {cohortType === "tag" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            User tag
          </label>
          <select
            value={selectedTagId ?? ""}
            onChange={(event) =>
              setSelectedTagId(
                event.target.value ? Number(event.target.value) : null
              )
            }
            disabled={loadingUserTags}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="" disabled>
              {loadingUserTags ? "Loading tags…" : "Select a tag"}
            </option>
            {userTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          {!loadingUserTags && userTagsError && (
            <p className="mt-2 text-xs text-red-600">{userTagsError}</p>
          )}
          {!loadingUserTags && !userTagsError && userTags.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              No tags available. Create a tag before scheduling.
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
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Message
          </label>
          <Button
            onClick={handlePreviewEmail1Task}
            size={"small"}
            color={previewingEmail1Task ? ButtonColor.Stone : ButtonColor.Light}
            className="!px-2 !py-1"
          >
            Preview Email (1 task)
          </Button>
          <Button
            onClick={handlePreviewEmail2Task}
            size={"small"}
            color={previewingEmail2Task ? ButtonColor.Stone : ButtonColor.Light}
            className="!px-2 !py-1"
          >
            Preview Email (2 tasks)
          </Button>
        </div>
        {previewingEmail1Task ? (
          <Card className="p-4">
            <div
              dangerouslySetInnerHTML={{ __html: previewEmail1TaskHtml ?? "" }}
            />
          </Card>
        ) : previewingEmail2Task ? (
          <Card className="p-4">
            <div
              dangerouslySetInnerHTML={{ __html: previewEmail2TaskHtml ?? "" }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={emailMessage}
            onChange={setEmailMessage}
            rows={5}
          />
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Text Message
          </label>
          <Button
            onClick={handlePreviewText1Task}
            size={"small"}
            color={previewingText1Task ? ButtonColor.Stone : ButtonColor.Light}
            className="!px-2 !py-1"
          >
            Preview Text (1 task)
          </Button>
          <Button
            onClick={handlePreviewText2Task}
            size={"small"}
            color={previewingText2Task ? ButtonColor.Stone : ButtonColor.Light}
            className="!px-2 !py-1"
          >
            Preview Text (2 tasks)
          </Button>
        </div>
        {previewingText1Task ? (
          <Card className="p-4">
            <p
              dangerouslySetInnerHTML={{
                __html: previewText1Task?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : previewingText2Task ? (
          <Card className="p-4">
            <p
              dangerouslySetInnerHTML={{
                __html: previewText2Task?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={textMessage}
            onChange={setTextMessage}
            rows={2}
          />
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Push Message
          </label>
          <Button
            onClick={handlePreviewPushTask}
            size={"small"}
            color={previewingPushTask ? ButtonColor.Stone : ButtonColor.Light}
            className="!px-2 !py-1"
          >
            Preview Push (1 task)
          </Button>
          <Button
            onClick={handlePreviewPush2Task}
            size={"small"}
            color={previewingPush2Task ? ButtonColor.Stone : ButtonColor.Light}
            className="!px-2 !py-1"
          >
            Preview Push (2 tasks)
          </Button>
        </div>
        {previewingPushTask ? (
          <Card className="p-4">
            <p
              dangerouslySetInnerHTML={{
                __html: previewPushTask?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : previewingPush2Task ? (
          <Card className="p-4">
            <p
              dangerouslySetInnerHTML={{
                __html: previewPush2Task?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={pushMessage}
            onChange={setPushMessage}
            rows={2}
          />
        )}
      </div>
      <div>
        <LargeCheckbox
          label="Use suite task count"
          checked={useSuiteTaskCount}
          onChange={(checked) => setUseSuiteTaskCount(checked)}
        />
      </div>

      <div
        className={`border border-gray-200 rounded-md bg-zinc-100 ${
          !keywordsHelpExpanded ? "hover:border-gray-300" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setKeywordsHelpExpanded(!keywordsHelpExpanded)}
          className="text-sm w-full text-left p-3"
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
                    &quot;1 day 1 hour remaining&quot;
                  </td>
                </tr>
                <tr>
                  <td>{"#{timeremaining}"}</td>
                  <td>2 days, 3 hours</td>
                  <td>
                    The number of days and hours until the action is due. In
                    most cases equivalent to {`#{days}, #{hours}`}, but will
                    trim &quot;0 days&quot; or &quot;0 hours&quot; from the
                    message. (days is floored, hours is rounded)
                  </td>
                </tr>
                <tr>
                  <td>{"#{tasktime}"}</td>
                  <td>15 minutes</td>
                  <td>
                    The total estimated minutes it will take for the user to
                    finish all uncompleted tasks.
                  </td>
                </tr>
                <tr>
                  <td>{"#{tasknames}"}</td>
                  <td>Task 1, Task 2, Task 3</td>
                  <td>
                    The names of the uncompleted actions for this user,
                    separated by commas. Based on the &quot;use suite task
                    count&quot; flag, will either include all actions, or only
                    actions in this suite.
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
                <tr>
                  <td>{"#{s}"}</td>
                  <td>s</td>
                  <td>
                    Conditionally inserts an s if {`#{n}`} is a value other than
                    1, or an empty string if {`#{n}`} is 1
                  </td>
                </tr>
                <tr>
                  <td>{"#{str1|str2}"}</td>
                  <td>str1</td>
                  <td>
                    Inserts the string before the bar if {`#{n}`} is 1,
                    otherwise inserts the string after the bar
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-zinc-600 m-3">
              If you are using the suite task count, all task count related
              values will be based on the number of uncompleted tasks only in
              this action suite. If the reminder group is not associated with an
              action suite, the flag has no effect (global count will always be
              used).
            </p>
          </div>
        )}
      </div>

      {serverSuccess && (
        <p className="text-green-600 text-sm">{serverSuccess}</p>
      )}

      <div className="flex justify-end gap-3">
        {tentativePlans.length > 0 && (
          <p
            className={`px-4 py-2 rounded self-start ${
              tentativePlans.length > 0 && isProd
                ? "bg-yellow-600 text-white"
                : "border border-gray-200"
            }`}
          >
            {isProd && "⚠️"} This will send <b>{tentativePlans.length}</b>{" "}
            reminders
            {firstTentativePlan && (
              <span>
                , starting at{" "}
                {new Date(firstTentativePlan.scheduledFor).toLocaleString()}
              </span>
            )}
            {firstTentativePlan &&
              Date.now() >
                new Date(firstTentativePlan.scheduledFor).getTime() && (
                <span className="text-red-500"> (immediately)</span>
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
          ref={anchor}
          className="px-4 py-2"
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default ActionReminderGroupForm;

import {
  ActionDto,
  userList,
  User,
  AdminActionEventDto,
  actionsEventWithReminders,
  ActionReminder,
  actionsCreateReminder,
  ReminderTimingMode,
  ReminderCohortType,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import DateTimePicker from "@alliance/shared/ui/DateTimePicker";
import React, { useEffect, useMemo, useState } from "react";
import {
  format,
  formatDistanceStrict,
  isValid,
  parseISO,
  subSeconds,
} from "date-fns";

interface ActionRemindersTabProps {
  action: ActionDto;
  setAction: React.Dispatch<React.SetStateAction<ActionDto | null>>;
}

const DISPLAY_DATETIME_FORMAT = "PP p";
const INPUT_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";
const notificationChannelLabels: Record<string, string> = {
  email: "Email",
  text: "Text",
  push: "Push",
};

const formatDateTimeLocal = (date: Date) => format(date, INPUT_DATETIME_FORMAT);

const ActionRemindersTab: React.FC<ActionRemindersTabProps> = ({
  action,
  setAction,
}) => {
  const memberEvents = useMemo(
    () =>
      (action.events || []).filter(
        (event) => event.newStatus === "member_action"
      ),
    [action.events]
  );
  const sortedActionEvents = useMemo(() => {
    return (action.events || [])
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [action.events]);
  const nextEventById = useMemo(() => {
    const map = new Map<number, (typeof sortedActionEvents)[number]>();
    sortedActionEvents.forEach((event, index) => {
      const next = sortedActionEvents[index + 1];
      if (next) {
        map.set(event.id, next);
      }
    });
    return map;
  }, [sortedActionEvents]);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    memberEvents[0]?.id ?? null
  );
  const [sendAt, setSendAt] = useState<string>(
    formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [timingMode, setTimingMode] = useState<ReminderTimingMode>("absolute");
  const [sendAtSecondsFromDeadline, setSendAtSecondsFromDeadline] =
    useState<number>(0);
  const [emailMessage, setEmailMessage] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [includeActionLinkInMessages, setIncludeActionLinkInMessages] =
    useState<boolean>(false);
  const [textMessage, setTextMessage] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [userQuery, setUserQuery] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [cohortType, setCohortType] =
    useState<ReminderCohortType>("all_uncompleted");
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [eventWithReminders, setEventWithReminders] = useState<
    AdminActionEventDto | undefined
  >(undefined);

  useEffect(() => {
    if (memberEvents.length && selectedEventId == null) {
      setSelectedEventId(memberEvents[0].id);
    }
  }, [memberEvents, selectedEventId]);

  useEffect(() => {
    setLoadingUsers(true);
    userList()
      .then((response) => {
        setUsers(response.data ?? []);
      })
      .catch(() => {
        setError("Failed to load users");
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      actionsEventWithReminders({ path: { id: selectedEventId } }).then(
        (response) => {
          setEventWithReminders(response.data);
        }
      );
    }
  }, [selectedEventId]);

  const reminders = useMemo(() => {
    if (!eventWithReminders) {
      return [];
    }
    return eventWithReminders.reminders
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [eventWithReminders]);

  const parseDate = (value?: string | Date | null) => {
    if (!value) {
      return null;
    }
    const date = typeof value === "string" ? parseISO(value) : value;
    return isValid(date) ? date : null;
  };

  const formatDisplayDate = (value?: string | Date | null) => {
    const date = parseDate(value);
    return date ? format(date, DISPLAY_DATETIME_FORMAT) : null;
  };

  const getMemberEventId = (reminder: ActionReminder) => {
    const relatedEventId = reminder.memberActionEvent?.id;
    if (typeof relatedEventId === "number") {
      return relatedEventId;
    }
    const dtoMemberId = (
      reminder as unknown as { memberActionEventId?: number }
    ).memberActionEventId;
    if (typeof dtoMemberId === "number") {
      return dtoMemberId;
    }
    return eventWithReminders?.id;
  };

  const findDeadlineEvent = (reminder: ActionReminder) => {
    if (reminder.deadlineEventId) {
      const match = sortedActionEvents.find(
        (event) => event.id === reminder.deadlineEventId
      );
      if (match) {
        return match;
      }
    }
    const memberEventId = getMemberEventId(reminder);
    if (!memberEventId) {
      return undefined;
    }
    return nextEventById.get(memberEventId);
  };

  const resolveSchedule = (reminder: ActionReminder) => {
    if (reminder.timingMode === "absolute") {
      const sendDate = parseDate(reminder.sendAtAbsolute);
      if (sendDate) {
        return {
          primary: `Sends ${format(sendDate, DISPLAY_DATETIME_FORMAT)}`,
          secondary: "Absolute schedule",
          sendDate,
          deadlineDate: null as Date | null,
          referenceTitle: null as string | null,
        };
      }
      return {
        primary: "Sends at scheduled time",
        secondary: "Unable to determine send date",
        sendDate: null,
        deadlineDate: null,
        referenceTitle: null,
      };
    }

    if (reminder.timingMode === "from_deadline") {
      const deadlineEvent = findDeadlineEvent(reminder);
      const deadlineDate = parseDate(deadlineEvent?.date);
      const seconds = reminder.sendAtSecondsFromDeadline ?? 0;
      if (deadlineDate) {
        const sendDate = subSeconds(deadlineDate, seconds);
        const isBefore = seconds >= 0;
        const referenceTitle =
          deadlineEvent?.title?.trim() ||
          `deadline on ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`;
        if (seconds === 0) {
          return {
            primary: `Sends when ${referenceTitle} begins`,
            secondary: `${format(
              sendDate,
              DISPLAY_DATETIME_FORMAT
            )} • Deadline ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`,
            sendDate,
            deadlineDate,
            referenceTitle,
          };
        }
        const distance = formatDistanceStrict(deadlineDate, sendDate, {
          roundingMethod: "floor",
        });
        return {
          primary: `Sends ${distance} ${
            isBefore ? "before" : "after"
          } ${referenceTitle}`,
          secondary: `${format(
            sendDate,
            DISPLAY_DATETIME_FORMAT
          )} • Deadline ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`,
          sendDate,
          deadlineDate,
          referenceTitle,
        };
      }
      return {
        primary: "Relative schedule",
        secondary: "Waiting for deadline details",
        sendDate: null,
        deadlineDate: null,
        referenceTitle: deadlineEvent?.title ?? null,
      };
    }

    return {
      primary: "Scheduled reminder",
      secondary: "",
      sendDate: null,
      deadlineDate: null,
      referenceTitle: null,
    };
  };

  const getNotificationChannels = (reminder: ActionReminder) => {
    const channels = new Set<string>();
    (reminder.notifications ?? []).forEach((notification) => {
      const channel = (notification as { channel?: string })?.channel;
      if (channel) {
        channels.add(channel);
      }
    });
    return Array.from(channels);
  };

  const formatRecipientName = (user: unknown) => {
    if (!user || typeof user !== "object") {
      return null;
    }
    const record = user as Record<string, unknown>;
    const displayName = record.displayName;
    if (typeof displayName === "string" && displayName.trim()) {
      return displayName.trim();
    }
    const name = record.name;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
    const id = record.id;
    if (typeof id === "number") {
      return `User #${id}`;
    }
    return null;
  };

  const filteredUsers = useMemo(() => {
    const term = userQuery.trim().toLowerCase();
    if (!term) {
      return [];
    }
    return users
      .filter(
        (user) => !selectedUsers.some((selected) => selected.id === user.id)
      )
      .filter((user) => {
        const haystack = `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [userQuery, users, selectedUsers]);

  const addUser = (user: User) => {
    if (selectedUsers.some((existing) => existing.id === user.id)) {
      setUserQuery("");
      return;
    }
    setSelectedUsers((prev) => [...prev, user]);
    setUserQuery("");
  };

  const removeUser = (userId: number) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  const resetForm = () => {
    setSendAt(formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
    setEmailMessage("");
    setTextMessage("");
    setSelectedUsers([]);
    setUserQuery("");
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedEventId) {
      setError("Select a member action event first.");
      return;
    }
    if (cohortType === "custom" && !selectedUsers.length) {
      setError("Select at least one user.");
      return;
    }

    const parsedSendAt = new Date(sendAt);
    if (isNaN(parsedSendAt.getTime())) {
      setError("Invalid send time.");
      return;
    }

    setSubmitting(true);
    const response = await actionsCreateReminder({
      path: { actionId: action.id, eventId: selectedEventId },
      body: {
        sendAtAbsolute: parsedSendAt.toISOString(),
        sendAtSecondsFromDeadline,
        emailMessage,
        textMessage,
        userIds: selectedUsers.map((user) => user.id),
        includeActionLinkInMessages,
        cohortType: "all_uncompleted",
        timingMode: timingMode,
        emailSubject,
      },
    });
    setSubmitting(false);

    if (!response.data) {
      setError((response.error as string) ?? "Failed to create reminder.");
      return;
    }

    const created = response.data;
    setAction((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        events: prev.events.map((event) => {
          if (event.id !== created.memberActionEventId) {
            return event;
          }
          const existingReminders = eventWithReminders?.reminders ?? [];
          return {
            ...event,
            customReminders: [...existingReminders, created],
          };
        }),
      };
    });
    setEventWithReminders((prev) => {
      if (!prev) {
        return undefined;
      }
      return {
        ...prev,
        customReminders: [
          ...(prev.reminders ?? []),
          created as unknown as ActionReminder,
        ],
      };
    });

    resetForm();
    setSuccess("Reminder scheduled successfully.");
  };

  if (!memberEvents.length) {
    return (
      <Card style={CardStyle.White}>
        <p className="text-sm text-gray-600">
          This action does not have a member action event yet. Add a member
          action event on the Events tab to schedule reminders.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-5">
      <Card style={CardStyle.White}>
        <form onSubmit={handleCreateReminder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Member Action Event
            </label>
            <select
              value={selectedEventId ?? ""}
              onChange={(event) =>
                setSelectedEventId(Number(event.target.value))
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
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
            <textarea
              value={emailSubject}
              onChange={(event) => setEmailSubject(event.target.value)}
              rows={1}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Message
            </label>
            <textarea
              value={emailMessage}
              onChange={(event) => setEmailMessage(event.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text Message
            </label>
            <textarea
              value={textMessage}
              onChange={(event) => setTextMessage(event.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-3">
              Message keywords (for subject, text, email):{" "}
              {"#{name},  #{action},  #{days}"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Include Action Link in Messages
            </label>
            <input
              type="checkbox"
              checked={includeActionLinkInMessages}
              onChange={(event) =>
                setIncludeActionLinkInMessages(event.target.checked)
              }
            />
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
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
                      <span className="font-medium">{user.name}</span>
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
                      <p className="font-medium">{user.name}</p>
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
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting || loadingUsers}
              color={ButtonColor.Black}
              className="px-4 py-2"
            >
              {submitting ? "Scheduling…" : "Schedule Reminder"}
            </Button>
          </div>
        </form>
      </Card>

      <Card style={CardStyle.White}>
        <h3 className="text-base font-semibold mb-3">Scheduled Reminders</h3>
        {reminders.length === 0 ? (
          <p className="text-sm text-gray-600">
            No custom reminders scheduled for this event yet.
          </p>
        ) : (
          <div className="space-y-4">
            {reminders.map((reminder) => {
              const schedule = resolveSchedule(reminder);
              const sentAtLabel = formatDisplayDate(reminder.sentAt);
              const createdAtLabel = formatDisplayDate(reminder.createdAt);
              const sendDateLabel =
                !sentAtLabel && schedule.sendDate
                  ? format(schedule.sendDate, DISPLAY_DATETIME_FORMAT)
                  : null;
              const channels = getNotificationChannels(reminder);
              const channelText =
                channels.length > 0
                  ? channels
                      .map(
                        (channel) =>
                          notificationChannelLabels[channel] ?? channel
                      )
                      .join(", ")
                  : null;
              const isCustomCohort = reminder.cohortType === "custom";
              const recipientNames = (reminder.users ?? [])
                .map(formatRecipientName)
                .filter((value): value is string => Boolean(value));
              const primaryRecipients = recipientNames.slice(0, 3);
              const remainingRecipients =
                recipientNames.length - primaryRecipients.length;
              const cohortSummary = isCustomCohort
                ? `${recipientNames.length} recipient${
                    recipientNames.length === 1 ? "" : "s"
                  }`
                : "All members who have not completed the action";
              const emailSubject = reminder.emailSubject?.trim();
              const emailMessage = reminder.emailMessage?.trim();
              const textMessage = reminder.textMessage?.trim();

              return (
                <div
                  key={reminder.id}
                  className="border border-gray-200 rounded-md p-4 text-sm space-y-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Schedule
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {schedule.primary}
                      </p>
                      {schedule.secondary && (
                        <p className="text-xs text-gray-500">
                          {schedule.secondary}
                        </p>
                      )}
                      {reminder.timingMode === "from_deadline" &&
                        schedule.referenceTitle && (
                          <p className="text-xs text-gray-500">
                            Deadline event: {schedule.referenceTitle}
                          </p>
                        )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Status
                      </p>
                      <p className="text-sm text-gray-900">
                        {sentAtLabel
                          ? `Sent ${sentAtLabel}`
                          : sendDateLabel
                          ? `Scheduled for ${sendDateLabel}`
                          : "Pending"}
                      </p>
                      {createdAtLabel && (
                        <p className="text-xs text-gray-500">
                          Created {createdAtLabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Recipients
                      </p>
                      <p className="text-sm text-gray-900">{cohortSummary}</p>
                      {isCustomCohort && primaryRecipients.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {primaryRecipients.join(", ")}
                          {remainingRecipients > 0
                            ? ` +${remainingRecipients} more`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Email Content
                        </p>
                        {emailSubject && (
                          <p className="text-sm font-medium text-gray-900">
                            {emailSubject}
                          </p>
                        )}
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {emailMessage || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Text Content
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">
                          {textMessage || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>
                      Mode:{" "}
                      {reminder.timingMode === "absolute"
                        ? "Absolute time"
                        : "Relative to deadline"}
                    </span>
                    <span>
                      Cohort:{" "}
                      {reminder.cohortType === "custom"
                        ? "Custom recipients"
                        : "All uncompleted"}
                    </span>
                    {channelText && <span>Channels: {channelText}</span>}
                    <span>
                      Include action link:{" "}
                      {reminder.includeActionLinkInMessages ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ActionRemindersTab;

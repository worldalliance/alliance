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

interface ActionRemindersTabProps {
  action: ActionDto;
  setAction: React.Dispatch<React.SetStateAction<ActionDto | null>>;
}

const formatDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

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

  const reminders = eventWithReminders
    ? eventWithReminders.reminders.slice()
    : [];

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
    if (!selectedUsers.length) {
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
          <div className="space-y-3">
            {reminders
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              )
              .map((reminder) => (
                <div
                  key={reminder.id}
                  className="border border-gray-200 rounded-md p-3 text-sm"
                >
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      {reminder.sendAtAbsolute && (
                        <p className="font-medium">
                          Sends{" "}
                          {new Date(reminder.sendAtAbsolute).toLocaleString()}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {reminder.sentAt
                          ? `Sent ${new Date(reminder.sentAt).toLocaleString()}`
                          : "Pending"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {reminder.users?.length ?? 0} recipients
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      Email Message
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {reminder.emailMessage}
                    </p>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      Text Message
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {reminder.textMessage}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ActionRemindersTab;

import {
  ActionDto,
  userList,
  AdminActionEventDto,
  actionsEventWithReminders,
  ActionReminder,
  actionsCreateReminder,
  CreateActionReminderDto,
  ActionReminderDto,
  actionsDeleteReminder,
} from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  formatDistanceStrict,
  isValid,
  parseISO,
  subSeconds,
} from "date-fns";
import ActionReminderForm, {
  ActionReminderFormInitialValues,
  ActionReminderFormSubmitPayload,
  ActionReminderFormUser,
} from "./ActionReminderForm";
import ClockIcon from "@alliance/shared/ui/icons/ClockIcon";

export const defaultEmailSubject =
  "You have #{days} left to complete #{action}";
export const defaultEmailContents = `Hi,
An action needs your completion: "#{action}"

You have #{days} left to complete it. Please do so at the below link.
#{link}
`;

export const defaultTextMessage =
  "You have #{days} left to complete #{action}. #{link}";

interface ActionRemindersTabProps {
  action: ActionDto;
  setAction: React.Dispatch<React.SetStateAction<ActionDto | null>>;
}

const DISPLAY_DATETIME_FORMAT = "PP p";
const notificationChannelLabels: Record<string, string> = {
  email: "Email",
  text: "Text",
  push: "Push",
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

  const [selectedEventId, setSelectedEventId] = useState<number>(
    memberEvents[0].id
  );
  const [users, setUsers] = useState<ActionReminderFormUser[]>([]);
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  );
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [eventWithReminders, setEventWithReminders] = useState<
    AdminActionEventDto | undefined
  >(undefined);
  const [createExpanded, setCreateExpanded] = useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(
    null
  );
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [deleteConfirmation, setDeleteConfirmation] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (memberEvents.length && selectedEventId == null) {
      setSelectedEventId(memberEvents[0].id);
    }
  }, [memberEvents, selectedEventId]);

  useEffect(() => {
    setLoadingUsers(true);
    userList()
      .then((response) => {
        const mappedUsers = (response.data ?? []).map<ActionReminderFormUser>(
          (user) => ({
            id: user.id,
            name: user.name ?? undefined,
            email: user.email ?? undefined,
            displayName: user.name ?? undefined,
          })
        );
        setUsers(mappedUsers);
      })
      .catch((err) => {
        console.error(err);
        setCreateError("Failed to load users.");
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  const refreshEventReminders = useCallback(
    async (eventId: number) => {
      const response = await actionsEventWithReminders({
        path: { id: eventId },
      });

      if (response.error) {
        throw new Error(
          typeof response.error === "string"
            ? response.error
            : "Failed to load reminders."
        );
      }

      if (!response.data) {
        throw new Error("Failed to load reminders.");
      }

      setEventWithReminders(response.data);

      setAction((previous) => {
        if (!previous) {
          return previous;
        }
        const remindersList = response.data
          .reminders as unknown as ActionReminder[];
        return {
          ...previous,
          events: previous.events.map((event) => {
            if (event.id !== response.data.id) {
              return event;
            }
            return {
              ...event,
              reminders: remindersList,
              customReminders: remindersList,
            } as typeof event & {
              reminders?: ActionReminder[];
              customReminders?: ActionReminder[];
            };
          }),
        };
      });

      return response.data;
    },
    [setAction]
  );

  const handleDeleteConfirm = (reminderId: number) => {
    setDeleteConfirmation(reminderId);
  };
  const handleDelete = async () => {
    if (!deleteConfirmation) {
      return;
    }
    const resp = await actionsDeleteReminder({
      path: { reminderId: deleteConfirmation },
    });
    if (resp.response.ok) {
      setDeleteConfirmation(null);
      refreshEventReminders(selectedEventId);
    }
  };

  useEffect(() => {
    if (!selectedEventId) {
      setEventWithReminders(undefined);
      return;
    }
    setLoadError(null);
    refreshEventReminders(selectedEventId).catch((err) => {
      console.error(err);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load reminders."
      );
    });
  }, [selectedEventId, refreshEventReminders]);

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

  const getMemberEventId = useCallback(
    (reminder: ActionReminder) => {
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
    },
    [eventWithReminders]
  );

  const findDeadlineEvent = (reminder: ActionReminder) => {
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

  const toFormUsers = useCallback(
    (rawUsers: unknown[]): ActionReminderFormUser[] => {
      if (!Array.isArray(rawUsers)) {
        return [];
      }
      return rawUsers
        .map((user) => {
          if (!user || typeof user !== "object") {
            return null;
          }
          const id = (user as { id?: number }).id;
          if (typeof id !== "number") {
            return null;
          }
          const existing = usersById.get(id);
          if (existing) {
            return existing;
          }
          const name =
            (user as { name?: string }).name ??
            (user as { displayName?: string }).displayName ??
            undefined;
          const email = (user as { email?: string }).email ?? undefined;
          return {
            id,
            name,
            displayName: name,
            email,
          };
        })
        .filter((user): user is ActionReminderFormUser => Boolean(user));
    },
    [usersById]
  );

  const buildReminderInitialValues = useCallback(
    (reminder: ActionReminder): ActionReminderFormInitialValues => {
      const memberActionEventId =
        getMemberEventId(reminder) ?? selectedEventId ?? null;
      const reminderUsers = toFormUsers(reminder.users ?? []);

      return {
        memberActionEventId,
        reminder: {
          cohortType: reminder.cohortType ?? "all_uncompleted",
          timingMode: reminder.timingMode ?? "absolute",
          emailSubject: reminder.emailSubject ?? defaultEmailSubject,
          emailMessage: reminder.emailMessage ?? defaultEmailContents,
          textMessage: reminder.textMessage ?? defaultTextMessage,
          sendAtAbsolute: reminder.sendAtAbsolute,
          sendAtSecondsFromDeadline: reminder.sendAtSecondsFromDeadline,
          userIds:
            reminderUsers.length > 0
              ? reminderUsers.map((user) => user.id)
              : undefined,
        },
        selectedUsers: reminderUsers,
      };
    },
    [selectedEventId, toFormUsers, getMemberEventId]
  );

  const createInitialValues = useMemo<ActionReminderFormInitialValues>(() => {
    const defaultSendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return {
      memberActionEventId: selectedEventId,
      reminder: {
        cohortType: "all_uncompleted",
        timingMode: "absolute",
        emailSubject: defaultEmailSubject,
        emailMessage: defaultEmailContents,
        textMessage: defaultTextMessage,
        sendAtAbsolute: defaultSendAt,
        sendAtSecondsFromDeadline: undefined,
        userIds: undefined,
      },
      selectedUsers: [],
    };
  }, [selectedEventId]);

  const mapFormPayloadToDto = (
    payload: ActionReminderFormSubmitPayload
  ): CreateActionReminderDto => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { memberActionEventId: _eventId, userIds, ...rest } = payload;
    return {
      ...rest,
      userIds:
        rest.cohortType === "custom"
          ? userIds && userIds.length > 0
            ? userIds
            : []
          : undefined,
    };
  };

  const handleCreateSubmit = async (
    payload: ActionReminderFormSubmitPayload
  ) => {
    setCreateError(null);
    setCreateSuccess(null);
    setCreateSubmitting(true);

    try {
      const eventId = payload.memberActionEventId;
      if (!eventId) {
        throw new Error("Select a member action event first.");
      }

      const body = mapFormPayloadToDto(payload);

      setSelectedEventId(eventId);
      const response = await actionsCreateReminder({
        path: { actionId: action.id, eventId },
        body,
      });

      if (response.error || !response.data) {
        throw new Error(
          (response.error as string) ?? "Failed to create reminder."
        );
      }

      await refreshEventReminders(eventId);
      setCreateSuccess("Reminder scheduled successfully.");
    } catch (err) {
      console.error(err);
      setCreateError(
        err instanceof Error ? err.message : "Failed to create reminder."
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEditSubmit =
    (reminderId: number) =>
    async (payload: ActionReminderFormSubmitPayload) => {
      setEditError(null);
      setEditSuccess(null);
      setEditSubmitting(true);
      try {
        const eventId = payload.memberActionEventId;
        if (!eventId) {
          throw new Error("Select a member action event first.");
        }

        const body = mapFormPayloadToDto(payload);
        setSelectedEventId(eventId);

        const response = await client.patch<ActionReminderDto, unknown>({
          url: `/actions/${action.id}/events/${eventId}/reminders/${reminderId}`,
          body,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.data) {
          throw new Error(
            (response.error as string) ?? "Failed to update reminder."
          );
        }

        await refreshEventReminders(eventId);
        setEditSuccess("Reminder updated successfully.");
        setEditingReminderId(null);
      } catch (err) {
        console.error(err);
        setEditError(
          err instanceof Error ? err.message : "Failed to update reminder."
        );
      } finally {
        setEditSubmitting(false);
      }
    };

  const handleEditStart = (reminderId: number) => {
    setEditingReminderId(reminderId);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleEditCancel = () => {
    setEditingReminderId(null);
    setEditError(null);
    setEditSuccess(null);
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

  const handleCreateToggle = () => {
    if (createExpanded) {
      setCreateError(null);
    }
    setCreateExpanded((prev) => !prev);
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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Schedule Reminder</h3>
            <Button
              type="button"
              color={ButtonColor.Black}
              className="px-3 py-1 text-sm"
              onClick={handleCreateToggle}
            >
              {createExpanded ? "Hide form" : "New reminder"}
            </Button>
          </div>
          {!createExpanded && createSuccess && (
            <p className="text-sm text-green-600">{createSuccess}</p>
          )}
          {createExpanded && (
            <ActionReminderForm
              memberEvents={memberEvents}
              users={users}
              loadingUsers={loadingUsers}
              initialValues={createInitialValues}
              submitting={createSubmitting}
              serverError={createError}
              serverSuccess={createSuccess}
              onCancel={handleCreateToggle}
              onEventChange={setSelectedEventId}
              onSubmit={handleCreateSubmit}
            />
          )}
        </div>
      </Card>

      <h3 className="text-base font-semibold mb-3">Scheduled Reminders</h3>
      {loadError && <p className="text-sm text-red-600 mb-2">{loadError}</p>}
      {editSuccess && !editingReminderId && (
        <p className="text-sm text-green-600 mb-2">{editSuccess}</p>
      )}
      {reminders.length === 0 ? (
        <p className="text-sm text-gray-600">
          No custom reminders scheduled for this event yet.
        </p>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => {
            const schedule = resolveSchedule(reminder);
            const sentAtLabel = formatDisplayDate(reminder.sentAt);
            const sendDateLabel =
              !sentAtLabel && schedule.sendDate
                ? format(schedule.sendDate, DISPLAY_DATETIME_FORMAT)
                : null;
            const channels = getNotificationChannels(reminder);
            const channelText =
              channels.length > 0
                ? channels
                    .map(
                      (channel) => notificationChannelLabels[channel] ?? channel
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
            const isEditing = editingReminderId === reminder.id;

            return (
              <div
                key={reminder.id}
                className="border border-gray-200 rounded-md text-sm space-y-4"
              >
                {deleteConfirmation === reminder.id && (
                  <div className="p-4 flex flex-row items-center gap-2">
                    <p className="text-sm text-gray-600">
                      Are you sure you want to delete this reminder?
                    </p>
                    <div className="flex flex-row gap-2">
                      <Button
                        type="button"
                        color={ButtonColor.White}
                        onClick={() => setDeleteConfirmation(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        color={ButtonColor.Red}
                        onClick={handleDelete}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
                {isEditing ? (
                  <div className="p-4">
                    <ActionReminderForm
                      memberEvents={memberEvents}
                      users={users}
                      loadingUsers={loadingUsers}
                      initialValues={buildReminderInitialValues(reminder)}
                      submitting={isEditing ? editSubmitting : false}
                      serverError={isEditing ? editError : null}
                      serverSuccess={isEditing ? editSuccess : null}
                      disableEventSelection
                      submitLabel="Save Changes"
                      onCancel={handleEditCancel}
                      onSubmit={handleEditSubmit(reminder.id)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="flex flex-row gap-2 w-full bg-zinc-100 p-4 items-center justify-between">
                        <div className="flex flex-row gap-2 items-center">
                          <ClockIcon
                            fill={!!sentAtLabel ? undefined : "#aaa"}
                          />
                          <p className="text-sm text-black font-semibold">
                            {sentAtLabel
                              ? `Sent ${sentAtLabel}`
                              : sendDateLabel
                              ? `Scheduled for ${sendDateLabel}`
                              : "Pending"}
                          </p>
                        </div>
                        <div className="flex flex-row gap-2">
                          <Button
                            type="button"
                            color={ButtonColor.White}
                            onClick={() => handleEditStart(reminder.id)}
                            className="-my-1"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            color={ButtonColor.Black}
                            onClick={() => handleDeleteConfirm(reminder.id)}
                            className="-my-1"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="px-4">
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
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 pl-4">
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
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 pl-4 pb-4">
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
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActionRemindersTab;

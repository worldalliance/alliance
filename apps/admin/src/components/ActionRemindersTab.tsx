import {
  ActionDto,
  GroupDto,
  ReminderGroup,
  actionsCreateReminderGroup,
  actionsDeleteReminderGroup,
  actionsReminderGroupsForEvent,
  actionsUpdateReminderGroup,
  userGetGroups,
  userList,
} from "@alliance/shared/client";
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
import ActionReminderGroupForm, {
  ActionReminderGroupFormSubmitPayload,
} from "./ActionReminderGroupForm";
import { UserSelectUser } from "./UserSelect";

export const defaultEmailSubject =
  "You have #{days} left to complete #{action}";
export const defaultEmailContents = `Hi,
An action needs your completion: "#{action}"

You have #{days} left to complete it. Please do so at the below link.
#{link}`;

export const defaultTextMessage =
  "You have #{days} left to complete #{action}. #{link}";

interface ActionRemindersTabProps {
  action: ActionDto;
  setAction: React.Dispatch<React.SetStateAction<ActionDto | null>>;
}

const DISPLAY_DATETIME_FORMAT = "PP p";

type ReminderGroupReminder = {
  id?: number;
  user?: Record<string, unknown>;
  sentAt?: string | null;
  sendTime?: string | null;
  skippedForCompletion?: boolean;
};

type ReminderGroupWithRelations = ReminderGroup & {
  reminders?: ReminderGroupReminder[];
  sendRangeStart?: string | null;
  sendRangeEnd?: string | null;
  send_range_start?: string | null;
  send_range_end?: string | null;
};

const ActionRemindersTab: React.FC<ActionRemindersTabProps> = ({ action }) => {
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
    memberEvents[0].id //TODO: collate or move between events
  );
  const [users, setUsers] = useState<UserSelectUser[]>([]);
  const [userGroups, setUserGroups] = useState<GroupDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [loadingUserGroups, setLoadingUserGroups] = useState<boolean>(false);
  const [userGroupsError, setUserGroupsError] = useState<string | null>(null);

  const [createGroupExpanded, setCreateGroupExpanded] =
    useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(
    null
  );
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [deleteGroupConfirmation, setDeleteGroupConfirmation] = useState<
    number | null
  >(null);
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reminderGroups, setReminderGroups] = useState<ReminderGroup[]>([]);

  useEffect(() => {
    if (memberEvents.length && selectedEventId == null) {
      setSelectedEventId(memberEvents[0].id);
    }
  }, [memberEvents, selectedEventId]);

  useEffect(() => {
    setLoadingUsers(true);
    userList()
      .then((response) => {
        const mappedUsers = (response.data ?? []).map<UserSelectUser>(
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

  useEffect(() => {
    setLoadingUserGroups(true);
    setUserGroupsError(null);
    userGetGroups()
      .then((response) => {
        if (response.error) {
          throw new Error(
            typeof response.error === "string"
              ? response.error
              : "Failed to load user groups."
          );
        }
        setUserGroups(response.data ?? []);
      })
      .catch((err) => {
        console.error(err);
        setUserGroupsError(
          err instanceof Error ? err.message : "Failed to load user groups."
        );
      })
      .finally(() => setLoadingUserGroups(false));
  }, []);

  const refreshReminderGroups = useCallback(async (eventId: number) => {
    const response = await actionsReminderGroupsForEvent({
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
      setLoadError("Failed to load reminders");
      throw new Error("Failed to load reminders.");
    }

    setReminderGroups(response.data);
  }, []);

  useEffect(() => {
    refreshReminderGroups(selectedEventId);
  }, [selectedEventId, refreshReminderGroups]);

  const handleDeleteGroupConfirm = (groupId: number) => {
    setDeleteGroupConfirmation(groupId);
  };
  const handleDeleteGroup = async () => {
    if (!deleteGroupConfirmation) {
      return;
    }
    const resp = await actionsDeleteReminderGroup({
      path: { eventId: selectedEventId, groupId: deleteGroupConfirmation },
    });
    if (resp.response.ok) {
      setDeleteGroupConfirmation(null);
      refreshReminderGroups(selectedEventId);
    }
  };

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

  const getGroupMemberEventId = (group: ReminderGroupWithRelations) =>
    group.memberActionEvent?.id ?? null;

  const findGroupDeadlineEvent = (group: ReminderGroupWithRelations) => {
    const memberEventId = getGroupMemberEventId(group);
    if (!memberEventId) {
      return undefined;
    }
    return nextEventById.get(memberEventId);
  };

  const getGroupRange = (group: ReminderGroupWithRelations) => {
    const start = group.sendRangeStart ?? group.send_range_start ?? null;
    const end = group.sendRangeEnd ?? group.send_range_end ?? null;
    return { start: parseDate(start), end: parseDate(end) };
  };

  const describeGroupSchedule = (
    group: ReminderGroupWithRelations
  ): { primary: string; secondary?: string | null } => {
    if (group.timingMode === "absolute") {
      const sendAtLabel = formatDisplayDate(group.sendAtAbsolute);
      return {
        primary: sendAtLabel
          ? `Sends ${sendAtLabel}`
          : "Absolute schedule configured",
        secondary: sendAtLabel ? "Absolute schedule" : null,
      };
    }

    if (group.timingMode === "from_deadline") {
      const deadlineEvent =
        group.deadlineEvent ?? findGroupDeadlineEvent(group);
      const deadlineDate = parseDate(deadlineEvent?.date);
      const seconds = group.sendAtSecondsFromDeadline ?? 0;
      if (deadlineDate) {
        const sendDate = subSeconds(deadlineDate, seconds);
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
          };
        }
        const distance = formatDistanceStrict(deadlineDate, sendDate, {
          roundingMethod: "floor",
        });
        return {
          primary: `Sends ${distance} ${
            seconds >= 0 ? "before" : "after"
          } ${referenceTitle}`,
          secondary: `${format(
            sendDate,
            DISPLAY_DATETIME_FORMAT
          )} • Deadline ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`,
        };
      }
      return {
        primary: "Relative schedule",
        secondary: "Waiting for deadline details",
      };
    }

    if (group.timingMode === "within_range") {
      const { start, end } = getGroupRange(group);
      if (start && end) {
        return {
          primary: `Sends between ${format(
            start,
            DISPLAY_DATETIME_FORMAT
          )} and ${format(end, DISPLAY_DATETIME_FORMAT)}`,
          secondary: "Personalized window",
        };
      }
      return {
        primary: "Personalized window",
        secondary: "Range not fully configured",
      };
    }

    if (group.timingMode === "event_launch") {
      const launchDate = parseDate(group.memberActionEvent?.date);
      return {
        primary: launchDate
          ? `Sends when launch event begins (${format(
              launchDate,
              DISPLAY_DATETIME_FORMAT
            )})`
          : "Sends when launch event begins",
        secondary: null,
      };
    }

    return {
      primary: "Scheduled group reminder",
      secondary: null,
    };
  };

  const handleCreateGroupSubmit = async (
    payload: ActionReminderGroupFormSubmitPayload
  ) => {
    setCreateError(null);
    setCreateSuccess(null);
    setCreateSubmitting(true);

    try {
      const { memberActionEventId: eventId, ...body } = payload;
      if (!eventId) {
        throw new Error("Select a member action event first.");
      }

      setSelectedEventId(eventId);
      const response = await actionsCreateReminderGroup({
        path: { eventId },
        body,
      });

      if (response.error || !response.data) {
        throw new Error(
          (response.error as string) ?? "Failed to create reminder."
        );
      }

      await refreshReminderGroups(eventId);
      setCreateSuccess("Personal reminders group scheduled successfully.");
      setCreateGroupExpanded(false);
    } catch (err) {
      console.error(err);
      setCreateError(
        err instanceof Error ? err.message : "Failed to create reminder."
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEditGroupSubmit =
    (groupId: number) =>
    async (payload: ActionReminderGroupFormSubmitPayload) => {
      setEditError(null);
      setEditSuccess(null);
      setEditSubmitting(true);
      try {
        const { memberActionEventId: eventId, ...body } = payload;
        if (!eventId) {
          throw new Error("Select a member action event first.");
        }

        const response = await actionsUpdateReminderGroup({
          path: { actionId: action.id, eventId, groupId },
          body,
        });

        if (!response.data) {
          throw new Error(
            (response.error as string) ?? "Failed to update reminder."
          );
        }

        await refreshReminderGroups(eventId);
        setEditSuccess("Reminder group updated successfully.");
        setEditingGroupId(null);
      } catch (err) {
        console.error(err);
        setEditError(
          err instanceof Error ? err.message : "Failed to update reminder."
        );
      } finally {
        setEditSubmitting(false);
      }
    };

  const handleEditGroupStart = (groupId: number) => {
    setEditingGroupId(groupId);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleEditCancel = () => {
    setEditingReminderId(null);
    setEditingGroupId(null);
    setEditError(null);
    setEditSuccess(null);
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
            <h3 className="text-base font-semibold">Schedule a notification</h3>
            <Button
              type="button"
              color={ButtonColor.Black}
              className="px-3 py-1 text-sm"
              onClick={() => setCreateGroupExpanded((prev) => !prev)}
            >
              {createGroupExpanded ? "Hide form" : "New reminder"}
            </Button>
          </div>
          {!createGroupExpanded && createSuccess && (
            <p className="text-sm text-green-600">{createSuccess}</p>
          )}
          {createGroupExpanded && (
            <>
              <p className="text-sm text-gray-600">
                Creates a personal reminder for each user based on their time
                zone and reminder time preference.
              </p>
              <ActionReminderGroupForm
                memberEvents={memberEvents}
                users={users}
                loadingUsers={loadingUsers}
                userGroups={userGroups}
                loadingUserGroups={loadingUserGroups}
                userGroupsError={userGroupsError}
                initialValues={{
                  memberActionEventId: selectedEventId,
                  reminderGroup: null,
                  users: [],
                }}
                submitting={createSubmitting}
                serverError={createError}
                serverSuccess={createSuccess}
                onCancel={() => setCreateGroupExpanded(false)}
                onEventChange={setSelectedEventId}
                onSubmit={handleCreateGroupSubmit}
              />
            </>
          )}
        </div>
      </Card>

      {loadError && <p className="text-sm text-red-600 mb-2">{loadError}</p>}
      {editSuccess && !editingReminderId && (
        <p className="text-sm text-green-600 mb-2">{editSuccess}</p>
      )}
      {reminderGroups.map((group) => {
        const groupSchedule = describeGroupSchedule(group);
        return (
          <Card
            key={group.id}
            className="bg-white text-sm !p-0 overflow-hidden"
          >
            {deleteGroupConfirmation === group.id && (
              <div className="p-4 flex flex-row items-center gap-2">
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this reminder group?
                </p>
                <div className="flex flex-row gap-2">
                  <Button
                    type="button"
                    color={ButtonColor.White}
                    onClick={() => setDeleteGroupConfirmation(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    color={ButtonColor.Red}
                    onClick={handleDeleteGroup}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-row gap-2 w-full bg-zinc-100 p-4 items-center justify-between">
              <div className="flex flex-col gap-1">
                <p className="font-semibold">{group.name}</p>
                <p className="">{groupSchedule.primary}</p>
                {groupSchedule.secondary && (
                  <p className="text-xs text-gray-500">
                    {groupSchedule.secondary}
                  </p>
                )}
                {group.allSent && (
                  <p className="text-green">All reminders processed</p>
                )}
              </div>
              <div className="flex flex-row gap-2">
                <Button
                  type="button"
                  color={ButtonColor.White}
                  onClick={() => handleEditGroupStart(group.id)}
                  className="-my-1"
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  color={ButtonColor.Black}
                  onClick={() => handleDeleteGroupConfirm(group.id)}
                  className="-my-1"
                >
                  Delete
                </Button>
              </div>
            </div>
            <div className="flex flex-row gap-2 p-4">
              {editingGroupId === group.id ? (
                <ActionReminderGroupForm
                  memberEvents={memberEvents}
                  users={users}
                  loadingUsers={loadingUsers}
                  userGroups={userGroups}
                  loadingUserGroups={loadingUserGroups}
                  userGroupsError={userGroupsError}
                  submitting={editSubmitting}
                  initialValues={{
                    memberActionEventId: selectedEventId,
                    reminderGroup: group,
                    users: group.users ?? [],
                  }}
                  serverError={editError}
                  serverSuccess={editSuccess}
                  submitLabel="Update Reminders"
                  onCancel={handleEditCancel}
                  onSubmit={handleEditGroupSubmit(group.id)}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-1 w-1/2">
                    <p className="text-sm font-semibold text-gray-900">
                      {group.emailSubject}
                    </p>
                    <p>{group.emailMessage}</p>
                  </div>
                  <div className="flex flex-col gap-1 w-1/2">
                    <p>{group.textMessage}</p>
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="divide-y divide-gray-200 border-t border-gray-200 max-h-[300px] overflow-y-auto">
                {/* {reminders.length === 0 && (
                  <p className="text-sm text-gray-600 p-4">
                    This group has no reminders.
                  </p>
                )}
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex flex-row gap-2 items-center p-3 justify-between"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {formatRecipientName(reminder.user)}
                    </p>
                    <div className="flex flex-row gap-2 items-center">
                      <div className="mt-[2px]">
                        <ClockIcon
                          fill={!!reminder.sentAt ? undefined : "#aaa"}
                          size="xs"
                        />
                      </div>
                      <span
                        className={`text-sm ${
                          reminder.skippedForCompletion
                            ? "text-green"
                            : "text-gray-500"
                        }`}
                      >
                        {reminder.skippedForCompletion
                          ? "not sent (completion / withdrawal)"
                          : reminder.sentAt
                          ? `Sent ${formatDisplayDate(reminder.sentAt)}`
                          : `Scheduled for ${formatDisplayDate(
                              reminder.sendTime
                            )}`}
                      </span>
                    </div>
                  </div>
                ))} */}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default ActionRemindersTab;

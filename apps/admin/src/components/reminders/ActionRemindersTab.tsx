/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  actionsReminderAnchorCandidatesAdmin,
  ActionSuiteDto,
  ReminderAnchorCandidateDto,
  ReminderGroupDto,
} from "@alliance/shared/client";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import {
  ConfirmMode,
  ToastPlacement,
  useToast,
} from "@alliance/sharedweb/ui/ToastProvider";
import {
  format,
  formatDistanceStrict,
  isValid,
  parseISO,
  subSeconds,
} from "date-fns";
import { millisecondsInSecond } from "date-fns/constants";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useActionReminderGroupsAdmin } from "../../lib/useActionReminderGroupsAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import ActionReminderCard from "./ActionReminderCard";
import ActionReminderGroupForm, {
  ActionReminderGroupFormInitialValues,
  ActionReminderGroupFormSubmitPayload,
} from "./ActionReminderGroupForm";
import {
  presetNames,
  ReminderPreset,
  ReminderPresetName,
  reminderPresets,
} from "./presets";

interface ActionRemindersTabProps {
  suite: ActionSuiteDto;
  highlightedReminder?: number;
}

export type GroupScheduleLabels = {
  primary: string;
  secondary?: string | null;
  pastTense: string;
};

const DISPLAY_DATETIME_FORMAT = "PP p";

const defaultDeadlinePresets: ReminderPresetName[] = [
  "Two Day Range",
  "One Day Range",
  "Three Hour",
  "Missed Deadline",
  "Group Leads 3 days",
  "Group Leads 2 days",
];

const ActionRemindersTab: React.FC<ActionRemindersTabProps> = ({
  suite,
  highlightedReminder,
}) => {
  const action = suite.actions[0];
  const memberEvents = useMemo(
    () =>
      (action.events || []).filter(
        (event) => event.newStatus === "member_action",
      ),
    [action.events],
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
    memberEvents.length > 0 ? memberEvents[0].id : null, //TODO: collate or move between events
  );
  const {
    tags: userTags,
    isLoading: loadingUserTags,
    isError: userTagsLoadFailed,
  } = useTagsAdmin();
  const userTagsError = userTagsLoadFailed ? "Failed to load user tags." : null;
  const {
    data: users = [],
    isLoading: loadingUsers,
    isLoadingError: usersLoadFailed,
  } = useUsersAdmin();

  const [createGroupExpanded, setCreateGroupExpanded] =
    useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [anchorCandidates, setAnchorCandidates] = useState<
    ReminderAnchorCandidateDto[]
  >([]);
  const [anchorCandidatesError, setAnchorCandidatesError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!selectedEventId) {
      setAnchorCandidates([]);
      setAnchorCandidatesError(null);
      return;
    }
    let cancelled = false;
    actionsReminderAnchorCandidatesAdmin({
      path: { eventId: selectedEventId },
    })
      .then((response) => {
        if (cancelled) return;
        // an empty candidate list changes what the form offers (and shows a
        // set anchor as stale), so a failed fetch must be surfaced instead of
        // being treated as "no dependency deadlines"
        if (response.error) {
          setAnchorCandidates([]);
          setAnchorCandidatesError(
            "Failed to load dependency deadlines for timing anchors.",
          );
          return;
        }
        setAnchorCandidates(response.data ?? []);
        setAnchorCandidatesError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setAnchorCandidates([]);
        setAnchorCandidatesError(
          "Failed to load dependency deadlines for timing anchors.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  useEffect(() => {
    if (memberEvents.length && selectedEventId == null) {
      setSelectedEventId(memberEvents[0].id);
    }
  }, [memberEvents, selectedEventId]);

  const {
    groups: reminderGroups,
    groupsLoadFailed,
    detailsByGroup,
    detailsLoadFailed,
    create: createGroups,
    update: updateGroup,
    remove: removeGroup,
  } = useActionReminderGroupsAdmin(selectedEventId);
  const selectEvent = (eventId: number) => {
    if (eventId !== selectedEventId) removeGroup.reset();
    setSelectedEventId(eventId);
  };
  const loadError = groupsLoadFailed
    ? "Failed to load reminders."
    : detailsLoadFailed
      ? "Failed to load reminder details."
      : null;

  const handleDeleteGroup = async (
    groupId: number,
    anchor?: HTMLElement | null,
  ) => {
    const ok = await confirm({
      message:
        "Delete reminder group? All planned reminders will no longer be sent.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      anchorEl: anchor,
      placement: ToastPlacement.TopLeft,
    });
    if (!ok) {
      return;
    }
    removeGroup.mutate(groupId);
  };

  const parseDate = useCallback((value?: string | Date | null) => {
    if (!value) {
      return null;
    }
    const date = typeof value === "string" ? parseISO(value) : value;
    return isValid(date) ? date : null;
  }, []);

  const formatDisplayDate = (value?: string | Date | null) => {
    const date = parseDate(value);
    return date ? format(date, DISPLAY_DATETIME_FORMAT) : null;
  };

  const getGroupMemberEventId = (group: ReminderGroupDto) =>
    group.memberActionEvent?.id ?? null;

  const findGroupDeadlineEvent = useCallback(
    (group: ReminderGroupDto) => {
      const memberEventId = getGroupMemberEventId(group);

      if (!memberEventId) {
        return undefined;
      }
      return nextEventById.get(memberEventId);
    },
    [nextEventById],
  );

  const getGroupRange = (group: ReminderGroupDto) => {
    const start = group.send_range_start ?? null;
    const end = group.send_range_end ?? null;
    return { start: parseDate(start), end: parseDate(end) };
  };

  // The event a deadline-relative group's send time is computed from: the
  // timing anchor (a dependency action's deadline) when set, else the group's
  // own deadline event.
  const findGroupTimingReferenceEvent = useCallback(
    (group: ReminderGroupDto) =>
      group.timingAnchorEvent ??
      group.deadlineEvent ??
      findGroupDeadlineEvent(group),
    [findGroupDeadlineEvent],
  );

  const describeAnchor = (group: ReminderGroupDto): string | null => {
    if (!group.timingAnchorEvent) {
      return null;
    }
    const anchorActionName = anchorCandidates.find(
      (candidate) => candidate.deadlineEventId === group.timingAnchorEvent?.id,
    )?.actionName;
    return `${anchorActionName ?? "dependency action"} deadline`;
  };

  const describeGroupSchedule = (
    group: ReminderGroupDto,
  ): GroupScheduleLabels => {
    if (group.timingMode === "absolute") {
      const sendAtLabel = formatDisplayDate(group.sendAtAbsolute);
      return {
        primary: sendAtLabel
          ? `Sends ${sendAtLabel}`
          : "Absolute schedule configured",
        secondary: sendAtLabel ? "Absolute schedule" : null,
        pastTense: `at ${sendAtLabel}`,
      };
    }

    if (group.timingMode === "from_deadline") {
      const referenceEvent = findGroupTimingReferenceEvent(group);
      const anchorLabel = describeAnchor(group);
      const deadlineDate = parseDate(referenceEvent?.date);
      const seconds = group.sendAtSecondsFromDeadline ?? 0;
      if (deadlineDate) {
        const sendDate = subSeconds(deadlineDate, seconds);
        const referenceTitle =
          anchorLabel ??
          (referenceEvent?.title?.trim() ||
            `deadline on ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`);
        if (seconds === 0) {
          return {
            primary: anchorLabel
              ? `Sends at ${referenceTitle}`
              : `Sends when ${referenceTitle} begins`,
            secondary: `${format(
              sendDate,
              DISPLAY_DATETIME_FORMAT,
            )} • Deadline ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`,
            pastTense: `at ${format(sendDate, DISPLAY_DATETIME_FORMAT)}`,
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
            DISPLAY_DATETIME_FORMAT,
          )} • Deadline ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`,
          pastTense: `${distance} ${
            seconds >= 0 ? "before" : "after"
          } ${referenceTitle}`,
        };
      }
      return {
        primary: "Relative schedule",
        secondary: "Error: no deadline event found to schedule from",
        pastTense: "Relative schedule",
      };
    }

    if (group.timingMode === "within_range") {
      const { start, end } = getGroupRange(group);
      if (start && end) {
        return {
          primary: `Sends between ${format(
            start,
            DISPLAY_DATETIME_FORMAT,
          )} and ${format(end, DISPLAY_DATETIME_FORMAT)}`,
          secondary: "Personalized window",
          pastTense: `between ${format(
            start,
            DISPLAY_DATETIME_FORMAT,
          )} and ${format(end, DISPLAY_DATETIME_FORMAT)}`,
        };
      }
      return {
        primary: "Personalized window",
        secondary: "Range not fully configured",
        pastTense: "Relative schedule",
      };
    }
    if (group.timingMode === "within_relative_range") {
      const startSeconds =
        group.relative_range_start_seconds_from_deadline ?? null;
      const endSeconds = group.relative_range_end_seconds_from_deadline ?? null;
      const referenceEvent = findGroupTimingReferenceEvent(group);
      const anchorLabel = describeAnchor(group);
      const deadlineDate = parseDate(referenceEvent?.date);
      if (startSeconds === null || endSeconds === null || !deadlineDate) {
        return {
          primary: "Relative personalized window",
          secondary: "Error: no deadline event found to schedule from",
          pastTense: "Relative personalized window",
        };
      }

      const describeOffset = (seconds: number) => {
        if (seconds === 0) {
          return "at the deadline";
        }
        const distance = formatDistanceStrict(
          new Date(0),
          new Date(Math.abs(seconds) * millisecondsInSecond),
          { roundingMethod: "floor" },
        );
        return `${distance} ${seconds >= 0 ? "before" : "after"}`;
      };

      const startLabel = describeOffset(startSeconds);
      const endLabel = describeOffset(endSeconds);
      const referenceTitle =
        anchorLabel ??
        (referenceEvent?.title?.trim() ||
          `deadline on ${format(deadlineDate, DISPLAY_DATETIME_FORMAT)}`);
      const startDate = subSeconds(deadlineDate, startSeconds);
      const endDate = subSeconds(deadlineDate, endSeconds);
      const deadlineLabel = format(deadlineDate, DISPLAY_DATETIME_FORMAT);

      return {
        primary:
          startSeconds === endSeconds
            ? `Sends ${startLabel} ${referenceTitle}`
            : `Sends between ${startLabel} and ${endLabel} ${referenceTitle}`,
        secondary: `${format(startDate, DISPLAY_DATETIME_FORMAT)} – ${format(
          endDate,
          DISPLAY_DATETIME_FORMAT,
        )} • Deadline ${deadlineLabel}`,
        pastTense:
          startSeconds === endSeconds
            ? `${startLabel} ${referenceTitle}`
            : `between ${startLabel} and ${endLabel} ${referenceTitle}`,
      };
    }
    if (group.timingMode === "event_launch") {
      const launchDate = parseDate(group.memberActionEvent?.date);
      return {
        primary: launchDate
          ? `Sends when launch event begins (${format(
              launchDate,
              DISPLAY_DATETIME_FORMAT,
            )})`
          : "Sends when launch event begins",
        secondary: null,
        pastTense: launchDate
          ? `when launch event began (${format(
              launchDate,
              DISPLAY_DATETIME_FORMAT,
            )})`
          : "when launch event began",
      };
    }

    return {
      primary: "Scheduled group reminder",
      secondary: null,
      pastTense: "Scheduled group reminder",
    };
  };

  const { confirm } = useToast();

  const populateDefaultReminders = async () => {
    if (!selectedEventId) {
      setCreateError("add a member action event to the suite first.");
      return;
    }

    const mode = import.meta.env.MODE;

    if (mode !== "development") {
      const ok = await confirm({
        title: "Populate default reminders?",
        message: `This will send reminders to all members participating in this action`,
        confirmLabel: "Create",
        cancelLabel: "Cancel",
        mode: ConfirmMode.Fullscreen,
        requiredText: `I am going to notify many real members`,
      });
      if (!ok) {
        return;
      }
    }

    setCreateError(null);
    setCreateSuccess(null);
    const hasDeadline = nextEventById.has(selectedEventId);
    const presets: ReminderPresetName[] = [
      "Announcement",
      ...(hasDeadline ? defaultDeadlinePresets : []),
    ];
    try {
      await createGroups.mutateAsync({
        eventId: selectedEventId,
        bodies: presets.map((preset) => ({
          suiteId: suite.id,
          ...reminderPresets[preset],
        })),
      });
    } catch (err) {
      console.error(err);
      setCreateError(adminRefusalMessage(err, "Failed to create reminders."));
      return;
    }
    if (hasDeadline) {
      setCreateSuccess("Reminders created successfully.");
    } else {
      setCreateError(
        "No deadline reminders created - does this event have a deadline?",
      );
    }
  };

  const handleCreateGroupSubmit = async (
    payload: ActionReminderGroupFormSubmitPayload,
    recipientCount: number | null,
  ) => {
    if (recipientCount === null) {
      throw new Error("create submitted before its recipient count arrived");
    }
    const mode = import.meta.env.MODE;

    if (mode !== "development") {
      const ok = await confirm({
        title: "Create reminder group?",
        message: `This will send emails or texts to ${recipientCount} members.`,
        confirmLabel: "Create",
        cancelLabel: "Cancel",
        mode: ConfirmMode.Fullscreen,
        requiredText: `I am going to notify ${recipientCount} real members`,
      });
      if (!ok) {
        return;
      }
    }

    setCreateError(null);
    setCreateSuccess(null);

    const { memberActionEventId: eventId, ...body } = payload;
    if (!eventId) {
      setCreateError("Select a member action event first.");
      return;
    }

    selectEvent(eventId);
    try {
      await createGroups.mutateAsync({
        eventId,
        bodies: [{ ...body, suiteId: suite.id }],
      });
      setCreateSuccess("Personal reminders group scheduled successfully.");
      setCreateGroupExpanded(false);
    } catch (err) {
      console.error(err);
      setCreateError(adminRefusalMessage(err, "Failed to create reminder."));
    }
  };

  const handleEditGroupSubmit =
    (groupId: number) =>
    async (payload: ActionReminderGroupFormSubmitPayload) => {
      setEditError(null);
      setEditSuccess(null);

      const { memberActionEventId: eventId, ...body } = payload;
      if (!eventId) {
        setEditError("Select a member action event first.");
        return;
      }

      try {
        await updateGroup.mutateAsync({
          groupId,
          body: { ...body, suiteId: suite.id },
        });
        setEditSuccess("Reminder group updated successfully.");
        setEditingGroupId(null);
      } catch (err) {
        console.error(err);
        setEditError(adminRefusalMessage(err, "Failed to update reminder."));
      }
    };

  const handleEditGroupStart = (groupId: number) => {
    setEditingGroupId(groupId);
    setEditError(null);
    setEditSuccess(null);
  };

  const handleEditCancel = () => {
    setEditingGroupId(null);
    setEditError(null);
    setEditSuccess(null);
  };

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightedReminder) {
      ref.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [highlightedReminder]);

  const [selectingPreset, setSelectingPreset] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] =
    useState<ReminderPresetName | null>(null);

  // Anchor-requiring presets need an upcoming dependency deadline: a past one
  // would schedule a send time already behind the worker's lookback window
  // (the group would never fire), and no candidates at all would silently turn
  // the preset into a plain own-deadline reminder — so those presets are
  // disabled in the picker instead of degrading.
  const upcomingAnchorCandidate = anchorCandidates.find(
    (candidate) => new Date(candidate.deadlineEventDate).getTime() > Date.now(),
  );

  // Resolve the UI-only anchorToDependencyDeadline marker to a concrete
  // timingAnchorEventId — the next upcoming dependency deadline (candidates
  // arrive sorted by date). Unreachable without one: the picker disables
  // anchor-requiring presets then.
  const resolvePreset = (
    preset: ReminderPreset,
  ): ActionReminderGroupFormInitialValues["reminderGroup"] => {
    const { anchorToDependencyDeadline, ...rest } = preset;
    if (!anchorToDependencyDeadline) {
      return rest;
    }
    return {
      ...rest,
      timingAnchorEventId: upcomingAnchorCandidate?.deadlineEventId,
    };
  };

  const sortedReminderGroups = useMemo(() => {
    return (reminderGroups ?? [])
      .map((group) => {
        let sendStartDate: Date | null = null;
        if (group.timingMode === "absolute") {
          sendStartDate = parseDate(group.sendAtAbsolute);
        } else if (group.timingMode === "from_deadline") {
          const referenceEvent = findGroupTimingReferenceEvent(group);
          const deadlineDate = parseDate(referenceEvent?.date);
          if (deadlineDate) {
            const seconds = group.sendAtSecondsFromDeadline ?? 0;
            sendStartDate = subSeconds(deadlineDate, seconds);
          }
        } else if (group.timingMode === "within_range") {
          const start = parseDate(group.send_range_start);
          const end = parseDate(group.send_range_end);
          sendStartDate = start ?? end ?? null;
        } else if (group.timingMode === "within_relative_range") {
          const referenceEvent = findGroupTimingReferenceEvent(group);
          const deadlineDate = parseDate(referenceEvent?.date);
          const startSeconds =
            group.relative_range_start_seconds_from_deadline ?? null;
          if (deadlineDate && startSeconds !== null) {
            sendStartDate = subSeconds(deadlineDate, startSeconds);
          }
        } else if (group.timingMode === "event_launch") {
          sendStartDate = parseDate(group.memberActionEvent?.date);
        } else {
          sendStartDate =
            parseDate(group.sendAtAbsolute) ??
            parseDate(group.send_range_start) ??
            parseDate(group.send_range_end) ??
            null;
        }

        return {
          group,
          sendStartDate,
        };
      })
      .sort((a, b) => {
        const timeA = a.sendStartDate
          ? a.sendStartDate.getTime()
          : Number.POSITIVE_INFINITY;
        const timeB = b.sendStartDate
          ? b.sendStartDate.getTime()
          : Number.POSITIVE_INFINITY;
        if (timeA === timeB) {
          return a.group.id - b.group.id;
        }
        return timeA - timeB;
      });
  }, [findGroupTimingReferenceEvent, parseDate, reminderGroups]);

  if (!memberEvents.length) {
    return (
      <Card style={CardStyle.White}>
        <p className="text-sm text-gray-600">
          No member action events yet. Add a member action event to schedule
          reminders.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-5">
      {loadError && <p className="text-sm text-red-600 mb-2">{loadError}</p>}
      {removeGroup.isError && (
        <p className="text-sm text-red-600 mb-2">
          {adminRefusalMessage(
            removeGroup.error,
            "Failed to delete reminder group.",
          )}
        </p>
      )}
      {anchorCandidatesError && (
        <p className="text-sm text-red-600 mb-2">{anchorCandidatesError}</p>
      )}
      <Card style={CardStyle.White}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Schedule a notification</h3>
            <div className="flex flex-row gap-2">
              {createGroupExpanded && (
                <div className="relative">
                  <Button
                    type="button"
                    color={ButtonColor.Light}
                    className="px-3 py-1 text-sm"
                    onClick={() => setSelectingPreset((prev) => !prev)}
                  >
                    {createGroupExpanded ? "Load preset..." : ""}
                  </Button>
                  {selectingPreset && (
                    <div className="absolute top-full right-0 p-2 bg-white shadow-md rounded-md">
                      {presetNames.map((preset) => {
                        const needsAnchor =
                          !!reminderPresets[preset].anchorToDependencyDeadline;
                        const anchorUnavailable =
                          needsAnchor && !upcomingAnchorCandidate;
                        return (
                          <Button
                            key={preset}
                            type="button"
                            color={ButtonColor.Light}
                            disabled={anchorUnavailable}
                            title={
                              anchorUnavailable
                                ? "Needs an upcoming dependency deadline to anchor to; this action's cohort has none"
                                : undefined
                            }
                            onClick={() => {
                              setSelectedPreset(preset);
                              setSelectingPreset(false);
                            }}
                            className="w-full rounded-none bg-transparent! hover:bg-zinc-200/60! text-nowrap justify-start"
                          >
                            {preset}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <Button
                type="button"
                color={ButtonColor.Black}
                className="px-3 py-1 text-sm"
                onClick={() => setCreateGroupExpanded((prev) => !prev)}
              >
                {createGroupExpanded ? "Hide form" : "New reminder"}
              </Button>
              {!createGroupExpanded && reminderGroups?.length === 0 && (
                <Button
                  type="button"
                  color={ButtonColor.Green}
                  className="px-3 py-1 text-sm"
                  onClick={populateDefaultReminders}
                >
                  Populate default reminders
                </Button>
              )}
            </div>
          </div>
          {!createGroupExpanded && createSuccess && (
            <p className="text-sm text-green">{createSuccess}</p>
          )}
          {createError && (
            <p className="text-sm text-red-600 mb-2">{createError}</p>
          )}
          {createGroupExpanded && selectedEventId !== null && (
            <>
              <ActionReminderGroupForm
                suiteId={suite.id}
                waitForRecipientCount
                memberEvents={memberEvents}
                anchorCandidates={anchorCandidates}
                users={users}
                loadingUsers={loadingUsers}
                usersLoadFailed={usersLoadFailed}
                userTags={userTags}
                loadingUserTags={loadingUserTags}
                userTagsError={userTagsError}
                initialValues={{
                  memberActionEventId: selectedEventId,
                  reminderGroup: selectedPreset
                    ? resolvePreset(reminderPresets[selectedPreset])
                    : null,
                  users: [],
                }}
                submitting={createGroups.isPending}
                serverError={createError}
                serverSuccess={createSuccess}
                onCancel={() => setCreateGroupExpanded(false)}
                onEventChange={selectEvent}
                onSubmit={handleCreateGroupSubmit}
              />
            </>
          )}
        </div>
      </Card>
      {sortedReminderGroups.map(({ group, sendStartDate }) => {
        const groupSchedule = describeGroupSchedule(group);
        return (
          <ActionReminderCard
            key={group.id}
            group={group}
            sendStartDate={sendStartDate}
            highlightedReminder={highlightedReminder}
            ref={ref}
            groupSchedule={groupSchedule}
            editing={editingGroupId === group.id}
            handleEditCancel={handleEditCancel}
            handleEditGroupStart={handleEditGroupStart}
            handleDeleteGroup={handleDeleteGroup}
            selectedEventId={selectedEventId}
            memberEvents={memberEvents}
            anchorCandidates={anchorCandidates}
            users={users}
            loadingUsers={loadingUsers}
            usersLoadFailed={usersLoadFailed}
            userTags={userTags}
            loadingUserTags={loadingUserTags}
            userTagsError={userTagsError}
            editSubmitting={updateGroup.isPending}
            editError={editError}
            editSuccess={editSuccess}
            handleEditGroupSubmit={handleEditGroupSubmit}
            reminderPlans={detailsByGroup.get(group.id)?.plans}
            sentReminders={detailsByGroup.get(group.id)?.sent}
            suiteId={suite.id}
            suiteTaskCount={suite.actions.length}
          />
        );
      })}
    </div>
  );
};

export default ActionRemindersTab;

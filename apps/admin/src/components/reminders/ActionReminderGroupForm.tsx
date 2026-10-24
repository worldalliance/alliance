/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { errorMessage } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import {
  actionRemindersTentativePlansForGroupAdmin,
  TagDto,
  type ActionEventDto,
  type PreviewNotificationPlanDto,
  type ReminderAnchorCandidateDto,
  type ReminderCohortType,
  type ReminderGroupTimingMode,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { RotateCw } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useReminderEmailPreviewAdmin,
  useReminderTextPreviewAdmin,
} from "../../lib/useReminderPreviewsAdmin";
import TextareaWithHighlights from "../TextareaWithHighlights";
import ReminderPreviewError from "./ReminderPreviewError";
import {
  ActionReminderGroupFormInitialValues,
  draftFromInitialValues,
  ReminderGroupDraft,
} from "./reminderGroupDraft";
import {
  ActionReminderGroupFormSubmitPayload,
  anchorApplies,
  excludePreviouslyNotifiedApplies,
  relativeRangeIsValid,
  reminderGroupRequestFields,
  reminderGroupSubmitPayload,
} from "./reminderGroupRequest";

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
  "#{nmembers}",
  "#{grouplink}",
  "#{formattedtasklist}",
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

const COHORT_OPTION_OBJ: Record<ReminderCohortType, string> = {
  all_uncompleted: "All uncompleted",
  tag: "User tag",
  custom: "Custom recipients",
  group_leads_with_uncompleted: "Group leads with uncompleted members",
};

const COHORT_OPTIONS = Object.entries(COHORT_OPTION_OBJ).map(
  ([value, label]) => ({ value, label }),
);

interface ActionReminderFormProps {
  suiteId: number;
  /** Holds submit until a current recipient count arrives, for a caller that confirms it. */
  waitForRecipientCount: boolean;
  memberEvents: ActionEventDto[];
  anchorCandidates: ReminderAnchorCandidateDto[];
  users: UserSelectUser[];
  loadingUsers: boolean;
  usersLoadFailed: boolean;
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
    recipientCount: number | null,
  ) => Promise<void> | void;
}

type PreviewTaskCount = 1 | 2;

const toggleTaskCount =
  (count: PreviewTaskCount) => (current: PreviewTaskCount | null) =>
    current === count ? null : count;

const ActionReminderGroupForm: React.FC<ActionReminderFormProps> = ({
  suiteId,
  waitForRecipientCount,
  memberEvents,
  anchorCandidates,
  users,
  loadingUsers,
  usersLoadFailed,
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
    initialValues.memberActionEventId ?? null,
  );
  const [draft, setDraft] = useState(() =>
    draftFromInitialValues(initialValues),
  );
  const updateDraft = (patch: Partial<ReminderGroupDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const {
    name,
    cohortType,
    timingMode,
    sendAtAbsolute,
    sendAtHoursFromDeadline,
    sendRangeStart,
    sendRangeEnd,
    relativeRangeStartHours,
    relativeRangeEndHours,
    timingAnchorEventId,
    emailSubject,
    emailMessage,
    textMessage,
    pushMessage,
    userIds: selectedUserIds,
    userTagId: selectedTagId,
    useSuiteTaskCount,
    excludeOptionalActions,
    excludePreviouslyNotified,
  } = draft;

  useEffect(() => {
    if (timingMode === "within_relative_range") {
      if (relativeRangeStartHours < relativeRangeEndHours) {
        setLocalError("Window start must be before the window end.");
      }
    }
  }, [timingMode, relativeRangeStartHours, relativeRangeEndHours]);

  const [tentativePlans, setTentativePlans] = useState<
    PreviewNotificationPlanDto[] | null
  >(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);

  const [localError, setLocalError] = useState<string | null>(null);
  const initialSnapshotRef = useRef<string>("");

  const [emailPreviewTaskCount, setEmailPreviewTaskCount] =
    useState<PreviewTaskCount | null>(null);
  const [textPreviewTaskCount, setTextPreviewTaskCount] =
    useState<PreviewTaskCount | null>(null);
  const [pushPreviewTaskCount, setPushPreviewTaskCount] =
    useState<PreviewTaskCount | null>(null);

  const computedInitialSnapshot = useMemo(() => {
    const userIds = [...initialValues.users.map((user) => user.id)].sort(
      (a, b) => a - b,
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
        timingAnchorEventId:
          reminder?.timingAnchorEvent?.id ??
          reminder?.timingAnchorEventId ??
          null,
        excludePreviouslyNotified: reminder?.excludePreviouslyNotified ?? null,
      },
      selectedUsers: userIds,
    });
  }, [initialValues]);

  useEffect(() => {
    if (!selectedEventId) {
      setTentativePlans(null);
      return;
    }
    if (draft.cohortType === "tag" && !draft.userTagId) {
      setTentativePlans([]);
      return;
    }
    if (
      draft.timingMode === "within_relative_range" &&
      !relativeRangeIsValid(draft)
    ) {
      setTentativePlans([]);
      return;
    }

    setTentativePlans(null);
    setPreviewError(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      R.fromPromise(
        actionRemindersTentativePlansForGroupAdmin({
          path: {
            eventId: selectedEventId,
          },
          body: { ...reminderGroupRequestFields(draft), suiteId },
        }),
      ).then((result) => {
        if (cancelled) return;
        if (!result.ok || result.value.error) {
          setPreviewError(
            errorMessage({
              error: result.ok ? result.value.error : result.error,
              fallback: "Unable to get tentative plans",
            }),
          );
          return;
        }
        setLocalError(null);
        setTentativePlans(result.value.data ?? []);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [suiteId, selectedEventId, draft, previewAttempt]);

  const emailPreview = useReminderEmailPreviewAdmin(
    selectedEventId,
    emailPreviewTaskCount === null
      ? null
      : { emailMessage, emailSubject, taskCount: emailPreviewTaskCount },
  );
  const textPreview = useReminderTextPreviewAdmin(
    selectedEventId,
    textPreviewTaskCount === null
      ? null
      : { textMessage, taskCount: textPreviewTaskCount },
  );
  const pushPreview = useReminderTextPreviewAdmin(
    selectedEventId,
    pushPreviewTaskCount === null
      ? null
      : { textMessage: pushMessage, taskCount: pushPreviewTaskCount },
  );

  useEffect(() => {
    if (computedInitialSnapshot === initialSnapshotRef.current) {
      return;
    }
    initialSnapshotRef.current = computedInitialSnapshot;

    setSelectedEventId(initialValues.memberActionEventId);
    onEventChange?.(initialValues.memberActionEventId);
    setDraft(draftFromInitialValues(initialValues));
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

    const payload = reminderGroupSubmitPayload({
      draft,
      memberActionEventId: selectedEventId,
    });
    if (!payload.ok) {
      setLocalError(payload.error);
      return;
    }

    console.log(payload.value);

    await onSubmit(payload.value, tentativePlans?.length ?? null);
  };

  const combinedError = localError ?? serverError ?? null;

  const [keywordsHelpExpanded, setKeywordsHelpExpanded] = useState(false);

  const sortedPlans = [...(tentativePlans ?? [])].sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );
  const firstTentativePlan = sortedPlans[0];

  const isProd = !(
    typeof window !== "undefined" && window.location.href.includes("localhost")
  );

  const handlePreviewEmail2Task = () =>
    setEmailPreviewTaskCount(toggleTaskCount(2));

  const handlePreviewEmail1Task = () =>
    setEmailPreviewTaskCount(toggleTaskCount(1));

  const handlePreviewText1Task = () =>
    setTextPreviewTaskCount(toggleTaskCount(1));

  const handlePreviewText2Task = () =>
    setTextPreviewTaskCount(toggleTaskCount(2));

  const handlePreviewPushTask = () =>
    setPushPreviewTaskCount(toggleTaskCount(1));

  const handlePreviewPush2Task = () =>
    setPushPreviewTaskCount(toggleTaskCount(2));

  // A set anchor that is no longer among the candidates (the dependency was
  // removed from the cohort expression, or the fetch failed) would otherwise
  // be submitted invisibly and rejected by the server with no way to clear
  // it — always show the selector then, with an explicit stale option.
  const anchorIsStale =
    timingAnchorEventId !== null &&
    !anchorCandidates.some(
      (candidate) => candidate.deadlineEventId === timingAnchorEventId,
    );
  const anchorSelector = anchorApplies(timingMode) &&
    (anchorCandidates.length > 0 || timingAnchorEventId !== null) && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Relative to
        </label>
        <select
          value={timingAnchorEventId ?? ""}
          onChange={(event) =>
            updateDraft({
              timingAnchorEventId: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">This action&apos;s deadline</option>
          {anchorIsStale && (
            <option value={timingAnchorEventId}>
              Current anchor (no longer a dependency deadline)
            </option>
          )}
          {anchorCandidates.map((candidate) => (
            <option
              key={candidate.deadlineEventId}
              value={candidate.deadlineEventId}
            >
              {candidate.actionName} deadline —{" "}
              {new Date(candidate.deadlineEventDate).toLocaleString()}
            </option>
          ))}
        </select>
        {anchorIsStale && (
          <p className="text-xs text-amber-600 mt-1">
            The current anchor is no longer a dependency deadline of this
            action; saving with it will fail. Pick another option.
          </p>
        )}
      </div>
    );

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
            onChange={(event) => updateDraft({ name: event.target.value })}
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
              updateDraft({
                timingMode: event.target.value as ReminderGroupTimingMode,
              })
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
            onChange={(change) =>
              updateDraft({ sendAtAbsolute: change.utcValue ?? "" })
            }
            className="w-full !py-1"
            required
          />
        </div>
      )}

      {timingMode === "from_deadline" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              hours to deadline
            </label>
            <input
              type="number"
              value={sendAtHoursFromDeadline}
              onChange={(event) => {
                const value = event.target.value;
                updateDraft({
                  sendAtHoursFromDeadline: value === "" ? NaN : Number(value),
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          {anchorSelector}
        </>
      )}

      {timingMode === "within_range" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send range start
            </label>
            <DateTimePicker
              value={sendRangeStart}
              onChange={(change) =>
                updateDraft({ sendRangeStart: change.utcValue ?? "" })
              }
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
              onChange={(change) =>
                updateDraft({ sendRangeEnd: change.utcValue ?? "" })
              }
              className="w-full !py-1"
              required
            />
          </div>
        </div>
      )}

      {timingMode === "within_relative_range" && (
        <div className="grid gap-4 md:grid-cols-2">
          {anchorSelector && (
            <div className="md:col-span-2">{anchorSelector}</div>
          )}
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
                updateDraft({
                  relativeRangeStartHours: value === "" ? NaN : Number(value),
                });
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
                updateDraft({
                  relativeRangeEndHours: value === "" ? NaN : Number(value),
                });
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
            updateDraft({
              cohortType: event.target.value as ReminderCohortType,
            })
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
            onChange={(event) => updateDraft({ userTagId: event.target.value })}
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
          onChange={(userIds) => updateDraft({ userIds })}
          loading={loadingUsers}
          loadFailed={usersLoadFailed}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Subject
        </label>
        <TextareaWithHighlights
          keywords={keywords}
          value={emailSubject}
          onChange={(value) => updateDraft({ emailSubject: value })}
          rows={1}
          highlightHashPipeSyntax
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
            color={
              emailPreviewTaskCount === 1
                ? ButtonColor.Stone
                : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Email (1 task)
          </Button>
          <Button
            onClick={handlePreviewEmail2Task}
            size={"small"}
            color={
              emailPreviewTaskCount === 2
                ? ButtonColor.Stone
                : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Email (2 tasks)
          </Button>
        </div>
        {emailPreviewTaskCount !== null ? (
          <Card className="p-4">
            <ReminderPreviewError error={emailPreview.error} />
            <p className="font-bold mb-4">{emailPreview.data?.subject}</p>
            <div
              dangerouslySetInnerHTML={{
                __html: emailPreview.data?.html ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={emailMessage}
            onChange={(value) => updateDraft({ emailMessage: value })}
            rows={5}
            highlightHashPipeSyntax
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
            color={
              textPreviewTaskCount === 1 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Text (1 task)
          </Button>
          <Button
            onClick={handlePreviewText2Task}
            size={"small"}
            color={
              textPreviewTaskCount === 2 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Text (2 tasks)
          </Button>
        </div>
        {textPreviewTaskCount !== null ? (
          <Card className="p-4">
            <ReminderPreviewError error={textPreview.error} />
            <p
              dangerouslySetInnerHTML={{
                __html: textPreview.data?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={textMessage}
            onChange={(value) => updateDraft({ textMessage: value })}
            rows={2}
            highlightHashPipeSyntax
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
            color={
              pushPreviewTaskCount === 1 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Push (1 task)
          </Button>
          <Button
            onClick={handlePreviewPush2Task}
            size={"small"}
            color={
              pushPreviewTaskCount === 2 ? ButtonColor.Stone : ButtonColor.Light
            }
            className="!px-2 !py-1"
          >
            Preview Push (2 tasks)
          </Button>
        </div>
        {pushPreviewTaskCount !== null ? (
          <Card className="p-4">
            <ReminderPreviewError error={pushPreview.error} />
            <p
              dangerouslySetInnerHTML={{
                __html: pushPreview.data?.replace(/\n/g, "<br>") ?? "",
              }}
            />
          </Card>
        ) : (
          <TextareaWithHighlights
            keywords={keywords}
            value={pushMessage}
            onChange={(value) => updateDraft({ pushMessage: value })}
            rows={2}
            highlightHashPipeSyntax
          />
        )}
      </div>
      <div className="flex items-center gap-4">
        <LargeCheckbox
          label="Use suite task count"
          checked={useSuiteTaskCount}
          onChange={(checked) => updateDraft({ useSuiteTaskCount: checked })}
        />
        <LargeCheckbox
          label="Exclude optional actions"
          checked={excludeOptionalActions}
          onChange={(checked) =>
            updateDraft({ excludeOptionalActions: checked })
          }
        />
        {excludePreviouslyNotifiedApplies(cohortType) && (
          <LargeCheckbox
            label="Only notify about tasks not yet notified (skip users with nothing new)"
            checked={excludePreviouslyNotified}
            onChange={(checked) =>
              updateDraft({ excludePreviouslyNotified: checked })
            }
          />
        )}
      </div>

      <div
        className={cn(
          "border border-gray-200 rounded-md bg-zinc-100",
          !keywordsHelpExpanded && "hover:border-gray-300",
        )}
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
                  <td>{"#{formattedtasklist}"}</td>
                  <td>
                    1. Task 1<br />
                    2. Task 2<br />
                    3. Task 3<br />
                    <br />
                    or
                    <br />
                    <br />
                    Task 1
                  </td>
                  <td>
                    The list of uncompleted tasks for this user, formatted as a
                    numbered list. If there is a single task, it will be
                    displayed without a number.
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
        {tentativePlans === null &&
          (previewError ? (
            <div className="px-4 py-2 self-start flex items-center gap-2 text-sm text-red-600">
              <p>{previewError}</p>
              <button
                type="button"
                onClick={() => setPreviewAttempt((attempt) => attempt + 1)}
                aria-label="Retry recipient count"
                title="Retry recipient count"
                className="shrink-0 rounded p-1 hover:bg-red-50"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="px-4 py-2 self-start text-sm text-zinc-500">
              Counting recipients…
            </p>
          ))}
        {tentativePlans !== null && tentativePlans.length > 0 && (
          <p
            className={cn(
              "px-4 py-2 rounded self-start",
              tentativePlans.length > 0 && isProd
                ? "bg-yellow-600 text-white"
                : "border border-gray-200",
            )}
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
          disabled={
            submitting ||
            loadingUsers ||
            (waitForRecipientCount && tentativePlans === null)
          }
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

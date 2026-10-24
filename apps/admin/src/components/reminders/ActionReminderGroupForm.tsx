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
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { RotateCw } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReminderKeywordHelp from "./ReminderKeywordHelp";
import ReminderMessageFields from "./ReminderMessageFields";
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

  const sortedPlans = [...(tentativePlans ?? [])].sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );
  const firstTentativePlan = sortedPlans[0];

  const isProd = !(
    typeof window !== "undefined" && window.location.href.includes("localhost")
  );

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

      <ReminderMessageFields
        eventId={selectedEventId}
        draft={draft}
        onChange={updateDraft}
      />
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

      <ReminderKeywordHelp />

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

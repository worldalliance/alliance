import {
  TagDto,
  type ActionEventDto,
  type ReminderAnchorCandidateDto,
  type ReminderCohortType,
  type ReminderGroupTimingMode,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useReminderTentativePlansAdmin } from "../../lib/useReminderTentativePlansAdmin";
import ReminderKeywordHelp from "./ReminderKeywordHelp";
import ReminderMessageFields from "./ReminderMessageFields";
import ReminderScheduleFields from "./ReminderScheduleFields";
import TentativePlanSummary from "./TentativePlanSummary";
import {
  ActionReminderGroupFormInitialValues,
  draftFromInitialValues,
  ReminderGroupDraft,
} from "./reminderGroupDraft";
import {
  ActionReminderGroupFormSubmitPayload,
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
    relativeRangeStartHours,
    relativeRangeEndHours,
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

  const previewSkipped =
    (draft.cohortType === "tag" && !draft.userTagId) ||
    (draft.timingMode === "within_relative_range" &&
      !relativeRangeIsValid(draft));
  const previewGroup = useMemo(
    () =>
      previewSkipped ? null : { ...reminderGroupRequestFields(draft), suiteId },
    [previewSkipped, draft, suiteId],
  );
  const preview = useReminderTentativePlansAdmin(selectedEventId, previewGroup);
  const tentativePlans = !selectedEventId
    ? null
    : previewSkipped
      ? []
      : (preview.plans ?? null);
  const previewError = preview.error
    ? adminRefusalMessage(preview.error, "Unable to get tentative plans")
    : null;

  useEffect(() => {
    if (preview.plans) setLocalError(null);
  }, [preview.plans]);

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

      <ReminderScheduleFields
        draft={draft}
        anchorCandidates={anchorCandidates}
        onChange={updateDraft}
      />

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
        <TentativePlanSummary
          tentativePlans={tentativePlans}
          previewError={previewError}
          onRetry={preview.retry}
        />
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

import type {
  ReminderAnchorCandidateDto,
  ReminderCohortType,
  TagDto,
} from "@alliance/shared/client";
import { useEffect, useMemo, useState } from "react";
import { useContentConfirm } from "../../../components/useContentConfirm";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { useReminderTentativePlansAdmin } from "../../../lib/useReminderTentativePlansAdmin";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import {
  CheckboxField,
  Field,
  SaveBar,
  SaveState,
} from "../../../ui/templates/Form";
import UserSelect, { type UserSelectUser } from "../../../ui/UserSelect";
import {
  type ActionReminderGroupFormInitialValues,
  draftFromInitialValues,
  type ReminderGroupDraft,
} from "./reminderGroupDraft";
import {
  type ActionReminderGroupFormSubmitPayload,
  excludePreviouslyNotifiedApplies,
  relativeRangeIsValid,
  reminderGroupRequestFields,
  reminderGroupSubmitPayload,
} from "./reminderGroupRequest";
import { ReminderKeywordHelp } from "./ReminderKeywordHelp";
import { ReminderMessageFields } from "./ReminderMessageFields";
import { ReminderScheduleFields } from "./ReminderScheduleFields";
import { COHORT_LABELS, type MemberEvent } from "./suiteReminders";
import { TentativePlanNote } from "./TentativePlanNote";

// Tasks of one suite often share a name, so the id tells their events apart.
const memberEventLabel = ({ event, task }: MemberEvent) =>
  `${task.name} (#${task.id}): ${event.title || "Members taking action"}, ${formatDateTime(
    event.date,
    { timeZone: LAUNCH_TIME_ZONE },
  )}`;

function Subheading({ children }: { children: string }) {
  return (
    <h3 className="border-t border-line pt-5 font-semibold">{children}</h3>
  );
}

export type ReminderGroupFormProps = {
  suiteId: number;
  /** Holds submit until a current recipient count arrives, for a caller that confirms it. */
  waitForRecipientCount: boolean;
  memberEvents: MemberEvent[];
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
  /** An edit: the server keeps a saved group on its event. */
  editing?: boolean;
  onEventChange?: (eventId: number) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (
    payload: ActionReminderGroupFormSubmitPayload,
    recipientCount: number | null,
  ) => Promise<void> | void;
};

export function ReminderGroupForm({
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
  submitLabel = "Create reminders",
  serverError = null,
  editing = false,
  onEventChange,
  onDirtyChange,
  onSubmit,
}: ReminderGroupFormProps) {
  const [eventId, setEventId] = useState(initialValues.memberActionEventId);
  const [draft, setDraft] = useState(() =>
    draftFromInitialValues(initialValues),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  const updateDraft = (patch: Partial<ReminderGroupDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  // Keyed on the values given, not the draft made from them: a new draft's
  // default times are now, so they differ on every render.
  const initialKey = JSON.stringify(initialValues);
  const [initial, setInitial] = useState(() => ({
    key: initialKey,
    eventId: initialValues.memberActionEventId,
    draft,
  }));
  useEffect(() => {
    if (initial.key === initialKey) return;
    const next = {
      key: initialKey,
      eventId: initialValues.memberActionEventId,
      draft: draftFromInitialValues(initialValues),
    };
    setInitial(next);
    setEventId(next.eventId);
    onEventChange?.(next.eventId);
    setDraft(next.draft);
    setLocalError(null);
  }, [initial.key, initialKey, initialValues, onEventChange]);

  const dirty =
    eventId !== initial.eventId ||
    JSON.stringify(draft) !== JSON.stringify(initial.draft);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const rangeError =
    draft.timingMode === "within_relative_range" &&
    draft.relativeRangeStartHours < draft.relativeRangeEndHours
      ? "Window start must be before the window end."
      : null;

  const previewSkipped =
    (draft.cohortType === "tag" && !draft.userTagId) ||
    (draft.timingMode === "within_relative_range" &&
      !relativeRangeIsValid(draft));
  const previewGroup = useMemo(
    () =>
      previewSkipped ? null : { ...reminderGroupRequestFields(draft), suiteId },
    [previewSkipped, draft, suiteId],
  );
  const preview = useReminderTentativePlansAdmin(eventId, previewGroup);
  const tentativePlans = previewSkipped ? [] : (preview.plans ?? null);
  const previewError = preview.error
    ? adminRefusalMessage(preview.error, "Unable to get tentative plans")
    : null;

  const held =
    loadingUsers || (waitForRecipientCount && tentativePlans === null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || held) return;
    setLocalError(null);
    const payload = reminderGroupSubmitPayload({
      draft,
      memberActionEventId: eventId,
    });
    if (!payload.ok) {
      setLocalError(payload.error);
      return;
    }
    if (!(await confirmSave(payload.value))) return;
    await onSubmit(payload.value, tentativePlans?.length ?? null);
  };

  const state = submitting
    ? SaveState.Saving
    : serverError
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : SaveState.Clean;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex min-h-full flex-col"
    >
      <div className="@container flex flex-1 flex-col gap-5 p-card">
        {localError && (
          <p role="alert" className="text-danger">
            {localError}
          </p>
        )}
        <Field label="Name" help="Only staff see it.">
          {(control) => (
            <Input
              {...control}
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
            />
          )}
        </Field>
        <Field
          label="Members taking action event"
          help={
            editing
              ? "A saved group stays on its event; delete it and create another to move it."
              : "Its recipients come from every task in this suite, not only this event's."
          }
        >
          {(control) => (
            <Select
              {...control}
              value={eventId}
              disabled={editing}
              onChange={(event) => {
                const next = Number(event.target.value);
                setEventId(next);
                onEventChange?.(next);
              }}
            >
              {memberEvents.map((memberEvent) => (
                <option key={memberEvent.event.id} value={memberEvent.event.id}>
                  {memberEventLabel(memberEvent)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <ReminderScheduleFields
          draft={draft}
          anchorCandidates={anchorCandidates}
          rangeError={rangeError}
          onChange={updateDraft}
        />

        <Subheading>Recipients</Subheading>
        <Field label="Who gets it">
          {(control) => (
            <Select
              {...control}
              value={draft.cohortType}
              onChange={(event) => {
                const cohortType = Object.keys(COHORT_LABELS).find(
                  (key): key is ReminderCohortType =>
                    key === event.target.value,
                );
                if (cohortType) updateDraft({ cohortType });
              }}
            >
              {Object.entries(COHORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {draft.cohortType === "tag" && (
          <Field
            label="User tag"
            error={userTagsError}
            help={
              !loadingUserTags && !userTagsError && userTags.length === 0
                ? "No tags yet. Create a tag before scheduling."
                : undefined
            }
          >
            {(control) => (
              <Select
                {...control}
                value={draft.userTagId ?? ""}
                disabled={loadingUserTags}
                onChange={(event) =>
                  updateDraft({ userTagId: event.target.value })
                }
              >
                <option value="" disabled>
                  {loadingUserTags ? "Loading tags…" : "Choose a tag"}
                </option>
                {userTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {draft.cohortType === "custom" && (
          <UserSelect
            label="Members"
            users={users}
            selectedUserIds={draft.userIds}
            onChange={(userIds) => updateDraft({ userIds })}
            loading={loadingUsers}
            loadFailed={usersLoadFailed}
          />
        )}

        <Subheading>Messages</Subheading>
        <ReminderMessageFields
          eventId={eventId}
          draft={draft}
          onChange={updateDraft}
        />
        <ReminderKeywordHelp />
        <CheckboxField
          label="Use suite task count"
          help="Counts and names only this suite's uncompleted tasks."
          checked={draft.useSuiteTaskCount}
          onChange={(event) =>
            updateDraft({ useSuiteTaskCount: event.target.checked })
          }
        />
        <CheckboxField
          label="Exclude optional tasks"
          help="Leaves out tasks that are optional for the member."
          checked={draft.excludeOptionalActions}
          onChange={(event) =>
            updateDraft({ excludeOptionalActions: event.target.checked })
          }
        />
        <CheckboxField
          label="Only notify about tasks not yet notified"
          help={
            excludePreviouslyNotifiedApplies(draft.cohortType)
              ? "Skips members who were already told about every task this would mention."
              : "Not for group leads: their reminders are about other members' tasks."
          }
          disabled={!excludePreviouslyNotifiedApplies(draft.cohortType)}
          checked={
            excludePreviouslyNotifiedApplies(draft.cohortType) &&
            draft.excludePreviouslyNotified
          }
          onChange={(event) =>
            updateDraft({ excludePreviouslyNotified: event.target.checked })
          }
        />
      </div>
      <div className="sticky bottom-0">
        <SaveBar
          state={state}
          error={serverError}
          saveLabel={submitLabel}
          note={
            <TentativePlanNote
              plans={tentativePlans}
              error={previewError}
              editing={editing}
              onRetry={preview.retry}
            />
          }
          onDiscard={() => {
            setEventId(initial.eventId);
            setDraft(initial.draft);
            setLocalError(null);
          }}
        />
      </div>
      {contentDialog}
    </form>
  );
}

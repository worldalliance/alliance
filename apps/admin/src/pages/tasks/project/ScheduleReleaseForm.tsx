import type { ScheduleReleaseDto } from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useMemo, useState } from "react";
import {
  defaultReminderPresetNames,
  reminderPresets,
} from "../../../components/reminders/presets";
import {
  ACTION_STATUS_LABELS,
  DEFAULT_EVENT_NAMES,
} from "../../../lib/actionStatusDisplay";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { countOf } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { notifyRealMembersText } from "../../../lib/notifyRealMembers";
import {
  defaultReleaseDates,
  formatPacific,
  releaseOrderError,
} from "../../../lib/releaseDates";
import { useCohortEvaluationAdmin } from "../../../lib/useCohortEvaluationAdmin";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import { useActionReleaseAdmin } from "../../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Select } from "../../../ui/Select";
import { CheckboxField, Field } from "../../../ui/templates/Form";
import { ConfirmMode } from "../../../ui/ToastProvider";

type DeadlineStatus = "office_action" | "completed";

const releaseEvent = (
  status: "member_action" | DeadlineStatus,
  date: Date,
) => ({
  title: DEFAULT_EVENT_NAMES[status],
  description: "",
  newStatus: status,
  date: date.toISOString(),
});

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

/**
 * Schedules the task's release: the members taking action event, an optional
 * deadline and optional default reminders, created in one transaction
 * (`project-actions.service.ts` `scheduleRelease`). It notifies real members,
 * so it asks for the typed phrase before the call.
 */
export function ScheduleReleaseForm({
  action,
  disabled,
}: {
  action: ParsedActionDto;
  disabled: boolean;
}) {
  const defaults = useMemo(() => defaultReleaseDates(new Date()), []);
  const [launch, setLaunch] = useState<Date | null>(defaults.launch);
  const [withDeadline, setWithDeadline] = useState(true);
  const [deadline, setDeadline] = useState<Date | null>(defaults.deadline);
  const [deadlineStatus, setDeadlineStatus] =
    useState<DeadlineStatus>("office_action");
  const [withReminders, setWithReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmOnPage();
  const { schedule } = useActionReleaseAdmin(action.id);
  const {
    userIds,
    evaluating,
    error: evaluationError,
  } = useCohortEvaluationAdmin(action.cohortExpression);

  const deadlineAt = withDeadline ? deadline : null;
  const reach = evaluating ? "… members" : countOf(userIds.size, "member");

  const submit = async () => {
    if (!launch) return setError("Pick a launch date and time");
    if (withDeadline && !deadlineAt) {
      return setError("Pick a deadline date and time");
    }
    const orderError = releaseOrderError(launch, deadlineAt);
    if (orderError) return setError(orderError);
    setError(null);
    const ok = await confirm({
      title: "Schedule the release?",
      message: `Notify ${reach} on ${formatPacific(launch)}. This can't be undone once it launches.`,
      confirmLabel: "Schedule release",
      mode: ConfirmMode.Fullscreen,
      cancelLabel: "Cancel",
      requiredText: notifyRealMembersText("many"),
    });
    if (!ok) return;
    const body: ScheduleReleaseDto = {
      launch: releaseEvent("member_action", launch),
      deadline: deadlineAt ? releaseEvent(deadlineStatus, deadlineAt) : null,
      reminders: withReminders
        ? defaultReminderPresetNames(deadlineAt !== null).map(
            (name) => reminderPresets[name],
          )
        : [],
    };
    try {
      await schedule.mutateAsync(body);
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, "Couldn't schedule the release."));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label={`Launch (${ZONE})`}>
        {(control) => (
          <DateTimePicker
            {...control}
            value={launch}
            timeZone={LAUNCH_TIME_ZONE}
            onChange={({ date }) => setLaunch(date)}
          />
        )}
      </Field>
      <CheckboxField
        label="Deadline"
        checked={withDeadline}
        onChange={(event) => setWithDeadline(event.target.checked)}
      />
      {withDeadline && (
        <>
          <Field label={`Deadline (${ZONE})`}>
            {(control) => (
              <DateTimePicker
                {...control}
                value={deadline}
                timeZone={LAUNCH_TIME_ZONE}
                onChange={({ date }) => setDeadline(date)}
              />
            )}
          </Field>
          <Field label="Then">
            {(control) => (
              <Select
                {...control}
                value={deadlineStatus}
                onChange={(event) =>
                  setDeadlineStatus(
                    event.target.value === "completed"
                      ? "completed"
                      : "office_action",
                  )
                }
              >
                <option value="office_action">
                  {ACTION_STATUS_LABELS.office_action}
                </option>
                <option value="completed">
                  {ACTION_STATUS_LABELS.completed}
                </option>
              </Select>
            )}
          </Field>
        </>
      )}
      <CheckboxField
        label="Default reminders"
        checked={withReminders}
        onChange={(event) => setWithReminders(event.target.checked)}
      />
      <p className="text-fg-muted">
        {launch
          ? `Notifies ${reach} on ${formatPacific(launch)}.`
          : "Pick a launch date."}
      </p>
      {evaluationError && (
        <p role="alert" className="text-danger">
          {adminRefusalMessage(
            evaluationError,
            "Couldn't count the members this release notifies.",
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {disabled && (
        <p className="text-caption text-warning">Save your changes first</p>
      )}
      <Button
        variant={ButtonVariant.Default}
        onClick={() => void submit()}
        busy={schedule.isPending}
        disabled={disabled || evaluating || evaluationError !== null}
      >
        Schedule release…
      </Button>
    </div>
  );
}

import type { ScheduleReleaseDto } from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ConfirmMode, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMemo, useState } from "react";
import {
  defaultReminderPresetNames,
  reminderPresets,
} from "../../components/reminders/presets";
import {
  ACTION_STATUS_LABELS,
  DEFAULT_EVENT_NAMES,
} from "../../lib/actionStatusDisplay";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { notifyRealMembersText } from "../../lib/notifyRealMembers";
import {
  defaultReleaseDates,
  formatPacific,
  fromPacificInput,
  releaseOrderError,
  toPacificInput,
} from "../../lib/releaseDates";
import { useCohortEvaluationAdmin } from "../../lib/useCohortEvaluationAdmin";
import { useActionReleaseAdmin } from "../../lib/useProjectsAdmin";
import PacificDateTimeInput from "./PacificDateTimeInput";

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

const ScheduleReleaseForm = ({
  action,
  disabled,
}: {
  action: ParsedActionDto;
  disabled: boolean;
}) => {
  const defaults = useMemo(() => defaultReleaseDates(new Date()), []);
  const [launch, setLaunch] = useState(toPacificInput(defaults.launch));
  const [withDeadline, setWithDeadline] = useState(true);
  const [deadline, setDeadline] = useState(toPacificInput(defaults.deadline));
  const [deadlineStatus, setDeadlineStatus] =
    useState<DeadlineStatus>("office_action");
  const [withReminders, setWithReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useToast();
  const { schedule } = useActionReleaseAdmin(action.id);
  const { userIds, evaluating } = useCohortEvaluationAdmin(
    action.cohortExpression,
  );

  const launchAt = fromPacificInput(launch);
  const deadlineAt = withDeadline ? fromPacificInput(deadline) : null;
  const reach = evaluating ? "…" : String(userIds.size);

  const submit = async () => {
    if (!launchAt) return setError("Pick a launch date and time.");
    if (withDeadline && !deadlineAt) {
      return setError("Pick a deadline date and time.");
    }
    const orderError = releaseOrderError(launchAt, deadlineAt);
    if (orderError) return setError(orderError);
    setError(null);
    const ok = await confirm({
      title: "Schedule release?",
      message: `Notify ${reach} members on ${formatPacific(launchAt)}`,
      confirmLabel: "Schedule",
      cancelLabel: "Cancel",
      mode: ConfirmMode.Fullscreen,
      requiredText: notifyRealMembersText("many"),
    });
    if (!ok) return;
    const body: ScheduleReleaseDto = {
      launch: releaseEvent("member_action", launchAt),
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
      setError(adminRefusalMessage(thrown, "Failed to schedule the release."));
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <PacificDateTimeInput
        label="Launch"
        value={launch}
        onChange={setLaunch}
      />
      <label className="flex items-center gap-x-2 text-sm">
        <input
          type="checkbox"
          checked={withDeadline}
          onChange={(e) => setWithDeadline(e.target.checked)}
        />
        Deadline
      </label>
      {withDeadline && (
        <div className="flex flex-wrap items-end gap-3 pl-6">
          <PacificDateTimeInput
            label="Deadline"
            value={deadline}
            onChange={setDeadline}
          />
          <label className="flex flex-col gap-y-1 text-sm">
            Then
            <select
              value={deadlineStatus}
              onChange={(e) =>
                setDeadlineStatus(
                  e.target.value === "completed"
                    ? "completed"
                    : "office_action",
                )
              }
              className="rounded border border-gray-300 px-2 py-1.5"
            >
              <option value="office_action">
                {ACTION_STATUS_LABELS.office_action}
              </option>
              <option value="completed">
                {ACTION_STATUS_LABELS.completed}
              </option>
            </select>
          </label>
        </div>
      )}
      <label className="flex items-center gap-x-2 text-sm">
        <input
          type="checkbox"
          checked={withReminders}
          onChange={(e) => setWithReminders(e.target.checked)}
        />
        Default reminders
      </label>
      <p className="text-sm text-zinc-600">
        {launchAt
          ? `Notify ${reach} members on ${formatPacific(launchAt)}`
          : "Pick a launch date"}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button
        color={ButtonColor.Black}
        onClick={submit}
        disabled={disabled || schedule.isPending}
        className="w-fit"
      >
        {schedule.isPending ? "Scheduling…" : "Schedule release"}
      </Button>
    </div>
  );
};

export default ScheduleReleaseForm;

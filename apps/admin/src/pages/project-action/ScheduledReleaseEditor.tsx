import {
  hasTakenEffect,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  fromPacificInput,
  releaseOrderError,
  toPacificInput,
} from "../../lib/releaseDates";
import { useActionReleaseAdmin } from "../../lib/useProjectsAdmin";
import PacificDateTimeInput from "./PacificDateTimeInput";

const ScheduledReleaseEditor = ({
  action,
  disabled,
}: {
  action: ParsedActionDto;
  disabled: boolean;
}) => {
  const now = new Date();
  const { event, deadlineEvent } = memberActionPhase(action.events);
  const launched = event !== null && hasTakenEffect(event.date, now);
  const deadlinePassed =
    deadlineEvent !== null && hasTakenEffect(deadlineEvent.date, now);
  const [launch, setLaunch] = useState(
    event ? toPacificInput(new Date(event.date)) : "",
  );
  const [deadline, setDeadline] = useState(
    deadlineEvent ? toPacificInput(new Date(deadlineEvent.date)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useToast();
  const { reschedule, unschedule } = useActionReleaseAdmin(action.id);

  if (!event) return null;

  const changedDate = (params: {
    event: { date: string } | null;
    value: string;
    editable: boolean;
  }) => {
    const date = fromPacificInput(params.value);
    return params.event &&
      params.editable &&
      date &&
      date.getTime() !== new Date(params.event.date).getTime()
      ? date
      : null;
  };
  const launchChange = changedDate({
    event,
    value: launch,
    editable: !launched,
  });
  const deadlineChange = changedDate({
    event: deadlineEvent,
    value: deadline,
    editable: !deadlinePassed,
  });

  const saveDates = async () => {
    const launchAt = fromPacificInput(launch);
    const deadlineAt = deadlineEvent ? fromPacificInput(deadline) : null;
    if (!launchAt || (deadlineEvent && !deadlineAt)) {
      return setError("Pick a date and time for each event.");
    }
    const orderError = releaseOrderError(launchAt, deadlineAt);
    if (orderError) return setError(orderError);
    setError(null);
    try {
      await reschedule.mutateAsync({
        launch: launchChange?.toISOString(),
        deadline: deadlineChange?.toISOString(),
      });
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, "Failed to change the dates."));
    }
  };

  const unscheduleRelease = async () => {
    const ok = await confirm({
      title: "Unschedule this release?",
      message:
        "Deletes the launch and deadline events and their reminders, and returns the action to staff testing.",
      confirmLabel: "Unschedule release",
      cancelLabel: "Cancel",
    });
    if (!ok) return;
    try {
      await unschedule.mutateAsync();
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, "Failed to unschedule."));
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-wrap gap-3">
        <PacificDateTimeInput
          label="Launch"
          value={launch}
          onChange={setLaunch}
          disabled={launched}
        />
        {deadlineEvent && (
          <PacificDateTimeInput
            label="Deadline"
            value={deadline}
            onChange={setDeadline}
            disabled={deadlinePassed}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-x-2">
        {!deadlinePassed && (
          <Button
            color={ButtonColor.Black}
            onClick={saveDates}
            disabled={
              disabled ||
              reschedule.isPending ||
              (launchChange === null && deadlineChange === null)
            }
          >
            {reschedule.isPending ? "Saving…" : "Save dates"}
          </Button>
        )}
        {!launched && (
          <Button
            color={ButtonColor.RedOutline}
            onClick={unscheduleRelease}
            disabled={disabled || unschedule.isPending}
          >
            Unschedule release
          </Button>
        )}
      </div>
    </div>
  );
};

export default ScheduledReleaseEditor;

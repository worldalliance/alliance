import {
  hasTakenEffect,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  fromPacificInput,
  releaseOrderError,
  toPacificInput,
} from "../../lib/releaseDates";
import { useActionSuiteAdmin } from "../../lib/useActionSuiteAdmin";
import { useActionReleaseAdmin } from "../../lib/useProjectsAdmin";
import PacificDateTimeInput from "./PacificDateTimeInput";

const ScheduledReleaseEditor = ({
  action,
  suiteId,
  disabled,
}: {
  action: ParsedActionDto;
  suiteId: number;
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
  const [saving, setSaving] = useState(false);
  const { confirm } = useToast();
  const queryClient = useQueryClient();
  const { updateEvent } = useActionSuiteAdmin(suiteId);
  const { unschedule } = useActionReleaseAdmin(action.id);

  if (!event) return null;

  const changes = [
    { event, value: launch, editable: !launched },
    { event: deadlineEvent, value: deadline, editable: !deadlinePassed },
  ].flatMap(({ event, value, editable }) => {
    if (!event || !editable) return [];
    const date = fromPacificInput(value);
    return date && date.getTime() !== new Date(event.date).getTime()
      ? [{ eventId: event.id, date }]
      : [];
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
    setSaving(true);
    try {
      for (const { eventId, date } of changes) {
        const updated = await updateEvent.mutateAsync({
          eventId,
          body: { date: date.toISOString() },
        });
        if (!updated) break;
      }
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, "Failed to change the dates."));
    } finally {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.actionAdminAll(),
      });
      setSaving(false);
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
            disabled={disabled || saving || changes.length === 0}
          >
            {saving ? "Saving…" : "Save dates"}
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

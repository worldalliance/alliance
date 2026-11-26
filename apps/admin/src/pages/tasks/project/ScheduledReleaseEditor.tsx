import {
  hasTakenEffect,
  memberActionPhase,
} from "@alliance/common/actionEvent";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { releaseOrderError } from "../../../lib/releaseDates";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import { useActionReleaseAdmin } from "../../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Field } from "../../../ui/templates/Form";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

const changed = (params: {
  event: { date: string } | null;
  value: Date | null;
  editable: boolean;
}) =>
  params.event &&
  params.editable &&
  params.value &&
  params.value.getTime() !== new Date(params.event.date).getTime()
    ? params.value
    : null;

/**
 * The dates of a scheduled, live or closed release. A date that has passed is
 * locked, as the server refuses to move it (`rescheduleRelease`). Saving
 * sends only the dates that changed; a deadline moved earlier asks first
 * (`useActionReleaseAdmin`).
 */
export function ScheduledReleaseEditor({
  action,
  disabled,
}: {
  action: ParsedActionDto;
  disabled: boolean;
}) {
  const now = new Date();
  const { event, deadlineEvent } = memberActionPhase(action.events);
  const launched = event !== null && hasTakenEffect(event.date, now);
  const deadlinePassed =
    deadlineEvent !== null && hasTakenEffect(deadlineEvent.date, now);
  const [launch, setLaunch] = useState<Date | null>(
    event ? new Date(event.date) : null,
  );
  const [deadline, setDeadline] = useState<Date | null>(
    deadlineEvent ? new Date(deadlineEvent.date) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmOnPage();
  const { reschedule, unschedule } = useActionReleaseAdmin(action.id);

  if (!event) return null;

  const launchChange = changed({ event, value: launch, editable: !launched });
  const deadlineChange = changed({
    event: deadlineEvent,
    value: deadline,
    editable: !deadlinePassed,
  });

  const saveDates = async () => {
    if (!launch || (deadlineEvent && !deadline)) {
      return setError("Pick a date and time for each event");
    }
    const orderError = releaseOrderError(
      launch,
      deadlineEvent ? deadline : null,
    );
    if (orderError) return setError(orderError);
    setError(null);
    try {
      await reschedule.mutateAsync({
        launch: launchChange?.toISOString(),
        deadline: deadlineChange?.toISOString(),
      });
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, "Couldn't change the dates."));
    }
  };

  const unscheduleRelease = async () => {
    const ok = await confirm({
      title: "Unschedule this release?",
      message:
        "Deletes the launch and deadline events and their reminders, and returns the task to staff testing.",
      confirmLabel: "Unschedule release",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    try {
      await unschedule.mutateAsync();
    } catch (thrown) {
      setError(adminRefusalMessage(thrown, "Couldn't unschedule the release."));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={`Launch (${ZONE})`}
        help={launched ? "Launched, so it can't move." : undefined}
      >
        {(control) => (
          <DateTimePicker
            {...control}
            value={launch}
            timeZone={LAUNCH_TIME_ZONE}
            disabled={launched}
            onChange={({ date }) => setLaunch(date)}
          />
        )}
      </Field>
      {deadlineEvent && (
        <Field
          label={`Deadline (${ZONE})`}
          help={deadlinePassed ? "Passed, so it can't move." : undefined}
        >
          {(control) => (
            <DateTimePicker
              {...control}
              value={deadline}
              timeZone={LAUNCH_TIME_ZONE}
              disabled={deadlinePassed}
              onChange={({ date }) => setDeadline(date)}
            />
          )}
        </Field>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {disabled && !(launched && deadlinePassed) && (
        <p className="text-caption text-warning">Save your changes first</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!deadlinePassed && (
          <Button
            variant={ButtonVariant.Default}
            onClick={() => void saveDates()}
            busy={reschedule.isPending}
            disabled={
              disabled || (launchChange === null && deadlineChange === null)
            }
          >
            Save dates
          </Button>
        )}
        {!launched && (
          <Button
            variant={ButtonVariant.DangerOutline}
            onClick={() => void unscheduleRelease()}
            busy={unschedule.isPending}
            disabled={disabled}
          >
            Unschedule release…
          </Button>
        )}
      </div>
    </div>
  );
}

import type {
  ActionStatus,
  CreateActionEventDto,
} from "@alliance/shared/client";
import { useState } from "react";
import { DEFAULT_EVENT_NAMES } from "../../../lib/actionStatusDisplay";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Input } from "../../../ui/Input";
import { phaseLabel } from "../../../ui/PhaseBadge";
import { Select } from "../../../ui/Select";
import { linkClass } from "../../../ui/styles";
import {
  CheckboxField,
  Field,
  FieldGroup,
  FormSection,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "../../../ui/templates/Form";
import { Textarea } from "../../../ui/Textarea";
import {
  DEADLINE_STATUSES,
  effectNote,
  EventTargetKind,
  MORE_STATUSES,
  OFFERED_STATUSES,
  type DeadlineStatus,
  type EventTarget,
} from "./eventRules";
import { useAddEvent, type SendEvent } from "./useAddEvent";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

const isStatus = (value: string): value is ActionStatus =>
  [...OFFERED_STATUSES, ...MORE_STATUSES].some((status) => status === value);

const isDeadlineStatus = (value: string): value is DeadlineStatus =>
  DEADLINE_STATUSES.some((status) => status === value);

/**
 * Adds one event to a task or to every task of a suite, behind the
 * confirmation its effect on members needs (`eventConfirm`).
 */
export function AddEventForm({
  target,
  send,
  onAdded,
  onPendingChange,
  onDiscard,
}: {
  target: EventTarget;
  send: SendEvent;
  onAdded: (body: CreateActionEventDto) => void;
  onPendingChange?: (pending: boolean) => void;
  /** Closes the form; omit where its mount has its own close control. */
  onDiscard?: () => void;
}) {
  const { draft, update, errors, failure, pending, submit } = useAddEvent({
    target,
    send,
    onAdded,
    onPendingChange,
  });
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [moreStatuses, setMoreStatuses] = useState(false);
  const hasLaunch =
    target.kind === EventTargetKind.Task &&
    target.task.events.some((event) => event.newStatus === "member_action");
  const showMore =
    moreStatuses || MORE_STATUSES.some((status) => status === draft.status);
  const launch = draft.status === "member_action";
  const suite = target.kind === EventTargetKind.Suite;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!(await submit())) focusFirstInvalid();
  };

  const option = (status: ActionStatus) => {
    const taken = status === "member_action" && hasLaunch;
    return (
      <option key={status} value={status} disabled={taken}>
        {phaseLabel(status)}
        {taken ? " (this task has its launch event)" : ""}
      </option>
    );
  };

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit}>
      <FormSection
        title={suite ? "Add event to every task in the suite" : "Add event"}
        footer={
          <SaveBar
            state={
              pending
                ? SaveState.Saving
                : failure
                  ? SaveState.Failed
                  : SaveState.Dirty
            }
            error={failure?.reason}
            note={effectNote({ target, draft, now: new Date() })}
            saveLabel="Add event"
            stateText={{
              dirty: "",
              saving: "Adding…",
              failed: failure?.word ?? "Couldn't add",
            }}
            onDiscard={onDiscard}
          />
        }
      >
        <Field
          label="Status this event sets"
          error={errors.status}
          help={
            <>
              Members taking action, Office taking action and Completed are the
              statuses in use.{" "}
              {!showMore && (
                <button
                  type="button"
                  className={linkClass}
                  onClick={() => setMoreStatuses(true)}
                >
                  More statuses
                </button>
              )}
            </>
          }
        >
          {(control) => (
            <Select
              {...control}
              value={draft.status}
              onChange={(e) =>
                update({
                  status: isStatus(e.target.value) ? e.target.value : "",
                })
              }
            >
              <option value="" disabled>
                Choose a status
              </option>
              {OFFERED_STATUSES.map(option)}
              {showMore && (
                <optgroup label="Other statuses">
                  {MORE_STATUSES.map(option)}
                </optgroup>
              )}
            </Select>
          )}
        </Field>

        <FieldGroup label="Title">
          <CheckboxField
            label="Use a custom title"
            checked={draft.customTitle}
            onChange={(e) => update({ customTitle: e.target.checked })}
          />
          <Field
            label="Event title"
            error={errors.title}
            help={
              draft.customTitle
                ? undefined
                : "Named after its status. Use a custom title to change it."
            }
          >
            {(control) => (
              <Input
                {...control}
                disabled={!draft.customTitle}
                value={
                  draft.customTitle
                    ? draft.title
                    : draft.status === ""
                      ? ""
                      : DEFAULT_EVENT_NAMES[draft.status]
                }
                onChange={(e) => update({ title: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Description"
            mark="optional"
            help={draft.customTitle ? undefined : "Only with a custom title."}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                disabled={!draft.customTitle}
                value={draft.customTitle ? draft.description : ""}
                onChange={(e) => update({ description: e.target.value })}
              />
            )}
          </Field>
        </FieldGroup>

        <FieldGroup label="When">
          <Field
            label={`Date (${ZONE})`}
            error={errors.date}
            help={
              draft.takeEffectNow
                ? "Dated the moment you confirm."
                : "A date that has passed takes effect as soon as it is added."
            }
          >
            {(control) => (
              <DateTimePicker
                {...control}
                timeZone={LAUNCH_TIME_ZONE}
                disabled={draft.takeEffectNow}
                value={draft.date}
                onChange={(change) => update({ date: change.utcValue ?? "" })}
                className="max-w-80"
              />
            )}
          </Field>
          <CheckboxField
            label="Take effect now"
            checked={draft.takeEffectNow}
            onChange={(e) => update({ takeEffectNow: e.target.checked })}
          />
        </FieldGroup>

        <FieldGroup
          label="Deadline"
          disabled={!launch}
          help={
            launch
              ? undefined
              : "Only a Members taking action event has a deadline."
          }
        >
          <CheckboxField
            label="Add a deadline event"
            help="A second event after the launch, ending members taking action."
            checked={launch && draft.deadline}
            disabled={!launch}
            onChange={(e) => update({ deadline: e.target.checked })}
          />
          <div className="flex flex-col gap-4">
            <Field label={`Deadline (${ZONE})`} error={errors.deadlineDate}>
              {(control) => (
                <DateTimePicker
                  {...control}
                  timeZone={LAUNCH_TIME_ZONE}
                  disabled={!(launch && draft.deadline)}
                  value={draft.deadlineDate}
                  onChange={(change) =>
                    update({ deadlineDate: change.utcValue ?? "" })
                  }
                  className="max-w-80"
                />
              )}
            </Field>
            <Field label="Then the task moves to">
              {(control) => (
                <Select
                  {...control}
                  disabled={!(launch && draft.deadline)}
                  value={draft.deadlineStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (isDeadlineStatus(value)) {
                      update({ deadlineStatus: value });
                    }
                  }}
                  className="max-w-80"
                >
                  {DEADLINE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {phaseLabel(status)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </FieldGroup>
      </FormSection>
    </form>
  );
}

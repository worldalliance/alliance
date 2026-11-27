import type {
  ActionEventDto,
  ActionSuiteDto,
  UpdateActionEventDto,
} from "@alliance/shared/client";
import { useRef, useState } from "react";
import { LAUNCH_CONFIRM_TEXT } from "../../components/CreateEventForm";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../ui/Button";
import DateTimePicker, { timeZoneLabel } from "../../ui/DateTimePicker";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import PhaseBadge from "../../ui/PhaseBadge";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { ConfirmMode, useToast } from "../../ui/ToastProvider";
import {
  editConsequence,
  EventChange,
  type EventConsequence,
  phaseChangeText,
} from "./suiteEventRules";

const pacific = (date: string) =>
  formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

/** Edits one shared event on every task in the suite. */
export function EditSuiteEventDialog({
  suite,
  event,
  updateEvent,
  onClose,
}: {
  suite: ActionSuiteDto;
  event: ActionEventDto;
  /** Resolves `null` when staff decline to move the deadline earlier. */
  updateEvent: (
    eventId: number,
    body: UpdateActionEventDto,
  ) => Promise<ActionSuiteDto | null>;
  onClose: () => void;
}) {
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [date, setDate] = useState(event.date);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const titleRef = useRef<HTMLInputElement>(null);

  const consequenceAt = (now: Date) =>
    editConsequence({ event, date, events: suite.events, now });

  const confirmed = (consequence: EventConsequence): Promise<boolean> => {
    switch (consequence.change) {
      case EventChange.Quiet:
        return Promise.resolve(true);
      case EventChange.Launch:
        return confirm({
          title: "Launch to members now?",
          message:
            "Every task in this suite opens to its members now. This skips the suite launch checks.",
          confirmLabel: "Launch",
          mode: ConfirmMode.Fullscreen,
          requiredText: LAUNCH_CONFIRM_TEXT,
        });
      case EventChange.PhaseNow:
        return confirm({
          title: "Change the suite's phase now?",
          message: phaseChangeText(consequence),
          confirmLabel: "Save for every task",
        });
      case EventChange.EarlierStart:
        return confirm({
          title: "Open the tasks earlier?",
          message: `Every task in this suite opens to its members on ${pacific(date)}, instead of ${pacific(consequence.from)}.`,
          confirmLabel: "Save for every task",
        });
      default:
        throw new Error(`unknown change: ${consequence satisfies never}`);
    }
  };

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setSubmitted(true);
    setRefusal(null);
    if (!date) {
      focusFirstInvalid();
      return;
    }
    setSaving(true);
    try {
      const asked = consequenceAt(new Date());
      if (!(await confirmed(asked))) return;
      // The question can stay open past the time it was asked about.
      if (consequenceAt(new Date()).change !== asked.change) {
        setRefusal(
          "The time passed while you confirmed. Check the date and save again.",
        );
        return;
      }
      const updated = await updateEvent(event.id, {
        title,
        description,
        date,
      });
      if (!updated) return;
      success("Event updated", title);
      onClose();
    } catch (error) {
      setRefusal(adminRefusalMessage(error, "Couldn't update the event."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} dismissDisabled={saving} initialFocus={titleRef}>
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate>
        <ModalHeader>
          <ModalTitle>Edit event for every task</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-fg-muted">
            <PhaseBadge status={event.newStatus} />
            {suite.actions.length === 1
              ? "Saved on this suite's one task."
              : `Saved on all ${countOf(suite.actions.length, "task")} in this suite.`}
          </p>
          <Field label="Title">
            {(control) => (
              <Input
                {...control}
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="Description" mark="optional">
            {(control) => (
              <Input
                {...control}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <Field
            label={`Date (${timeZoneLabel(LAUNCH_TIME_ZONE)})`}
            error={submitted && !date ? "Enter a date" : null}
          >
            {(control) => (
              <DateTimePicker
                {...control}
                timeZone={LAUNCH_TIME_ZONE}
                value={date || null}
                onChange={(change) => setDate(change.utcValue ?? "")}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant={ButtonVariant.Primary} type="submit" busy={saving}>
              Save for every task
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}

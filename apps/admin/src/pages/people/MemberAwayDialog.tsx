import {
  AWAY_RANGE_NOTE_MISSING,
  isAwayRangeNoteMissing,
  isAwayRangeNoteRequired,
} from "@alliance/common/awayRange";
import type {
  UserAwayRangeDto,
  UserAwayRangeReason,
} from "@alliance/shared/client/types.gen";
import {
  AWAY_REASON_OPTIONS,
  changedAwayRangeDays,
} from "@alliance/shared/lib/awayRangesFormatters";
import {
  dateToInputValue,
  todayDateInputValue,
} from "@alliance/shared/lib/dateInput";
import { useEffect, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import type { useUserAwayRangesAdmin } from "../../lib/useUserAwayRangesAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { DateField } from "../../ui/DateField";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Select } from "../../ui/Select";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

type AwayWrites = Pick<
  ReturnType<typeof useUserAwayRangesAdmin>,
  "createAwayRange" | "updateAwayRange"
>;

const REASONS = new Set<string>(
  AWAY_REASON_OPTIONS.map((option) => option.value),
);
const isReason = (value: string): value is UserAwayRangeReason =>
  REASONS.has(value);

type Errors = Partial<Record<"start" | "end" | "reason" | "note", string>>;

/** Schedules time away for the member, or edits one of their away periods. */
export function MemberAwayDialog({
  member,
  editing,
  writes,
  finalFocus,
  onClose,
}: {
  member: { name: string };
  /** The period being edited; none to schedule a new one. */
  editing: UserAwayRangeDto | null;
  writes: AwayWrites;
  /** Where focus goes on close when the control that opened the dialog is gone. */
  finalFocus: () => HTMLElement | null;
  onClose: () => void;
}) {
  const { success } = useToast();
  const opened = {
    start: editing ? dateToInputValue(editing.startDate) : "",
    end: editing ? dateToInputValue(editing.endDate) : "",
  };
  const [start, setStart] = useState(opened.start);
  const [end, setEnd] = useState(opened.end);
  const [reason, setReason] = useState<UserAwayRangeReason | "">(
    editing?.reason ?? "",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const startRef = useRef<HTMLInputElement>(null);
  const refusalRef = useRef<HTMLDivElement>(null);
  // ALL-2474 asks a failed save to take focus to its reason.
  useEffect(() => {
    if (refusal) refusalRef.current?.focus();
  }, [refusal]);
  const today = todayDateInputValue();
  const saving =
    writes.createAwayRange.isPending || writes.updateAwayRange.isPending;

  const validate = (): Errors => ({
    ...(!start && { start: "Choose the first day away" }),
    ...(!editing &&
      start &&
      start < today && { start: "Choose today or a later day" }),
    ...(!end && { end: "Choose the last day away" }),
    ...(start &&
      end &&
      end < start && { end: "Choose a day on or after the start" }),
    ...(!reason && { reason: "Choose a reason" }),
    ...(isAwayRangeNoteMissing({ reason, note }) && {
      note: AWAY_RANGE_NOTE_MISSING,
    }),
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !reason) {
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    try {
      if (editing) {
        await writes.updateAwayRange.mutateAsync({
          id: editing.id,
          body: {
            ...changedAwayRangeDays({ edited: { start, end }, opened }),
            reason,
            note: note.trim() || null,
          },
        });
        success("Away period updated", member.name);
      } else {
        await writes.createAwayRange.mutateAsync({
          startDay: start,
          endDay: end,
          reason,
          note: note.trim() || null,
        });
        success("Away period scheduled", member.name);
      }
      onClose();
    } catch (error) {
      setRefusal(
        adminRefusalMessage(
          error,
          editing
            ? "Couldn't update the away period."
            : "Couldn't schedule the away period.",
        ),
      );
    }
  };

  return (
    <Modal
      onClose={onClose}
      dismissDisabled={saving}
      initialFocus={startRef}
      finalFocus={finalFocus}
    >
      <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>
            {editing ? "Edit away period" : "Schedule time away"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" error={errors.start}>
              {(control) => (
                <DateField
                  {...control}
                  ref={startRef}
                  value={start}
                  min={editing ? undefined : today}
                  onChange={setStart}
                />
              )}
            </Field>
            <Field label="End" error={errors.end}>
              {(control) => (
                <DateField
                  {...control}
                  value={end}
                  min={start || (editing ? undefined : today)}
                  onChange={setEnd}
                />
              )}
            </Field>
          </div>
          <Field label="Reason" error={errors.reason}>
            {(control) => (
              <Select
                {...control}
                value={reason}
                onChange={(event) => {
                  const next = event.target.value;
                  setReason(isReason(next) ? next : "");
                }}
              >
                <option value="">Choose a reason</option>
                {AWAY_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Note"
            mark={isAwayRangeNoteRequired(reason) ? "required" : "optional"}
            error={errors.note}
          >
            {(control) => (
              <Input
                {...control}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal} errorRef={refusalRef}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button variant={ButtonVariant.Primary} type="submit" busy={saving}>
              {editing ? "Save away period" : "Schedule time away"}
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}

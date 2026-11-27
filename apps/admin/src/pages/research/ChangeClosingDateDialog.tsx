import type { KoraBatchDto } from "@alliance/shared/client";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import {
  browserTimeZone,
  closingInstant,
  dateInputValue,
} from "../../lib/koraParticipants";
import { useSetKoraBatchClosesAt } from "../../lib/useKoraBatchesAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { DateField } from "../../ui/DateField";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { closingDateError } from "./batchRules";

// kora-batch.service.ts setClosesAt: the batch and every unfinished assignment
// holding one of its transcripts close at the new time; kora-pool.ts stops
// assigning a batch once its closing time passes.
export const CLOSES_ON_HELP = `At 11:59 PM your time (${browserTimeZone()}). After it, the batch's chat pairs stop being assigned, and assignments holding them close.`;

export function ChangeClosingDateDialog({
  batch,
  onClose,
}: {
  batch: KoraBatchDto;
  onClose: () => void;
}) {
  const { success } = useToast();
  const [date, setDate] = useState(
    batch.closesAt ? dateInputValue(new Date(batch.closesAt)) : "",
  );
  const dateRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const save = useSetKoraBatchClosesAt({
    onSuccess: () => {
      success("Closing date saved");
      onClose();
    },
    onError: (e) =>
      setRefusal(adminRefusalMessage(e, "Couldn't save the closing date.")),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = closingDateError(date);
    setError(problem);
    if (problem) return;
    setRefusal(null);
    save.mutate({ batchId: batch.id, closesAt: closingInstant(date) });
  };

  return (
    <Modal
      onClose={onClose}
      dismissDisabled={save.isPending}
      initialFocus={dateRef}
    >
      <form onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>Change closing date</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-fg-muted">
            For the batch uploaded {formatDateTime(batch.createdAt)}.
          </p>
          <Field label="Closes on" help={CLOSES_ON_HELP} error={error}>
            {(control) => (
              <DateField
                {...control}
                ref={dateRef}
                value={date}
                min={dateInputValue(new Date())}
                onChange={(value) => {
                  setDate(value);
                  setError(null);
                }}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={save.isPending}
            >
              Save
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}

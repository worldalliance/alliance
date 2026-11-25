import { hostedDocNotesSchema } from "@alliance/common/hostedDocs";
import type { HostedDocDto } from "@alliance/shared/client";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useUpdateHostedDocAdmin } from "../../lib/useHostedDocsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";

export function EditHostedDocNotesDialog({
  doc,
  onClose,
}: {
  doc: HostedDocDto;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(doc.notes);
  const notesField = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const update = useUpdateHostedDocAdmin({
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't save the notes.")),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = hostedDocNotesSchema.safeParse(notes);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setRefusal(null);
    update.mutate(
      { id: doc.id, body: { notes: parsed.data } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      onClose={onClose}
      initialFocus={notesField}
      dismissDisabled={update.isPending}
    >
      <form onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>Edit notes</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label={`Notes for ${doc.slug}`}
            help="For staff only."
            error={error}
          >
            {(control) => (
              <Textarea
                {...control}
                ref={notesField}
                value={notes}
                maxLength={2000}
                onChange={(event) => {
                  setNotes(event.target.value);
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
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={update.isPending}
            >
              Save notes
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}

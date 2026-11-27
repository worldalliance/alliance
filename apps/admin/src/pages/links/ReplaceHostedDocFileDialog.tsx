import type { HostedDocDto } from "@alliance/shared/client";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useReplaceHostedDocFileAdmin } from "../../lib/useHostedDocsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { FileInput } from "../../ui/FileInput";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { pdfProblem } from "./hostedDocRules";

/** Chooses the new PDF and says what replacing does, as one decision. */
export function ReplaceHostedDocFileDialog({
  doc,
  onClose,
}: {
  doc: HostedDocDto;
  onClose: () => void;
}) {
  const { success } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const replace = useReplaceHostedDocFileAdmin({
    onSuccess: () => {
      success("File replaced", doc.slug);
      onClose();
    },
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't replace the file.")),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = file ? pdfProblem(file) : "Choose a PDF file";
    if (problem || !file) {
      setError(problem);
      return;
    }
    setRefusal(null);
    replace.mutate({ id: doc.id, file });
  };

  return (
    <Modal onClose={onClose} dismissDisabled={replace.isPending}>
      <form onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>{`Replace the file of ${doc.slug}?`}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p>
            {`/docs/${doc.slug} serves the new file within five minutes, to everyone who has the link. The current file is deleted. This can't be undone.`}
          </p>
          <Field label="New PDF" error={error}>
            {(control) => (
              <FileInput
                {...control}
                accept="application/pdf"
                disabled={replace.isPending}
                value={file ? [file] : []}
                onChange={(files) => {
                  setFile(files[0] ?? null);
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
              disabled={replace.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Danger}
              type="submit"
              busy={replace.isPending}
            >
              Replace file
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
